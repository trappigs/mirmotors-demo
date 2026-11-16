"use client";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { BODY_TYPES, BRAND_MODELS, COLORS, DRIVETRAINS, EQUIPMENT_GROUPS, EQUIPMENT_OPTIONS, FUEL_TYPES, TRANSMISSIONS, normalizeColor } from "@/lib/constants";
import { apiCall } from "@/lib/client-api";
import { SuggestInput } from "./SuggestInput";

export type VehicleFormValues = {
  brand: string; model: string; packageName: string; year: string; km: string; price: string; tradeIn: string;
  fuel: string; transmission: string; bodyType: string; color: string; enginePower: string; engineCc: string;
  drivetrain: string; description: string; equipment: string[];
  damageRecord: string; damageNote: string; tramerAmount: string; expertiseSummary: string;
  legalListingNo: string; legalAuthorizationNo: string; legalPlate: string; legalVin: string;
  legalLien: string; legalWarranty: string; legalRegisteredToCompany: string; legalOwnerConsent: boolean;
  vehicleClass: string; vehicleType: string; stockCode: string; warrantyStatus: string; warrantyUntil: string; warrantyKm: string;
  inspectionUntil: string;
};

export const emptyVehicleForm: VehicleFormValues = {
  brand: "", model: "", packageName: "", year: "", km: "", price: "", tradeIn: "", fuel: "", transmission: "", bodyType: "",
  color: "", enginePower: "", engineCc: "", drivetrain: "", description: "", equipment: [],
  damageRecord: "", damageNote: "", tramerAmount: "", expertiseSummary: "",
  legalListingNo: "", legalAuthorizationNo: "", legalPlate: "", legalVin: "",
  // Mir Motors'un araçları galeri adına tescillidir (işletme kararı); başka durumda personel "İşletme adına değil" seçer.
  legalLien: "", legalWarranty: "", legalRegisteredToCompany: "true", legalOwnerConsent: false,
  vehicleClass: "", vehicleType: "", stockCode: "", warrantyStatus: "", warrantyUntil: "", warrantyKm: "",
  inspectionUntil: "",
};

/** Formun bölümleri: araç sayfası hepsini, sihirbaz adımları bir kısmını gösterir. */
export type FormSection = "basic" | "identity" | "equipment" | "damage" | "legal";
const ALL_SECTIONS: FormSection[] = ["basic", "identity", "equipment", "damage", "legal"];
const VEHICLE_CLASSES = ["Otomobil", "Arazi taşıtı", "Kamyonet", "Minibüs", "Otobüs", "Motosiklet", "Özel amaçlı"];
/**
 * Kimlik bilgileri: ruhsattan okunabilenler. Ruhsattan gelenler özet kartında, gelmeyenler kutu olarak gösterilir.
 * Plaka burada değil: fiyatla birlikte formun en üstünde, her zaman açık kutu olarak durur.
 */
const IDENTITY_KEYS = ["brand", "model", "packageName", "vehicleClass", "vehicleType", "year", "fuel", "color", "legalVin"] as const;
type IdentityKey = (typeof IDENTITY_KEYS)[number];
const SUMMARY_LABELS: Record<IdentityKey, string> = {
  brand: "Marka", model: "Model", packageName: "Paket", vehicleClass: "Cins", vehicleType: "Tip", year: "Model yılı", fuel: "Yakıt", color: "Renk",
  legalVin: "Şasi (son 6)",
};
const TITLE_KEYS: IdentityKey[] = ["brand", "model", "packageName"];

/** Rakamla yazılmış tutarı okunur hâle getirir ("1250000" → "1,25 milyon TL"): eksik/fazla sıfır hemen fark edilsin. */
function spoken(digits: string, unit: string) {
  const n = Number(digits);
  if (!digits || !n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 3 })} milyon ${unit}`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("tr-TR", { maximumFractionDigits: 3 })} bin ${unit}`;
  return `${n} ${unit}`;
}

