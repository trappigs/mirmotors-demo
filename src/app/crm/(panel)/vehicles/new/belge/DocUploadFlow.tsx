"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MaskEditor } from "@/components/crm/MaskEditor";
import { applyMask, fileToPages, type DocPage } from "@/lib/client-docs";
import { directUpload } from "@/lib/direct-upload";
import { DOC_KIND_LABELS, type DocKind } from "@/lib/doc-review";

/** Yeni yüklemede ruhsat ve Mir Motors kontrol formu (dış ekspertiz raporu artık yüklenmez). */
type Kind = Exclude<DocKind, "EKSPERTIZ">;
// original: maskesiz sayfa (yalnızca tarayıcıda; yeniden maskeleme için), page: gönderilecek hâli
type Item = { id: string; kind: Kind | null; original: DocPage; page: DocPage; masked: boolean; warn: string | null };
type Status = { status: string; error: string | null; canRetry: boolean; vehicleId: string | null; mode: string | null; attempts: number; costUsd: number; durationMs: number | null };

const KIND_LABEL = DOC_KIND_LABELS;
const MAX = { RUHSAT: 2, FORM: 2 } as const;
const TOTAL = 4;
const HINT: Record<Kind, string> = {
  RUHSAT: "Sol sayfada kişisel bilgi yoktur. Sağ sayfa da göründüyse \"Sağ tarafı\" düğmesine basın ve kenarı sürükleyerek sol sayfanın sınırına getirin (fotoğraf yan çekildiyse \"Alt tarafı\").",
  FORM: "Formun 2. sayfasındaki \"7 · Onay\" bölümünde ad-soyad ve imzaları kapatın (öneri düğmesi yaklaşık alanı işaretler; kontrol edin). Diğer alanlar görünür kalsın.",
};
/**
 * Kontrol formu 2. sayfa "7 · Onay" bölümü (ad-soyad, imza): A4 şablonda sayfanın ~%71–%86 yüksekliği. Fotoğraf eğik/kırpık olabileceği için
 * yalnızca öneridir; personel kutuyu görür, gerekirse geri alıp kendisi çizer.
 */
const FORM_SIGNATURE_MASK = { label: "İmza / ad-soyad alanını kapat (öneri)", rects: [{ x: 0.04, y: 0.7, w: 0.92, h: 0.17 }] };

const STEPS = [
  { key: "UPLOADED", label: "Yüklendi" },
  { key: "ANALYZING", label: "Analiz ediliyor" },
  { key: "COMPARING", label: "Karşılaştırılıyor" },
  { key: "REVIEW", label: "Kontrol bekliyor" },
];

