"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiCall } from "@/lib/client-api";
import { directUpload } from "@/lib/direct-upload";
import { PhotoGrid } from "@/components/crm/photo-grid";
import { PHOTO_ACCEPT, PHOTO_MAX_BYTES, PHOTO_MAX_COUNT, dedupeFiles, fileKey, formatMB, makeLimiter, preparePhoto, remainingSlots } from "@/lib/photo-prepare";
import { registerBlobPhoto, transferPhotoToBlob, uploadLocalPhoto } from "@/lib/photo-upload";

type Props = {
  vehicleId: string;
  photos: { id: string; url: string; isCover: boolean }[];
  videoUrl: string | null;
  /** Video müşteri sitesinde gösteriliyor mu (personel onayı). */
  videoPublic: boolean;
  /** Video AI analiz akışından mı geldi (personelin anlatımı; varsayılan olarak gizli kalmalı). */
  videoFromAi: boolean;
  pdfUrl: string | null;
  locked: boolean;
  /** Vercel Blob: dosyalar tarayıcıdan doğrudan yüklenir (sunucu istek gövdesi sınırı). */
  direct: boolean;
};

type QStatus = "prep" | "wait" | "upload" | "save" | "done" | "error";
/** Ekranda gösterilen kuyruk satırı. */
type QItem = { id: string; key: string; name: string; preview: string; status: QStatus; progress: number; error: string };
/** Kuyruk öğesinin ekranda görünmeyen çalışma verisi (tekrar denemede hazırlanmış dosya yeniden kullanılır). */
type Work = { file: File; preview: string; prepared: File | null; rel: string | null; removed: boolean };

function statusText(q: QItem): string {
  switch (q.status) {
    case "prep":
      return "Hazırlanıyor…";
    case "wait":
      return "Sırada…";
    case "upload":
      return `Yükleniyor %${q.progress}`;
    case "save":
      return "Kaydediliyor…";
    case "done":
      return "Yüklendi ✓";
    case "error":
      return `Hata: ${q.error}`;
  }
}