type Props = {
  mode: "create" | "edit";
  vehicleId?: string;
  initial?: Partial<VehicleFormValues>;
  readOnly?: boolean;
  /** Yayındaki araçta zorunlu alanlar boşaltılamaz (taslakta serbest). */
  published?: boolean;
  /** Gösterilecek bölümler (varsayılan: hepsi). */
  sections?: FormSection[];
  submitLabel?: string;
  /** Kayıttan sonra (sihirbaz: sonraki adım). Verilmezse oluşturmada araç sayfasına gidilir. */
  onSaved?: (id: string) => void;
  /** Ruhsattan okunan form alanları (belgeden ekleme): bunlar tek tek kutu yerine özet kartında gösterilir. */
  ruhsatFields?: string[];
  /** Otomatik taslak (sihirbaz): her alan değişikliği bildirilir. */
  onFieldChange?: (k: keyof VehicleFormValues, value: unknown) => void;
  /** Verilirse "kaydet" düğmesi API yerine bunu çağırır (sihirbaz: bekleyenleri kaydedip sonraki adıma geçer). */
  onSubmitOverride?: (values: VehicleFormValues) => Promise<void>;
  /** Plaka kutusunun altında gösterilir (ör. aynı plaka uyarısı). */
  plateNotice?: ReactNode;
  /** Ruhsattaki ticari ad (D.3), yalnızca gösterilir (tipten farklıysa). */
  tradeName?: string | null;
  /** Eşzamanlı düzenleme koruması: formun açıldığı andaki kayıt sürümü (Kaydet ile gönderilir). */
  version?: string;
  ai?: {
    mode: "LIVE" | "SIMULATION"; json: string; fields: string[]; videoPath?: string;
    /** Belgeden okuma akışı: bağlanacak belgeler ve ekspertizden okunan parça durumları */
    source?: "VIDEO" | "DOCUMENT"; documents?: { kind: "RUHSAT" | "EKSPERTIZ"; path: string }[]; reportParts?: Record<string, string>;
  };
};

/** "Yayın için zorunlu" işareti: taslak eksik bilgiyle kaydedilebilir, yayımlama bu alanları ister. */
const REQUIRED_FOR_PUBLISH = new Set(["legalPlate", "price", "brand", "model", "year", "km", "fuel", "transmission", "bodyType"]);
/** Yönetmelik m.20/2, 21/1-a ilan bilgileri (yayımlamada zorunlu). */
const LEGAL = new Set(["vehicleClass", "vehicleType", "legalPlate", "legalVin", "equipment", "damageRecord", "legalLien", "warrantyStatus", "warrantyUntil", "warrantyKm"]);