export function DocUploadFlow({ vehicleId, live, direct, resumeId }: { vehicleId: string | null; live: boolean; direct: boolean; resumeId: string | null }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [analysisId, setAnalysisId] = useState<string | null>(resumeId);
  const [status, setStatus] = useState<Status | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const editingItem = items.find((i) => i.id === editing) ?? null;
  // Yöntem kullanıcıya sorulmaz: yüklenen belge türlerinden belirlenir.
  const hasR = items.some((i) => i.kind === "RUHSAT"), formPages = items.filter((i) => i.kind === "FORM").length;
  const method = vehicleId ? "ADD" : "AUTO";

  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/crm/doc-analyses/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Durum alınamadı");
      setStatus(data);
      if (data.status === "REVIEW" && data.vehicleId) router.push(`/crm/vehicles/${data.vehicleId}/tamamla?adim=1`);
    } catch (e) {
      setError(`Bağlantı sorunu: ${(e as Error).message}. Sayfa durumu otomatik tekrar soracak.`);
    }
  }, [router]);

  useEffect(() => {
    if (!analysisId) return;
    poll(analysisId);
    const t = setInterval(() => {
      if (status && ["REVIEW", "ERROR", "CANCELLED", "DONE"].includes(status.status)) return;
      poll(analysisId);
    }, 2000);
    return () => clearInterval(t);
  }, [analysisId, poll, status]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setPreparing(true);
    setError("");
    try {
      const pages: Item[] = [];
      for (const f of Array.from(files)) {
        for (const p of await fileToPages(f)) {
          pages.push({ id: crypto.randomUUID(), kind: null, original: p, page: p, masked: false, warn: Math.max(p.width, p.height) < 1200 ? `Düşük çözünürlük (${p.width}×${p.height}); okuma hatalı olabilir.` : null });
        }
      }
      const room = TOTAL - items.length;
      if (pages.length > room) setError(`Toplam en fazla ${TOTAL} sayfa yüklenebilir.`);
      const added = pages.slice(0, Math.max(0, room));
      setItems((cur) => [...cur, ...added]);
      // Maskeleme ekranı ilk yeni sayfayla kendiliğinden açılır
      if (added.length) setEditing(added[0].id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPreparing(false);
    }
  }

  const count = (k: Kind) => items.filter((i) => i.kind === k).length;
  const notReady = items.some((i) => !i.kind)
    ? "Her sayfanın türünü (ruhsat / kontrol formu) seçin."
    : items.some((i) => !i.masked)
      ? "Tüm sayfalarda kişisel verileri kapatın veya \"kişisel veri yok\" deyin."
      : count("RUHSAT") > MAX.RUHSAT || count("FORM") > MAX.FORM
        ? `Ruhsat en fazla ${MAX.RUHSAT}, kontrol formu en fazla ${MAX.FORM} sayfa olabilir.`
        : "";
  const ready = items.length > 0 && notReady === "";

  async function start(simulation: boolean) {
    setBusy(true);
    setError("");
    try {
      let res: Response;
      if (direct) {
        const files = [];
        for (const [n, i] of items.entries()) {
          const file = new File([i.page.blob], `${i.kind!.toLowerCase()}-${n + 1}.jpg`, { type: "image/jpeg" });
          files.push({ kind: i.kind!, path: await directUpload(file, "docs", { target: "docDraft" }) });
        }
        res = await fetch("/api/crm/doc-analyses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, vehicleId, masked: true, simulation, files }) });
      } else {
        const fd = new FormData();
        fd.append("method", method);
        if (vehicleId) fd.append("vehicleId", vehicleId);
        fd.append("masked", "1");
        if (simulation) fd.append("simulation", "1");
        items.forEach((i, n) => fd.append(i.kind!.toLowerCase(), new File([i.page.blob], `${i.kind!.toLowerCase()}-${n + 1}.jpg`, { type: "image/jpeg" })));
        res = await fetch("/api/crm/doc-analyses", { method: "POST", body: fd });
      }
      const data = await res.json();
      if (res.status === 409 && data.vehicleId) {
        setError(`${data.error} `);
        setStatus({ status: "DUPLICATE", error: data.error, canRetry: false, vehicleId: data.vehicleId, mode: null, attempts: 0, costUsd: 0, durationMs: null });
        return;
      }
      if (!res.ok) throw new Error(data.error || "Yükleme başarısız");
      setAnalysisId(data.id);
      const url = new URL(window.location.href);
      url.searchParams.set("analiz", data.id);
      window.history.replaceState(null, "", url.toString()); // sayfa kapanıp açılınca kaldığı yerden izlenir
    } catch (e) {
      setError(`${(e as Error).message}. Belgeler ekranda duruyor; tekrar deneyebilirsiniz.`);
    } finally {
      setBusy(false);
    }
  }

  async function action(kind: "retry" | "cancel") {
    if (!analysisId) return;
    const res = await fetch(`/api/crm/doc-analyses/${analysisId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: kind }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "İşlem yapılamadı");
    setStatus(null);
    poll(analysisId);
  }

  if (analysisId) {
    const s = status?.status ?? "UPLOADED";
    const idx = STEPS.findIndex((x) => x.key === s);
    return (
      <div className="card max-w-2xl space-y-5 p-6" data-testid="doc-status">
        <h2 className="font-semibold">Belge analizi</h2>
        <ol className="grid gap-2 sm:grid-cols-4">
          {STEPS.map((st, i) => (
            <li key={st.key} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${i < idx || s === "REVIEW" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : i === idx ? "border-ink bg-ink text-white" : "border-zinc-200 text-zinc-400"}`}>
              {i + 1}. {st.label}{i === idx && s !== "REVIEW" ? "…" : ""}
            </li>
          ))}
        </ol>
        {(s === "ANALYZING" || s === "UPLOADED" || s === "COMPARING") && (
          <p className="text-sm text-zinc-600">
            {status?.mode === "SIMULATION" ? "Örnek veriyle deneme hazırlanıyor." : "Belgeler okunuyor; genelde 15–40 saniye sürer."} Sayfayı kapatabilirsiniz; sonuç araç listesinde &quot;Kontrol Bekliyor&quot; olarak görünür.
          </p>
        )}
        {s === "ERROR" && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{status?.error}</p>}
        {s === "CANCELLED" && <p className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-700">Analiz iptal edildi; araç kaydı oluşturulmadı.</p>}
        {s === "DUPLICATE" && status?.vehicleId && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{status.error} <a className="font-semibold underline" href={`/crm/vehicles/${status.vehicleId}`}>Mevcut aracı aç</a></p>
        )}
        {s === "REVIEW" && <p className="text-sm text-emerald-700">Analiz tamamlandı; araç sayfası açılıyor…</p>}
        {error && s !== "DUPLICATE" && <p className="text-xs text-amber-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {["UPLOADED", "ANALYZING", "COMPARING"].includes(s) && <button type="button" onClick={() => action("cancel")} className="btn-outline text-red-600" data-testid="doc-cancel">İptal et</button>}
          {s === "ERROR" && status?.canRetry && <button type="button" onClick={() => action("retry")} className="btn-primary" data-testid="doc-retry">Yeniden dene ({status.attempts}/3)</button>}
          {["ERROR", "CANCELLED", "DUPLICATE"].includes(s) && (
            <button type="button" onClick={() => { setAnalysisId(null); setStatus(null); setError(""); }} className="btn-outline">Belgelere dön</button>
          )}
        </div>
        {status?.mode === "LIVE" && status.durationMs != null && <p className="text-xs text-zinc-400">Süre {Math.round(status.durationMs / 1000)} sn</p>}
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-5">
      {!live && (
        <p className="rounded-md border-2 border-amber-400 bg-amber-100 p-3 text-sm text-amber-950" data-testid="doc-sim-note">
          <strong>Belge okuma şu an kapalı.</strong> Belgeler kaydedilir ama okunmaz; deneme örnek veriyle yapılır.
        </p>
      )}
      <section className="card p-5" data-testid="doc-picker">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Ruhsat ve Mir Motors araç kontrol formu</p>
            <p className="text-xs text-zinc-500">Fotoğraf, PDF veya iPhone (HEIC) · ruhsat en fazla {MAX.RUHSAT}, kontrol formu {MAX.FORM} sayfa · yazılar net ve tam görünsün</p>
          </div>
          <input
            ref={input}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf"
            className="hidden"
            data-testid="doc-input"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
          <button type="button" onClick={() => input.current?.click()} disabled={preparing || items.length >= TOTAL} className={items.length ? "btn-outline" : "btn-primary"}>
            {preparing ? "Hazırlanıyor…" : items.length ? "Sayfa ekle" : "Belgeleri seç"}
          </button>
        </div>
        {items.length === 0 ? (
          <ol className="mt-4 grid gap-2 text-sm text-zinc-600 sm:grid-cols-3">
            <li className="rounded-lg bg-zinc-50 p-3"><strong>1.</strong> Ruhsatın <strong>yalnızca sol sayfasının</strong> fotoğrafını çekin (araç bilgileri orada). İsterseniz doldurulmuş kontrol formunu (2 sayfa) da ekleyin</li>
            <li className="rounded-lg bg-zinc-50 p-3"><strong>2.</strong> Her sayfanın türünü seçin; sağ sayfa da göründüyse kişisel bilgilerin üstünü çizin</li>
            <li className="rounded-lg bg-zinc-50 p-3"><strong>3.</strong> &quot;Analiz et&quot;e basın; bilgiler 15–40 saniyede dolar</li>
          </ol>
        ) : null}
        {items.length === 0 && (
          <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900" data-testid="ruhsat-left-page">
            İpucu: Ruhsatın sağ sayfasında sahibin kimlik ve adres bilgileri vardır; çekmeyin. Aracın işletme adına kayıtlı olup olmadığını son kontrolde tek dokunuşla seçersiniz.
          </p>
        )}
        {items.length === 0 ? null : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((i, n) => (
              <li key={i.id} data-kind={i.kind ?? ""} className={`overflow-hidden rounded-lg border ${i.masked && i.kind ? "border-emerald-300" : "border-amber-300"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.page.url} alt="" className="aspect-[3/4] w-full bg-zinc-100 object-contain" />
                <div className="space-y-1.5 p-2 text-xs">
                  <p className="truncate text-zinc-500" title={i.page.label}>{n + 1}. {i.kind ? KIND_LABEL[i.kind] : "Türü seçilmedi"}</p>
                  <p className={i.masked ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>{i.masked ? "Hazır ✓" : "Maskeleme bekliyor"}</p>
                  {i.warn && <p className="text-amber-700">⚠ {i.warn}</p>}
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => setEditing(i.id)} className="btn-outline flex-1 px-2 py-1 text-xs">{i.masked ? "Düzenle" : "Maskele"}</button>
                    <button type="button" onClick={() => setItems((c) => c.filter((x) => x.id !== i.id))} className="btn-outline px-2 py-1 text-xs text-red-600" aria-label="Kaldır">✕</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {items.some((i) => i.kind) && (
        <div className="space-y-1 rounded-md bg-zinc-100 p-3 text-sm text-zinc-700" data-testid="doc-method-note">
          <p>
            {[hasR && "ruhsat", formPages && "kontrol formu"].filter(Boolean).join(" + ")}:{" "}
            {hasR && formPages
              ? "kimlik bilgileri ruhsattan, kaporta / hasar / yasal / donanım formdan okunur; farklı olan alanlar size sorulur."
              : formPages
                ? "ruhsat yoksa plaka, şasi ve tescil bilgilerini formdan veya elle kontrol edin."
                : "km, kaporta, hasar ve donanım sonradan girilir veya kontrol formu eklenir."}
          </p>
          {formPages === 1 && (
            <p className="font-medium text-amber-800" data-testid="form-one-page">Kontrol formunun yalnızca 1 sayfası eklendi. Diğer sayfa eksikse o sayfadaki bilgiler okunmaz (taslak oluşur, eksikler yayından önce tamamlanır).</p>
          )}
        </div>
      )}
      <p className="text-xs text-zinc-500">
        Belgeler müşteri sitesinde gösterilmez. Kişisel bilgiler (ad, T.C. no, adres, telefon) kapatılmadan okumaya gönderilmez.
      </p>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy || !ready} onClick={() => start(false)} className="btn-primary" data-testid="btn-start-analysis">
          {busy ? "Yükleniyor…" : live ? "Belgeleri analiz et" : "Örnek veriyle dene"}
        </button>
        {live && <button type="button" disabled={busy || !ready} onClick={() => start(true)} className="btn-outline">Örnek veriyle dene (ücretsiz)</button>}
        {!ready && items.length > 0 && <span className="self-center text-xs text-amber-700">{notReady}</span>}
      </div>

      {editingItem && (
        <MaskEditor
          key={editingItem.id}
          page={editingItem.page}
          kind={editingItem.kind}
          onKind={(k) => setItems((c) => c.map((x) => (x.id === editingItem.id ? { ...x, kind: k } : x)))}
          hint={editingItem.kind ? HINT[editingItem.kind] : ""}
          suggestion={editingItem.kind === "FORM" ? FORM_SIGNATURE_MASK : undefined}
          progress={`Sayfa ${items.findIndex((x) => x.id === editingItem.id) + 1} / ${items.length}`}
          onCancel={() => setEditing(null)}
          onDone={async (rects) => {
            const page = rects.length ? await applyMask(editingItem.original, rects) : editingItem.original;
            const updated = items.map((x) => (x.id === editingItem.id ? { ...x, page, masked: true } : x));
            setItems(updated);
            // Sıradaki maskelenmemiş sayfa kendiliğinden açılır
            setEditing(updated.find((x) => !x.masked)?.id ?? null);
          }}
        />
      )}
    </div>
  );
}
