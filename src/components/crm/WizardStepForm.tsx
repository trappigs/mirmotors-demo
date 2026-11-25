"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { VehicleForm, type FormSection, type VehicleFormValues } from "./VehicleForm";
import { AutosaveBadge } from "./AutosaveBadge";
import { SaveError, clearLocalDraft, useAutosave, type Changes } from "@/lib/client-autosave";

type Duplicate = { id: string; title: string; status: string };
const STATUS_TR: Record<string, string> = { REVIEW: "Kontrol bekliyor", DRAFT: "Taslak", AVAILABLE: "Satışta", OPTIONED: "Opsiyonlu", SALE_PENDING: "Satış sürecinde" };
const normPlate = (p: unknown) => String(p ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
/** Güvenli bağlam (https / localhost) dışında crypto.randomUUID yok: yedek rastgele anahtar. */
const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

/** Yeni (henüz oluşturulmamış) giriş için cihazdaki taslak anahtarı. */
export const NEW_DRAFT_KEY = "yeni";

async function send(url: string, method: string, body: unknown, keepalive: boolean) {
  let res: Response;
  try {
    res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive });
  } catch {
    throw new SaveError(navigator.onLine ? "Sunucuya ulaşılamadı" : "İnternet bağlantısı yok", true);
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string; code?: string; duplicates?: Duplicate[]; version?: string };
  if (res.status === 401) throw new SaveError("Oturum süresi doldu: yeniden giriş yapın. Bilgiler bu cihazda saklandı.", false);
  return { res, data };
}

/**
 * Sihirbaz adımındaki form: değişiklikler otomatik kaydedilir (taslak), "devam et" bekleyenleri kaydedip sonraki adıma geçer.
 * Araç henüz yoksa (elle ekleme) ilk değişiklikte tek bir taslak oluşturulur; aynı giriş tekrar gönderilse de ikinci taslak açılmaz.
 * Stokta aynı plakalı araç varsa plaka, personel "Mevcut aracı aç" veya "Yine de yeni kayıt" seçene kadar bekletilir.
 */