export function VehicleForm({ mode, vehicleId, initial, readOnly, published, ai, sections = ALL_SECTIONS, submitLabel, onSaved, ruhsatFields, onFieldChange, onSubmitOverride, plateNotice, tradeName, version }: Props) {
  const show = (x: FormSection) => sections.includes(x);
  const router = useRouter();
  const [v, setV] = useState<VehicleFormValues>(() => {
    const start = { ...emptyVehicleForm, ...initial };
    return { ...start, color: normalizeColor(start.color) };
  });
  // Özet kartındaki alanlar açılışta bir kez belirlenir: yazarken kutu kaybolmasın.
  const [summaryKeys] = useState<IdentityKey[]>(() => IDENTITY_KEYS.filter((k) => ruhsatFields?.includes(k) && String(initial?.[k] ?? "").trim() !== ""));
  const [editRuhsat, setEditRuhsat] = useState(false);
  const ruhsatMode = summaryKeys.length > 0;
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [otherEq, setOtherEq] = useState("");
  const [modelCleared, setModelCleared] = useState("");
  const [baseVersion, setBaseVersion] = useState(version);

  const set = <K extends keyof VehicleFormValues>(k: K, val: VehicleFormValues[K]) => {
    setV((s) => ({ ...s, [k]: val }));
    setSaved(false);
    onFieldChange?.(k, val);
    if (k === "brand") {
      // Yalnızca bilinen bir markadan başka bilinen bir markaya geçişte (harf harf yazarken değil)
      const list = BRAND_MODELS[String(val)];
      const model = v.model.trim();
      if (model && list && BRAND_MODELS[v.brand] && v.brand !== val && !list.some((m) => m.toLocaleLowerCase("tr") === model.toLocaleLowerCase("tr"))) {
        setV((s) => ({ ...s, model: "" }));
        onFieldChange?.("model", "");
        setModelCleared(model);
      }
    }
    if (k === "model") setModelCleared("");
  };
  // "Düzelt" bağlantısı ruhsat özet kartındaki bir alanı hedefliyorsa kart düzenleme moduna açılır (alan görünür olsun).
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if ((summaryKeys as string[]).includes(id)) setEditRuhsat(true);
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [summaryKeys]);
  const addOtherEq = () => {
    const eq = otherEq.trim().slice(0, 80);
    if (eq && !v.equipment.some((x) => x.toLocaleLowerCase("tr") === eq.toLocaleLowerCase("tr"))) set("equipment", [...v.equipment, eq]);
    setOtherEq("");
  };
  const aiMark =(k: string) => (ai?.fields.includes(k) ? "border-sky-400 bg-sky-50" : "");
  const marks = (k: string) => (
    <>
      {REQUIRED_FOR_PUBLISH.has(k) && <span className="ml-0.5 text-accent" title="Yayın için zorunlu">•</span>}
      {LEGAL.has(k) && <span className="ml-0.5 text-[10px] font-bold text-violet-700" title="Mevzuat gereği ilanda zorunlu (Yönetmelik m.20–21)">§</span>}
      {ai?.fields.includes(k) && <span className="ml-1 text-[10px] font-bold text-sky-600">AI</span>}
    </>
  );

  const text = (k: keyof VehicleFormValues, label: string, opts: { numeric?: boolean; list?: string; placeholder?: string; upper?: boolean } = {}) => (
    <div>
      <label className="label" htmlFor={k}>{label}{marks(k)}</label>
      <input
        id={k}
        name={k}
        list={opts.list}
        required={published && REQUIRED_FOR_PUBLISH.has(k)}
        inputMode={opts.numeric ? "numeric" : undefined}
        placeholder={opts.placeholder}
        value={v[k] as string}
        onChange={(e) => {
          const raw = opts.numeric ? e.target.value.replace(/[^\d]/g, "") : e.target.value;
          set(k, (opts.upper ? raw.toUpperCase() : raw) as never);
        }}
        disabled={readOnly}
        className={`input ${aiMark(k)}`}
      />
    </div>
  );
  const select = (k: keyof VehicleFormValues, label: string, options: (string | [string, string])[], empty = "Seçin") => (
    <div>
      <label className="label" htmlFor={k}>{label}{marks(k)}</label>
      <select id={k} name={k} required={published && REQUIRED_FOR_PUBLISH.has(k)} value={v[k] as string} onChange={(e) => set(k, e.target.value as never)} disabled={readOnly} className={`input ${aiMark(k)}`}>
        <option value="">{empty}</option>
        {options.map((o) => {
          const [val, lab] = Array.isArray(o) ? o : [o, o];
          return <option key={val} value={val}>{lab}</option>;
        })}
      </select>
    </div>
  );
  const area = (k: keyof VehicleFormValues, label: string, rows = 2) => (
    <div>
      <label className="label" htmlFor={k}>{label}{marks(k)}</label>
      <textarea id={k} name={k} rows={rows} value={v[k] as string} onChange={(e) => set(k, e.target.value as never)} disabled={readOnly} className={`input ${aiMark(k)}`} />
    </div>
  );
  /** Yazdıkça öneri gösteren kutu (marka, model, cins): listede olmayan değer de yazılabilir. */
  const suggest = (k: "brand" | "model" | "vehicleClass", label: string, options: string[], note = "") => (
    <div>
      <label className="label" htmlFor={k}>{label}{marks(k)}</label>
      <SuggestInput id={k} value={v[k]} onChange={(val) => set(k, val)} options={options} disabled={readOnly} className={`input ${aiMark(k)}`} placeholder={k === "model" && !options.length ? "Yazın" : "Yazın veya seçin"} />
      {note && <p className="mt-1 text-xs text-amber-800" role="status">{note}</p>}
    </div>
  );
  /** Boş zorunlu üst alan (plaka, fiyat): kırmızı çerçeveyle göze batar. */
  const missingMark = (k: "legalPlate" | "price") => (!readOnly && !v[k] ? "border-red-400 bg-red-50/60" : "");
  /** Büyük tutar kutusu: binlik noktayla gösterilir, rakam olarak saklanır; altında okunuşu yazar. */
  const amount = (k: "price" | "km", label: string, unit: string, spokenUnit: string, extra = "", emptyNote = "") => (
    <div>
      <label className="label" htmlFor={k}>{label}{marks(k)}</label>
      <div className="relative">
        <input
          id={k}
          name={k}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Girin"
          required={published && REQUIRED_FOR_PUBLISH.has(k)}
          value={v[k] ? Number(v[k]).toLocaleString("tr-TR") : ""}
          onChange={(e) => set(k, e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 10))}
          disabled={readOnly}
          className={`input py-3 pr-14 text-lg font-semibold tabular-nums ${aiMark(k)} ${extra}`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-zinc-500">{unit}</span>
      </div>
      <p className="mt-1 min-h-4 text-xs text-zinc-500" aria-live="polite" data-testid={`${k}-spoken`}>
        {spoken(v[k], spokenUnit) || (emptyNote && !readOnly && <span className="text-red-700">{emptyNote}</span>)}
      </p>
    </div>
  );
  /** Tek dokunuşla seçim düğmeleri (açılır liste yerine). clearable: seçili düğmeye tekrar basınca seçim kalkar. */
  const chips = (k: keyof VehicleFormValues, label: string, options: (string | [string, string])[], clearable = false) => {
    const cur = v[k] as string;
    const all = cur && !options.some((o) => (Array.isArray(o) ? o[0] : o) === cur) ? [...options, cur] : options;
    return (
      <div>
        <p className="label" id={`${k}-label`}>{label}{marks(k)}</p>
        <div id={k} role="radiogroup" aria-labelledby={`${k}-label`} className="flex flex-wrap gap-2 rounded-lg" data-testid={`chips-${k}`}>
          {all.map((o) => {
            const [val, lab] = Array.isArray(o) ? o : [o, o];
            const on = cur === val;
            return (
              <button
                key={val}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={readOnly}
                onClick={() => set(k, (on && clearable ? "" : val) as never)}
                className={`min-w-[5.5rem] rounded-lg border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-zinc-500"}`}
              >
                {lab}
              </button>
            );
          })}
        </div>
      </div>
    );
  };
  const identityInput = (k: IdentityKey) => {
    switch (k) {
      case "brand": return suggest("brand", "Marka", Object.keys(BRAND_MODELS));
      case "model": return suggest("model", "Model / ticari ad", BRAND_MODELS[v.brand] ?? [], modelCleared ? `Marka değiştiği için önceki model (${modelCleared}) temizlendi.` : "");
      case "packageName": return text("packageName", "Seri / donanım paketi", { placeholder: "örn. 520i M Sport" });
      case "vehicleClass": return suggest("vehicleClass", "Araç cinsi (ruhsatta yazan)", VEHICLE_CLASSES);
      case "vehicleType": return text("vehicleType", "Araç tipi (ruhsatta yazdığı gibi)", { upper: true, placeholder: "örn. CLIO SYMBL ALIZE" });
      case "year": return text("year", "Model yılı", { numeric: true });
      case "fuel": return select("fuel", "Yakıt", FUEL_TYPES);
      case "color": return select("color", "Renk", v.color && !COLORS.includes(v.color) ? [...COLORS, v.color] : COLORS);
      case "legalVin": return text("legalVin", "Şasi no (son 6 hane)", { upper: true, placeholder: "örn. A12345" });
    }
  };
  const identityGrid = (keys: readonly IdentityKey[]) => (
    <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {keys.map((k) => <Fragment key={k}>{identityInput(k)}</Fragment>)}
    </div>
  );
  const unreadKeys = IDENTITY_KEYS.filter((k) => !summaryKeys.includes(k));
  const engineText = [v.engineCc && `${Number(v.engineCc).toLocaleString("tr-TR")} cc`, v.enginePower && `${v.enginePower} hp`].filter(Boolean).join(" · ");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    if (onSubmitOverride) {
      try {
        await onSubmitOverride(v);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    const payload = {
      ...v,
      aiDraftMode: ai?.mode ?? null,
      aiDraftJson: ai?.json ?? null,
      draftVideoPath: ai?.videoPath ?? null,
      aiReviewed: reviewed,
      ...(mode === "edit" && baseVersion ? { baseVersion } : {}),
      aiSource: ai?.source,
      documents: ai?.documents,
      reportParts: ai?.reportParts,
    };
    try {
      if (mode === "create") {
        const res = await apiCall<{ id: string }>("/api/crm/vehicles", { method: "POST", json: payload });
        if (onSaved) onSaved(res.id);
        else router.push(`/crm/vehicles/${res.id}?created=1`);
      } else {
        const r = await apiCall<{ version?: string }>(`/api/crm/vehicles/${vehicleId}`, { method: "PATCH", json: payload });
        if (r.version) setBaseVersion(r.version);
        if (onSaved) onSaved(vehicleId!);
        else {
          setSaved(true);
          router.refresh();
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }


  return (
    <form onSubmit={submit} className="space-y-6" data-testid="vehicle-form">

      {show("basic") && (
        <section className="card p-6">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 pb-3">
            <h2 className="font-display font-semibold">Temel bilgiler</h2>
            <p className="text-xs text-zinc-500"><span className="text-accent">•</span> zorunlu · <span className="font-bold text-violet-700">§</span> ilan mevzuatı · eksikle kaydedilebilir</p>
          </div>
          {/* Plaka ve fiyat: her araçta zorunlu, en üstte ve boşken kırmızı. */}
          <div className="mb-6 grid gap-x-5 gap-y-2 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 sm:grid-cols-2" data-testid="key-fields">
            <div>
              <label className="label" htmlFor="legalPlate">Plaka{marks("legalPlate")}</label>
              <input
                id="legalPlate"
                name="legalPlate"
                autoComplete="off"
                placeholder="örn. 34 ABC 123"
                required={published}
                value={v.legalPlate}
                onChange={(e) => set("legalPlate", e.target.value.toUpperCase())}
                disabled={readOnly}
                className={`input py-3 text-lg font-semibold uppercase tracking-wide ${aiMark("legalPlate")} ${missingMark("legalPlate")}`}
              />
              <p className="mt-1 min-h-4 text-xs text-red-700">{!readOnly && !v.legalPlate ? "Zorunlu: plaka girilmeden ilan yayımlanamaz." : ""}</p>
              {plateNotice}
            </div>
            {amount("price", "Satış fiyatı", "TL", "TL", missingMark("price"), "Zorunlu: fiyat girilmeden ilan yayımlanamaz.")}
          </div>
          {!ruhsatMode && identityGrid(IDENTITY_KEYS)}

          {ruhsatMode && !editRuhsat && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4" data-testid="ruhsat-summary">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-800">Ruhsattan okundu</p>
                  <p className="mt-1 font-display text-lg font-semibold">{[v.brand, v.model, v.packageName].filter(Boolean).join(" ") || "Marka / model okunamadı"}</p>
                </div>
                {!readOnly && <button type="button" onClick={() => setEditRuhsat(true)} className="btn-outline bg-white py-1.5 text-xs" data-testid="ruhsat-edit">Düzelt</button>}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
                {summaryKeys.filter((k) => !TITLE_KEYS.includes(k)).map((k) => (
                  <div key={k}>
                    <dt className="text-xs text-zinc-500">{SUMMARY_LABELS[k]}</dt>
                    <dd className="font-semibold">{v[k] || <span className="font-normal text-zinc-400">boş</span>}</dd>
                  </div>
                ))}
                {tradeName && tradeName !== v.vehicleType && (
                  <div>
                    <dt className="text-xs text-zinc-500">Ticari adı (ruhsat)</dt>
                    <dd className="font-semibold">{tradeName}</dd>
                  </div>
                )}
                {engineText && (
                  <div>
                    <dt className="text-xs text-zinc-500">Motor</dt>
                    <dd className="font-semibold">{engineText}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-3 text-xs text-emerald-900">Ruhsatla karşılaştırın; yanlış bir bilgi varsa &quot;Düzelt&quot;e basın.</p>
            </div>
          )}
          {ruhsatMode && editRuhsat && (
            <div className="rounded-xl border border-zinc-200 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Ruhsat bilgilerini düzeltin</p>
                <button type="button" onClick={() => setEditRuhsat(false)} className="btn-outline py-1.5 text-xs">Özete dön</button>
              </div>
              {identityGrid(IDENTITY_KEYS)}
            </div>
          )}
          {ruhsatMode && !editRuhsat && unreadKeys.length > 0 && (
            <div className="mt-4" data-testid="ruhsat-unread">
              <p className="mb-3 text-sm font-semibold text-amber-800">Ruhsattan okunamayanlar: elle girin</p>
              {identityGrid(unreadKeys)}
            </div>
          )}

          <div className="mt-6 border-t border-zinc-100 pt-5" data-testid="quick-entry">
            <h3 className="font-display font-semibold">{ruhsatMode ? "Ruhsatta olmayan bilgiler" : "Satış bilgileri"}</h3>
            <p className="mb-4 text-xs text-zinc-500">Kilometreyi rakamla yazın; nokta kendiliğinden konur. Vites, kasa ve takas için düğmeye dokunun.</p>
            <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
              {amount("km", "Kilometre", "KM", "km")}
            </div>
            <div className="mt-3 space-y-4">
              {chips("transmission", "Vites", TRANSMISSIONS)}
              {chips("bodyType", "Kasa tipi", BODY_TYPES)}
              {chips("tradeIn", "Takasa uygun", [["true", "Evet"], ["false", "Hayır"]], true)}
            </div>
          </div>

          <details className="mt-5 rounded-lg border border-zinc-200 px-4 py-3" open={mode === "edit" && !ruhsatMode && Boolean(v.enginePower || v.engineCc || v.drivetrain || v.description)}>
            <summary className="cursor-pointer text-sm font-semibold text-zinc-700">Diğer özellikler (isteğe bağlı): motor, çekiş, muayene, açıklama</summary>
            <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {text("enginePower", "Motor gücü (hp)", { numeric: true })}
              {text("engineCc", "Motor hacmi (cc)", { numeric: true })}
              <div>
                <label className="label" htmlFor="inspectionUntil">Muayene geçerlilik tarihi</label>
                <input id="inspectionUntil" type="date" value={v.inspectionUntil} onChange={(e) => set("inspectionUntil", e.target.value)} disabled={readOnly} className={`input ${aiMark("inspectionUntil")}`} />
              </div>
              {select("drivetrain", "Çekiş", DRIVETRAINS)}
            </div>
            <div className="mt-4">{area("description", "İlan açıklaması", 3)}</div>
          </details>
        </section>
      )}

      {show("identity") && !show("basic") && (
        <section className="card p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {text("legalPlate", "Plaka", { upper: true })}
            {text("legalVin", "Şasi no (son 6 hane)", { upper: true, placeholder: "örn. A12345" })}
          </div>
        </section>
      )}

      {show("equipment") && (
        <details id="equipment" className="card p-6">
          <summary className="cursor-pointer font-display font-semibold">
            Donanım ve aksesuarlar{marks("equipment")} <span className="text-sm font-normal text-zinc-500">· {v.equipment.length ? `${v.equipment.length} seçili` : "seçmek için açın"}</span>
          </summary>
          {/* Gruplar basılı kontrol formuyla aynı sırada; listede olmayan (eski veya "Diğer") donanımlar ayrı grupta. */}
          {[...Object.entries(EQUIPMENT_GROUPS), ["Diğer", v.equipment.filter((x) => !EQUIPMENT_OPTIONS.includes(x))] as const]
            .filter(([, list]) => list.length)
            .map(([group, list]) => (
              <div key={group} className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{group}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((eq) => (
                    <label key={eq} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm transition hover:border-zinc-400 has-[:checked]:border-accent has-[:checked]:bg-accent/10">
                      <input
                        type="checkbox"
                        className="accent-[#8c6b22]"
                        checked={v.equipment.includes(eq)}
                        disabled={readOnly}
                        onChange={(e) => set("equipment", e.target.checked ? [...v.equipment, eq] : v.equipment.filter((x) => x !== eq))}
                      />
                      {eq}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          {!readOnly && (
            <div className="mt-4 flex gap-2">
              <input
                value={otherEq}
                onChange={(e) => setOtherEq(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOtherEq(); } }}
                placeholder="Diğer donanım (listede yoksa yazıp ekleyin)"
                maxLength={80}
                className="input flex-1"
                aria-label="Diğer donanım"
              />
              <button type="button" onClick={addOtherEq} className="btn-outline px-4">Ekle</button>
            </div>
          )}
        </details>
      )}

      {show("damage") && (
        <section className="card p-6">
          <h2 className="mb-1 font-display font-semibold">Hasar kaydı (tramer) ve ekspertiz</h2>
          <p className="mb-5 border-b border-zinc-100 pb-3 text-xs text-zinc-500">Doğrulamadığınız bilgiyi &quot;Yok&quot; işaretlemeyin; boş bırakın.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {select("damageRecord", "Hasar kaydı", [["NONE", "Yok"], ["MINOR", "Var"], ["HEAVY", "Var: ağır hasar kayıtlı"]], "Bilgi girilmedi")}
            {(v.damageRecord === "MINOR" || v.damageRecord === "HEAVY" || v.tramerAmount !== "") &&
              text("tramerAmount", "Tramer tutarı (TL, biliniyorsa)", { numeric: true, placeholder: "Boş = bilgi girilmedi" })}
            {v.damageRecord !== "NONE" && area("damageNote", v.damageRecord === "MINOR" || v.damageRecord === "HEAVY" ? "Hasarın niteliği (ilanda zorunlu)" : "Hasarın niteliği / açıklaması")}
            {area("expertiseSummary", "Ekspertiz özeti (sitede gösterilir)")}
          </div>
        </section>
      )}

      {show("legal") && (
        <section className="card p-6">
          <h2 className="mb-1 font-display font-semibold">Şerh, garanti ve satış yetkisi</h2>
          <p className="mb-5 border-b border-zinc-100 pb-3 text-xs text-zinc-500">Ticari unvan ve yetki belgesi no Ayarlar&apos;dan otomatik eklenir.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {select("legalLien", "Rehin / haciz", [["NONE", "Yok"], ["EXISTS", "Var"]], "Bilgi girilmedi")}
            {select("warrantyStatus", "Üretici / ithalatçı garantisi", [["NONE", "Yok"], ["ACTIVE", "Devam ediyor"]], "Bilgi girilmedi")}
            {v.warrantyStatus === "ACTIVE" && (
              <>
                <div>
                  <label className="label" htmlFor="warrantyUntil">Garanti bitiş tarihi{marks("warrantyUntil")}</label>
                  <input id="warrantyUntil" type="date" value={v.warrantyUntil} onChange={(e) => set("warrantyUntil", e.target.value)} disabled={readOnly} className="input" />
                </div>
                {text("warrantyKm", "Garanti bitiş kilometresi", { numeric: true })}
              </>
            )}
            {select("legalRegisteredToCompany", "Tescil", [["true", "İşletme adına tescilli"], ["false", "İşletme adına değil"]], "Bilgi girilmedi")}
            {(v.legalRegisteredToCompany === "false" || v.legalOwnerConsent) && (
              <label className="flex items-center gap-2 self-end text-sm">
                <input type="checkbox" checked={v.legalOwnerConsent} disabled={readOnly} onChange={(e) => set("legalOwnerConsent", e.target.checked)} />
                Araç sahibinden satış / ilan izni alındı
              </label>
            )}
            {text("stockCode", "Stok kodu (isteğe bağlı)")}
            {text("legalAuthorizationNo", "Yetki belgesi no (araca özel ise)")}
          </div>
          {v.legalWarranty && !v.warrantyStatus && <p className="mt-3 text-xs text-zinc-500">Eski garanti notu: {v.legalWarranty}</p>}
        </section>
      )}

      {ai && !readOnly && (
        <section className="card border-sky-300 bg-sky-50 p-5" data-testid="ai-verification">
          <h2 className="font-semibold text-sky-900">3 · Personel onayı</h2>
          <p className="mt-1 text-sm text-sky-900">
            Bu form {ai.mode === "LIVE" ? "canlı AI" : "AI SİMÜLASYONU"} {ai.source === "DOCUMENT" ? "belge okumasıyla" : "taslağıyla"} dolduruldu (mavi alanlar).
            AI yalnızca taslak hazırlar; araç taslak olarak kaydedilir, yayın kararı ve eksik bilgiler sizdedir.
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm font-medium text-sky-950">
            <input type="checkbox" className="mt-0.5" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} data-testid="ai-reviewed" />
            AI&apos;nın doldurduğu alanları {ai.source === "DOCUMENT" ? "belgelerle karşılaştırdım" : "kontrol ettim"}; yanlış olanları düzelttim, doğrulayamadıklarımı boş bıraktım.
          </label>
        </section>
      )}

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {saved && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Değişiklikler kaydedildi.</p>}
      {!readOnly && (
        <div className="flex justify-end">
          <button disabled={busy || (Boolean(ai) && !reviewed)} className="btn-primary px-6 py-3">
            {busy ? "Kaydediliyor…" : submitLabel ?? (mode === "create" ? "Taslak olarak kaydet ve devam et" : "Değişiklikleri kaydet")}
          </button>
        </div>
      )}
    </form>
  );
}
