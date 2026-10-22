"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { apiCall } from "@/lib/client-api";
import { directUpload } from "@/lib/direct-upload";

type Props = {
  vehicleId: string;
  photos: { id: string; url: string; isCover: boolean }[];
  videoUrl: string | null;
  pdfUrl: string | null;
  locked: boolean;
  /** Vercel Blob: dosyalar tarayıcıdan doğrudan yüklenir (sunucu istek gövdesi sınırı). */
  direct: boolean;
};

export function MediaManager({ vehicleId, photos, videoUrl, pdfUrl, locked, direct }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
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

  return (
    <div className="space-y-6">
      <section className="card p-5" data-testid="photo-manager">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Fotoğraflar ({photos.length})</h2>
            <p className="text-xs text-zinc-500">JPG, PNG veya WEBP · en fazla 10 MB · yayımlamak için en az 1 fotoğraf zorunlu</p>
          </div>
          {!locked && (
            <>
              <input
                ref={photoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                data-testid="photo-input"
                onChange={(e) => upload(`/api/crm/vehicles/${vehicleId}/photos`, "files", e.target.files, "photo", photoInput.current)}
              />
              <button type="button" onClick={() => photoInput.current?.click()} disabled={!!busy} className="btn-primary">
                {busy === "photo" ? "Yükleniyor…" : "Bilgisayardan fotoğraf yükle"}
              </button>
            </>
          )}
        </div>
        {photos.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">Henüz fotoğraf yok.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => (
              <div key={p.id} className={`overflow-hidden rounded-lg border-2 ${p.isCover ? "border-accent" : "border-transparent"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="aspect-[3/2] w-full object-cover" />
                <div className="flex items-center justify-between gap-1 bg-zinc-50 p-2 text-xs">
                  {p.isCover ? (
                    <span className="font-semibold text-accent-dark">★ Kapak</span>
                  ) : (
                    !locked && (
                      <button type="button" disabled={!!busy} onClick={() => run("cover", () => apiCall(`/api/crm/vehicles/${vehicleId}/photos/${p.id}`, { method: "PATCH" }))} className="hover:underline">
                        Kapak yap
                      </button>
                    )
                  )}
                  {!locked && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => confirm("Fotoğraf silinsin mi?") && run("del", () => apiCall(`/api/crm/vehicles/${vehicleId}/photos/${p.id}`, { method: "DELETE" }))}
                      className="text-red-600 hover:underline"
                    >
                      Sil
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Video</h2>
            <p className="text-xs text-zinc-500">MP4, WEBM veya MOV · en fazla {direct ? 50 : 200} MB · müşteri sitesinde gösterilir</p>
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
        {videoUrl && <video src={videoUrl} controls preload="metadata" className="mt-4 w-full max-w-xl rounded-lg bg-black" />}
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
