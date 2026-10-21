"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BODY_TYPES, BRAND_MODELS, DRIVETRAINS, EQUIPMENT_OPTIONS, FUEL_TYPES, TRANSMISSIONS } from "@/lib/constants";
import { apiCall } from "@/lib/client-api";

export type VehicleFormValues = {
  brand: string; model: string; packageName: string; year: string; km: string; price: string;
  fuel: string; transmission: string; bodyType: string; color: string; enginePower: string; engineCc: string;
  drivetrain: string; description: string; equipment: string[];
  paintedParts: string; changedParts: string; damageNote: string; tramerAmount: string; expertiseSummary: string;
  legalListingNo: string; legalAuthorizationNo: string; legalPlate: string; legalVin: string; legalOwnerConsent: boolean;
};

export const emptyVehicleForm: VehicleFormValues = {
  brand: "", model: "", packageName: "", year: "", km: "", price: "", fuel: "", transmission: "", bodyType: "",
  color: "", enginePower: "", engineCc: "", drivetrain: "", description: "", equipment: [],
  paintedParts: "", changedParts: "", damageNote: "", tramerAmount: "", expertiseSummary: "",
  legalListingNo: "", legalAuthorizationNo: "", legalPlate: "", legalVin: "", legalOwnerConsent: false,
};

type Props = {
  mode: "create" | "edit";
  vehicleId?: string;
  initial?: Partial<VehicleFormValues>;
  readOnly?: boolean;
  ai?: { mode: "LIVE" | "SIMULATION"; json: string; fields: string[]; videoPath?: string };
};