export function MediaManager({ vehicleId, photos, videoUrl, videoPublic, videoFromAi, pdfUrl, locked, direct }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const upload = (url: string, field: string, files: FileList | null, label: "photo" | "video" | "pdf", input: HTMLInputElement | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    run(label, async () => {
      try {
        if (direct) {
          const paths = await Promise.all(list.map((f) => directUpload(f, vehicleId, { target: "vehicle", kind: label, vehicleId })));
          await apiCall(url, { method: "POST", json: field === "files" ? { paths } : { path: paths[0] } });
        } else {
          const fd = new FormData();
          list.forEach((f) => fd.append(field, f));
          await apiCall(url, { method: "POST", body: fd });
        }
      } finally {
        if (input) input.value = "";
      }
    });
  };

  // ---- Fotoğraf yükleme kuyruğu ----
  // Her fotoğraf ayrı istekle yüklenir. Hazırlama (HEIC çevirme/küçültme) tek tek, depoya aktarma en fazla 2 paralel;
  // araca kayıt ise seçim sırasıyla ve tek tek yapılır (sıra korunur, iki istek aynı anda kapak olamaz).
  const [queue, setQueue] = useState<QItem[]>([]);
  const [notice, setNotice] = useState("");
  const work = useRef(new Map<string, Work>());
  const turn = useRef<Promise<void>>(Promise.resolve());
  const prepLimit = useRef(makeLimiter(1));
  const transferLimit = useRef(makeLimiter(2));
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  });

  const activeCount = queue.filter((q) => q.status !== "done" && q.status !== "error").length;
  const failedCount = queue.filter((q) => q.status === "error").length;
  const photosFull = remainingSlots(photos.length, activeCount + failedCount) === 0;

  const patchItem = (id: string, p: Partial<QItem>) => setQueue((list) => list.map((q) => (q.id === id ? { ...q, ...p } : q)));

  /** Başarılı her yüklemeden sonra ızgarayı sunucudan yeniler (art arda gelenler tek yenilemede birleşir). */
  const scheduleRefresh = () => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 400);
  };

  const removeItem = (id: string) => {
    const w = work.current.get(id);
    if (w) {
      w.removed = true;
      URL.revokeObjectURL(w.preview);
      work.current.delete(id);
    }
    setQueue((list) => list.filter((q) => q.id !== id));
  };

  // Sayfadan çıkarken önizleme adreslerini serbest bırak.
  useEffect(() => {
    const map = work.current;
    return () => {
      clearTimeout(refreshTimer.current);
      map.forEach((w) => {
        w.removed = true;
        URL.revokeObjectURL(w.preview);
      });
    };
  }, []);

  // Yükleme sürerken sekme kapatılırsa uyar.
  useEffect(() => {
    if (activeCount === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [activeCount]);

  async function processItem(id: string) {
    const w = work.current.get(id);
    if (!w) return;
    // Kayıt sırası: bu öğe, kendinden önce başlatılanın kaydı bitince (başarılı ya da hatalı) kaydedilir.
    const myTurn = turn.current;
    let release!: () => void;
    turn.current = new Promise<void>((r) => (release = r));
    try {
      if (!w.prepared) {
        patchItem(id, { status: "prep", progress: 0, error: "" });
        const prepared = await prepLimit.current(() => (w.removed ? Promise.resolve(w.file) : preparePhoto(w.file)));
        if (w.removed) return;
        w.prepared = prepared;
        if (prepared !== w.file) {
          // HEIC önizlemesi Android'de görünmez; hazırlanan JPEG'i göster.
          URL.revokeObjectURL(w.preview);
          w.preview = URL.createObjectURL(prepared);
          patchItem(id, { preview: w.preview });
        }
      }
      const file = w.prepared;
      if (file.size > PHOTO_MAX_BYTES) throw new Error(`Fotoğraf çok büyük (${formatMB(file.size)}); en fazla 10 MB olabilir`);
      if (direct) {
        if (!w.rel) {
          patchItem(id, { status: "upload", progress: 0, error: "" });
          w.rel = await transferLimit.current(() => transferPhotoToBlob(file, vehicleId, (pct) => patchItem(id, { progress: Math.min(99, Math.round(pct)) })));
        }
        const rel = w.rel;
        patchItem(id, { status: "wait" });
        await myTurn;
        if (w.removed) return;
        patchItem(id, { status: "save" });
        try {
          await registerBlobPhoto(vehicleId, rel);
        } catch (e) {
          w.rel = null; // tekrar denemede dosya yeniden aktarılır
          throw e;
        }
      } else {
        patchItem(id, { status: "wait", error: "" });
        await myTurn;
        if (w.removed) return;
        patchItem(id, { status: "upload", progress: 0 });
        await uploadLocalPhoto(file, vehicleId, (pct) => patchItem(id, { progress: Math.min(99, pct) }));
      }
      // Yalnızca sunucu kaydı onayladıktan sonra "Yüklendi" görünür.
      patchItem(id, { status: "done", progress: 100 });
      scheduleRefresh();
      setTimeout(() => removeItem(id), 2500);
    } catch (e) {
      if (!w.removed) patchItem(id, { status: "error", error: (e as Error).message || "Bilinmeyen hata" });
    } finally {
      release();
    }
  }

  function addFiles(files: FileList | null, input: HTMLInputElement) {
    const picked = files ? Array.from(files) : [];
    input.value = ""; // aynı fotoğraf yeniden seçilebilsin
    if (picked.length === 0) return;
    const messages: string[] = [];
    const existing = queueRef.current.filter((q) => q.status !== "done").map((q) => q.key);
    const { unique, duplicates } = dedupeFiles(picked, existing);
    if (duplicates.length > 0) messages.push(`${duplicates.length} fotoğraf zaten seçili olduğu için atlandı.`);
    const slots = remainingSlots(photos.length, existing.length);
    const accepted = unique.slice(0, slots);
    if (unique.length > slots) {
      messages.push(
        slots === 0
          ? `En fazla ${PHOTO_MAX_COUNT} fotoğraf eklenebilir; yeni fotoğraf eklemek için önce bazılarını silin.`
          : `En fazla ${PHOTO_MAX_COUNT} fotoğraf eklenebilir; seçtiğiniz fotoğrafların ilk ${slots} tanesi alındı, ${unique.length - slots} tanesi alınmadı.`,
      );
    }
    setNotice(messages.join(" "));
    if (accepted.length === 0) return;
    const items: QItem[] = accepted.map((file) => {
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      work.current.set(id, { file, preview, prepared: null, rel: null, removed: false });
      return { id, key: fileKey(file), name: file.name || "Fotoğraf", preview, status: "prep", progress: 0, error: "" };
    });
    setQueue((list) => [...list, ...items]);
    // Seçim sırasıyla başlat: kayıt sırası da bu sıra olur.
    items.forEach((q) => void processItem(q.id));
  }

  const retry = (id: string) => {
    patchItem(id, { status: "prep", error: "", progress: 0 });
    void processItem(id);
  };
  const retryAll = () => queueRef.current.filter((q) => q.status === "error").forEach((q) => retry(q.id));

  /** Sürükleme veya oklarla değişen sırayı kaydeder; hata olursa ızgara eski sıraya döner. */
  const reorder = async (order: string[]) => {
    setError("");
    try {
      await apiCall(`/api/crm/vehicles/${vehicleId}/photos`, { method: "PATCH", json: { order } });
      router.refresh();
    } catch (e) {
      setError(`Sıra kaydedilemedi: ${(e as Error).message}`);
      throw e;
    }
  };

  return (
    <div className="space-y-6">
      <section className="card p-5" data-testid="photo-manager">
        <div>
          <h2 className="font-semibold">Fotoğraflar ({photos.length}/{PHOTO_MAX_COUNT})</h2>
          <p className="text-xs text-zinc-500">
            Yalnızca bu araca ait, galeride çekilmiş gerçek fotoğraflar · yayımlamak için en az 1 fotoğraf zorunlu.
            iPhone (HEIC) fotoğrafları da yüklenebilir; büyük fotoğraflar otomatik küçültülür ve konum (GPS) bilgisi silinir.
          </p>
        </div>
        {!locked && (
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              ref={photoInput}
              type="file"
              accept={PHOTO_ACCEPT}
              multiple
              className="hidden"
              data-testid="photo-input"
              onChange={(e) => addFiles(e.target.files, e.target)}
            />
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              data-testid="camera-input"
              onChange={(e) => addFiles(e.target.files, e.target)}
            />
            <button type="button" onClick={() => photoInput.current?.click()} disabled={photosFull} className="btn-primary min-h-11 px-5">
              Fotoğraf seç
            </button>
            <button type="button" onClick={() => cameraInput.current?.click()} disabled={photosFull} className="btn-outline min-h-11 px-5">
              Kamerayla çek
            </button>
          </div>
        )}
        {notice && <p className="mt-3 rounded-md bg-amber-50 p-2.5 text-xs text-amber-900" role="status">{notice}</p>}

        {queue.length > 0 && (
          <div className="mt-4 space-y-2" data-testid="photo-queue">
            <div className="flex items-center justify-between gap-2 text-xs text-zinc-600">
              <span>
                {activeCount > 0 ? `${activeCount} fotoğraf yükleniyor — sayfayı kapatmayın.` : "Yükleme tamamlandı."}
                {failedCount > 0 && <span className="ml-1 font-semibold text-red-700">{failedCount} fotoğraf yüklenemedi.</span>}
              </span>
              {failedCount > 1 && (
                <button type="button" onClick={retryAll} className="min-h-9 rounded-md px-2 font-medium underline">
                  Hepsini tekrar dene
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {queue.map((q) => (
                <li key={q.id} className={`flex items-center gap-3 rounded-lg border p-2 ${q.status === "error" ? "border-red-200 bg-red-50" : "border-zinc-200 bg-white"}`} data-testid="photo-queue-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={q.preview} alt="" className="h-12 w-16 shrink-0 rounded bg-zinc-100 object-cover" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-zinc-500">{q.name}</p>
                    <p className={`text-sm font-medium ${q.status === "error" ? "text-red-700" : q.status === "done" ? "text-emerald-700" : "text-zinc-800"}`}>
                      {statusText(q)}
                    </p>
                    {(q.status === "upload" || q.status === "save") && (
                      <div className="mt-1 h-1.5 overflow-hidden rounded bg-zinc-200">
                        <div className="h-full bg-accent transition-all" style={{ width: `${q.status === "save" ? 100 : q.progress}%` }} />
                      </div>
                    )}
                  </div>
                  {q.status === "error" && (
                    <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                      <button type="button" onClick={() => retry(q.id)} className="btn-outline min-h-10 px-3 text-xs">Tekrar dene</button>
                      <button type="button" onClick={() => removeItem(q.id)} className="min-h-10 px-3 text-xs text-zinc-600 underline">Kaldır</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <PhotoGrid
          photos={photos}
          locked={locked}
          disabled={!!busy}
          sortPaused={activeCount > 0}
          onReorder={reorder}
          onCover={(id) => run("cover", () => apiCall(`/api/crm/vehicles/${vehicleId}/photos/${id}`, { method: "PATCH" }))}
          onDelete={(id) => confirm("Fotoğraf silinsin mi?") && run("del", () => apiCall(`/api/crm/vehicles/${vehicleId}/photos/${id}`, { method: "DELETE" }))}
        />
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Video</h2>
            <p className="text-xs text-zinc-500">MP4, WEBM veya MOV · en fazla {direct ? 50 : 200} MB · onaylamadığınız sürece müşteri sitesinde gösterilmez</p>
          </div>
          {!locked && (
            <div className="flex gap-2">
              <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" data-testid="video-input"
                onChange={(e) => upload(`/api/crm/vehicles/${vehicleId}/video`, "file", e.target.files, "video", videoInput.current)} />
              <button type="button" onClick={() => videoInput.current?.click()} disabled={!!busy} className="btn-outline">
                {busy === "video" ? "Yükleniyor…" : videoUrl ? "Videoyu değiştir" : "Video yükle"}
              </button>
              {videoUrl && (
                <button type="button" disabled={!!busy} onClick={() => confirm("Video silinsin mi?") && run("vdel", () => apiCall(`/api/crm/vehicles/${vehicleId}/video`, { method: "DELETE" }))} className="btn-outline text-red-600">
                  Sil
                </button>
              )}
            </div>
          )}
        </div>
        {videoUrl && (
          <>
            <video src={videoUrl} controls preload="metadata" className="mt-4 w-full max-w-xl rounded-lg bg-black" />
            {videoFromAi && (
              <p className="mt-3 rounded-md bg-amber-50 p-2.5 text-xs text-amber-900">
                Bu video AI analiz akışında yüklendi (personel anlatımı içerebilir). Müşteriye açmadan önce içeriğini kontrol edin.
              </p>
            )}
            <label className={`mt-3 flex items-center gap-2 text-sm ${locked ? "text-zinc-400" : ""}`}>
              <input
                type="checkbox"
                checked={videoPublic}
                disabled={locked || !!busy}
                data-testid="video-public"
                onChange={(e) => run("vpub", () => apiCall(`/api/crm/vehicles/${vehicleId}/video`, { method: "PATCH", json: { public: e.target.checked } }))}
              />
              Bu videoyu müşteri sitesinde tanıtım videosu olarak yayımla
            </label>
            <p className="mt-1 text-xs text-zinc-500">{videoPublic ? "Video sitede görünüyor." : "Video yalnızca CRM'de görünüyor."}</p>
          </>
        )}
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Ekspertiz raporu (PDF)</h2>
            <p className="text-xs text-zinc-500">Yalnızca CRM içinde görüntülenir · müşteri sitesinde yayımlanmaz · en fazla 15 MB</p>
          </div>
          {!locked && (
            <div className="flex gap-2">
              <input ref={pdfInput} type="file" accept="application/pdf" className="hidden" data-testid="pdf-input"
                onChange={(e) => upload(`/api/crm/vehicles/${vehicleId}/expertise`, "file", e.target.files, "pdf", pdfInput.current)} />
              <button type="button" onClick={() => pdfInput.current?.click()} disabled={!!busy} className="btn-outline">
                {busy === "pdf" ? "Yükleniyor…" : pdfUrl ? "PDF'i değiştir" : "PDF yükle"}
              </button>
              {pdfUrl && (
                <button type="button" disabled={!!busy} onClick={() => confirm("Ekspertiz raporu silinsin mi?") && run("pdel", () => apiCall(`/api/crm/vehicles/${vehicleId}/expertise`, { method: "DELETE" }))} className="btn-outline text-red-600">
                  Sil
                </button>
              )}
            </div>
          )}
        </div>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-medium underline">
            Ekspertiz raporunu görüntüle (CRM)
          </a>
        )}
      </section>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}