export function WizardStepForm({ vehicleId, initial, sections, next, submitLabel, ruhsatFields, uncertainFields, onCreated, version, tradeName }: {
  /** Eşzamanlı düzenleme koruması: sayfa açıldığındaki kayıt sürümü. */
  version?: string; tradeName?: string | null;
  vehicleId?: string; initial?: Partial<VehicleFormValues>; sections: FormSection[]; next: string; submitLabel: string; ruhsatFields?: string[];
  /** AI'nın okuduğu ama emin olmadığı form alanları (turuncu "kontrol edin"). */
  uncertainFields?: string[];
  /** Elle eklemede taslak oluşunca (adım çubuğu bağlantıları açılsın). */
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const idRef = useRef<string | null>(vehicleId ?? null);
  const createKey = useRef<string>("");
  const ackPlate = useRef<string>("");
  const [dup, setDup] = useState<{ plate: string; list: Duplicate[] } | null>(null);
  const dupRef = useRef(dup);
  dupRef.current = dup;
  const versionRef = useRef(version);
  const overwrite = useRef(false);
  const [stale, setStale] = useState<string | null>(null);

  async function save(changes: Changes, { keepalive }: { keepalive: boolean }): Promise<Changes> {
    const body: Changes = { ...changes };
    const plate = "legalPlate" in body ? normPlate(body.legalPlate) : "";
    if (plate && plate === ackPlate.current) body.plateDuplicateAck = true;
    // Kararı bekleyen plaka gönderilmez (diğer alanlar kaydedilir)
    const held = plate && dupRef.current?.plate === plate && !body.plateDuplicateAck;
    if (held) delete body.legalPlate;

    if (!idRef.current) {
      if (keepalive || held) return {}; // yeni taslak sayfa kapanırken veya plaka kararı beklerken oluşturulmaz (cihazda kalır)
      const { res, data } = await send("/api/crm/vehicles", "POST", { ...body, createKey: createKey.current }, false);
      if (data.code === "DUPLICATE_PLATE") {
        setDup({ plate, list: data.duplicates ?? [] });
        return {};
      }
      if (!res.ok || !data.id) throw new SaveError(data.error || `Kaydedilemedi (${res.status})`, res.status >= 500);
      idRef.current = data.id;
      auto.rekey(data.id);
      onCreated?.(data.id);
      // Adres araç sayfasına döner: sayfa yenilense de aynı taslak açılır
      window.history.replaceState(null, "", `/crm/vehicles/${data.id}/tamamla?adim=1`);
      return changes;
    }

    if (!Object.keys(body).filter((k) => k !== "plateDuplicateAck").length) return {};
    if (versionRef.current) body.baseVersion = versionRef.current;
    if (overwrite.current) body.overwrite = true;
    let { res, data } = await send(`/api/crm/vehicles/${idRef.current}`, "PATCH", body, keepalive);
    if (data.code === "STALE") {
      // Başka çalışan daha yeni bir değişiklik kaydetti: üzerine yazılmaz, personel seçer
      setStale(data.error ?? "Bu araç başka bir çalışan tarafından güncellendi.");
      throw new SaveError(data.error ?? "Araç başka bir çalışan tarafından güncellendi", false);
    }
    if (data.code === "DUPLICATE_PLATE") {
      setDup({ plate, list: data.duplicates ?? [] });
      delete body.legalPlate;
      if (!Object.keys(body).length) return {};
      ({ res, data } = await send(`/api/crm/vehicles/${idRef.current}`, "PATCH", body, keepalive));
    }
    if (!res.ok) throw new SaveError(data.error || `Kaydedilemedi (${res.status})`, res.status >= 500);
    if (data.version) versionRef.current = data.version;
    overwrite.current = false;
    const sent = { ...changes };
    if (!("legalPlate" in body)) delete sent.legalPlate;
    return sent;
  }

  const auto = useAutosave({ storageKey: vehicleId ?? NEW_DRAFT_KEY, save });
  // Yeni girişin anahtarı: cihazda yarım kalmış giriş varsa onunki (sunucu aynı anahtarla ikinci taslak açmaz)
  if (!vehicleId && !createKey.current) {
    createKey.current = (auto.restored?.meta?.createKey as string) || newKey();
    auto.setMeta({ createKey: createKey.current });
  }
  // Cihazda kaydedilmemiş değişiklik varsa sunucudaki değerlerin üzerine konur (sonra kaydedilir)
  const [startValues] = useState<Partial<VehicleFormValues>>(() => ({ ...initial, ...(auto.restored?.changes as Partial<VehicleFormValues>) }));
  // Yalnızca önceki oturumdan kalanlar bildirilir (bölüm değiştirirken arada kalan birkaç saniyelik kayıt değil)
  const restoredCount = auto.restored && Date.now() - auto.restored.at > 30_000 ? Object.keys(auto.restored.changes).length : 0;

  function onFieldChange(k: keyof VehicleFormValues, value: unknown) {
    if (k === "legalPlate" && dup && normPlate(value) !== dup.plate) setDup(null);
    auto.queue({ [k]: value });
  }

  async function goNext() {
    const ok = await auto.flush();
    if (dupRef.current) throw new Error("Aynı plakalı araç için seçim yapın (plaka kutusunun altında).");
    if (!idRef.current) {
      // Hiç değişiklik yapılmadan devam edilirse boş taslak açılır (aynı anahtar: ikinci taslak oluşmaz)
      const { res, data } = await send("/api/crm/vehicles", "POST", { createKey: createKey.current }, false);
      if (!res.ok || !data.id) throw new Error(data.error || "Taslak oluşturulamadı");
      idRef.current = data.id;
      auto.rekey(data.id);
    }
    if (!ok && auto.hasPending()) {
      if (!confirm(`Bilgiler sunucuya kaydedilemedi (${auto.error}) ama bu cihazda saklandı ve sonra tekrar denenecek. Yine de sonraki bölüme geçilsin mi?`)) {
        throw new Error(auto.error || "Kaydedilemedi");
      }
    }
    router.push(next.replace(":id", idRef.current!));
    router.refresh();
  }

  const plateNotice = dup && (
    <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="alert" data-testid="plate-duplicate">
      <p className="font-semibold">Bu plakayla stokta kayıtlı araç var</p>
      <ul className="mt-1 space-y-0.5">
        {dup.list.map((d) => <li key={d.id}>{d.title} · {STATUS_TR[d.status] ?? d.status}</li>)}
      </ul>
      <p className="mt-1 text-xs">Plaka siz seçim yapana kadar kaydedilmiyor; diğer bilgiler kaydediliyor.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {dup.list[0] && (
          <Link
            href={`/crm/vehicles/${dup.list[0].id}`}
            onClick={() => { if (!idRef.current) clearLocalDraft(NEW_DRAFT_KEY); }}
            className="btn-primary py-2 text-sm"
            data-testid="plate-open-existing"
          >
            Mevcut aracı aç
          </Link>
        )}
        <button
          type="button"
          className="btn-outline bg-white py-2 text-sm"
          data-testid="plate-create-anyway"
          onClick={() => {
            if (!confirm("Aynı plakayla ikinci bir araç kaydı oluşturulacak. Bunun ayrı bir araç olduğundan (ör. yeniden stoğa giren araç) emin misiniz?")) return;
            ackPlate.current = dup.plate;
            setDup(null);
            void auto.retry();
          }}
        >
          Yine de yeni kayıt oluştur
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {stale && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="alert" data-testid="stale-warning">
          <p className="font-semibold">{stale}</p>
          <p className="mt-0.5 text-xs">Değişiklikleriniz kaybolmadı, bu cihazda bekliyor. Hangisinin kalacağını seçin.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-primary py-2 text-sm" onClick={() => { clearLocalDraft(vehicleId ?? NEW_DRAFT_KEY); window.location.reload(); }}>Güncel hâli göster (benimkileri bırak)</button>
            <button type="button" className="btn-outline bg-white py-2 text-sm" onClick={() => { if (!confirm("Diğer çalışanın değişikliklerinin üzerine sizin değerleriniz yazılacak. Emin misiniz?")) return; overwrite.current = true; setStale(null); void auto.retry(); }}>Benim değişikliklerimi kaydet</button>
          </div>
        </div>
      )}
      <AutosaveBadge status={auto.status} error={auto.error} savedAt={auto.savedAt} created={Boolean(idRef.current)} onRetry={() => void auto.retry()} />
      {restoredCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900" data-testid="draft-restored">
          <span>Bu cihazda kaydedilmemiş {restoredCount} değişiklik bulundu ve forma geri yüklendi; otomatik kaydediliyor.</span>
          {!vehicleId && (
            <button
              type="button"
              className="btn-outline bg-white py-1.5 text-xs"
              onClick={() => {
                if (!confirm("Bu cihazdaki yarım kalmış giriş silinip boş bir giriş başlatılsın mı?")) return;
                clearLocalDraft(NEW_DRAFT_KEY);
                window.location.reload();
              }}
            >
              Boş giriş başlat
            </button>
          )}
        </div>
      )}
      <VehicleForm
        mode={vehicleId ? "edit" : "create"}
        vehicleId={vehicleId}
        initial={startValues}
        sections={sections}
        submitLabel={submitLabel}
        ruhsatFields={ruhsatFields}
        uncertainFields={uncertainFields}
        tradeName={tradeName}
        onFieldChange={onFieldChange}
        onSubmitOverride={() => goNext()}
        plateNotice={plateNotice}
      />
    </div>
  );
}