export function VehicleForm({ mode, vehicleId, initial, readOnly, ai }: Props) {
  const router = useRouter();
  const [v, setV] = useState<VehicleFormValues>({ ...emptyVehicleForm, ...initial });
  const [verified, setVerified] = useState({ price: false, damage: false, expertise: false });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof VehicleFormValues>(k: K, val: VehicleFormValues[K]) => {
    setV((s) => ({ ...s, [k]: val }));
    setSaved(false);
  };
  const aiMark = (k: string) => (ai?.fields.includes(k) ? "border-sky-400 bg-sky-50" : "");
  const aiHint = (k: string) => (ai?.fields.includes(k) ? <span className="ml-1 text-[10px] font-bold text-sky-600">AI</span> : null);

  const text = (k: keyof VehicleFormValues, label: string, opts: { required?: boolean; numeric?: boolean; list?: string; placeholder?: string } = {}) => (
    <div>
      <label className="label" htmlFor={k}>{label}{opts.required && " *"}{aiHint(k)}</label>
      <input
        id={k}
        name={k}
        list={opts.list}
        required={opts.required}
        inputMode={opts.numeric ? "numeric" : undefined}
        placeholder={opts.placeholder}
        value={v[k] as string}
        onChange={(e) => set(k, (opts.numeric ? e.target.value.replace(/[^\d]/g, "") : e.target.value) as never)}
        disabled={readOnly}
        className={`input ${aiMark(k)}`}
      />
    </div>
  );
  const select = (k: keyof VehicleFormValues, label: string, options: string[], required = false) => (
    <div>
      <label className="label" htmlFor={k}>{label}{required && " *"}{aiHint(k)}</label>
      <select id={k} name={k} required={required} value={v[k] as string} onChange={(e) => set(k, e.target.value as never)} disabled={readOnly} className={`input ${aiMark(k)}`}>
        <option value="">Seçin</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  const area = (k: keyof VehicleFormValues, label: string, rows = 2) => (
    <div>
      <label className="label" htmlFor={k}>{label}{aiHint(k)}</label>
      <textarea id={k} name={k} rows={rows} value={v[k] as string} onChange={(e) => set(k, e.target.value as never)} disabled={readOnly} className={`input ${aiMark(k)}`} />
    </div>
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = {
      ...v,
      aiDraftMode: ai?.mode ?? null,
      aiDraftJson: ai?.json ?? null,
      draftVideoPath: ai?.videoPath ?? null,
      verifiedPrice: verified.price,
      verifiedDamage: verified.damage,
      verifiedExpertise: verified.expertise,
    };
    try {
      if (mode === "create") {
        const res = await apiCall<{ id: string }>("/api/crm/vehicles", { method: "POST", json: payload });
        router.push(`/crm/vehicles/${res.id}?created=1`);
      } else {
        await apiCall(`/api/crm/vehicles/${vehicleId}`, { method: "PATCH", json: payload });
        setSaved(true);
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const models = BRAND_MODELS[v.brand] ?? [];

  return (
    <form onSubmit={submit} className="space-y-6" data-testid="vehicle-form">
      <datalist id="brands">{Object.keys(BRAND_MODELS).map((b) => <option key={b} value={b} />)}</datalist>
      <datalist id="models">{models.map((m) => <option key={m} value={m} />)}</datalist>

      <section className="card p-6">
        <h2 className="mb-5 border-b border-zinc-100 pb-3 font-display font-semibold">Temel bilgiler</h2>
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {text("brand", "Marka", { required: true, list: "brands" })}
          {text("model", "Model", { required: true, list: "models" })}
          {text("packageName", "Paket / Versiyon", { placeholder: "örn. 520i M Sport" })}
          {text("year", "Model yılı", { required: true, numeric: true })}
          {text("km", "Kilometre", { required: true, numeric: true })}
          {text("price", "Fiyat (TL)", { required: true, numeric: true })}
          {select("fuel", "Yakıt", FUEL_TYPES, true)}
          {select("transmission", "Vites", TRANSMISSIONS, true)}
          {select("bodyType", "Kasa tipi", BODY_TYPES, true)}
          {text("color", "Renk")}
          {text("enginePower", "Motor gücü (hp)", { numeric: true })}
          {text("engineCc", "Motor hacmi (cc)", { numeric: true })}
          {select("drivetrain", "Çekiş", DRIVETRAINS)}
        </div>
        <div className="mt-4">{area("description", "İlan açıklaması", 3)}</div>
      </section>

      <section className="card p-6">
        <h2 className="mb-5 border-b border-zinc-100 pb-3 font-display font-semibold">Donanım{aiHint("equipment")}</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from(new Set([...EQUIPMENT_OPTIONS, ...v.equipment])).map((eq) => (
            <label key={eq} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm transition hover:border-zinc-400 has-[:checked]:border-accent has-[:checked]:bg-accent/10">
              <input
                type="checkbox"
                className="accent-[#9c7a45]"
                checked={v.equipment.includes(eq)}
                disabled={readOnly}
                onChange={(e) => set("equipment", e.target.checked ? [...v.equipment, eq] : v.equipment.filter((x) => x !== eq))}
              />
              {eq}
            </label>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-5 border-b border-zinc-100 pb-3 font-display font-semibold">Ekspertiz, boya ve hasar</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {area("paintedParts", "Boyalı parçalar")}
          {area("changedParts", "Değişen parçalar")}
          {area("damageNote", "Hasar açıklaması")}
          {text("tramerAmount", "Tramer tutarı (TL)", { numeric: true, placeholder: "Yoksa 0" })}
        </div>
        <div className="mt-4">{area("expertiseSummary", "Ekspertiz özeti (sitede gösterilir)", 3)}</div>
      </section>

      <details className="card p-6">
        <summary className="cursor-pointer font-semibold">Yasal ilan alanları <span className="text-xs font-normal text-zinc-500">(gerçek yayından önce doldurulacak — demo için boş bırakın)</span></summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {text("legalListingNo", "İlan numarası")}
          {text("legalAuthorizationNo", "Yetki belgesi no")}
          {text("legalPlate", "Plaka")}
          {text("legalVin", "Şasi no")}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.legalOwnerConsent} disabled={readOnly} onChange={(e) => set("legalOwnerConsent", e.target.checked)} />
            Araç sahibinden ilan izni alındı
          </label>
        </div>
        <p className="mt-3 text-xs text-zinc-500">EİDS doğrulaması bu demoda yoktur; hukuki gereklilik netleştiğinde eklenecektir.</p>
      </details>

      {ai && !readOnly && (
        <section className="card border-sky-300 bg-sky-50 p-5" data-testid="ai-verification">
          <h2 className="font-semibold text-sky-900">İnsan doğrulaması zorunlu</h2>
          <p className="mt-1 text-sm text-sky-900">
            Bu form {ai.mode === "LIVE" ? "canlı AI" : "SİMÜLASYON"} taslağıyla dolduruldu. Mavi alanlar AI önerisidir. Kaydetmeden önce aşağıdaki alanları araç ve belgeler üzerinden kontrol edin.
          </p>
          <div className="mt-3 space-y-2 text-sm">
            {([
              ["price", "Fiyatı kontrol ettim ve doğruladım"],
              ["damage", "Boya / değişen / hasar bilgilerini doğruladım"],
              ["expertise", "Ekspertiz bilgisini rapor üzerinden doğruladım"],
            ] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" checked={verified[k]} onChange={(e) => setVerified((s) => ({ ...s, [k]: e.target.checked }))} />
                {label}
              </label>
            ))}
          </div>
        </section>
      )}

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {saved && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Değişiklikler kaydedildi.</p>}
      {!readOnly && (
        <div className="flex justify-end">
          <button disabled={busy} className="btn-primary px-6 py-3">
            {busy ? "Kaydediliyor…" : mode === "create" ? "Taslak olarak kaydet ve devam et" : "Değişiklikleri kaydet"}
          </button>
        </div>
      )}
    </form>
  );
}
