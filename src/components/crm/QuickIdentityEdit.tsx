"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiCall } from "@/lib/client-api";
import { useVehicleCatalog } from "@/lib/client-catalog";
import { SuggestInput } from "./SuggestInput";

type Values = { brand: string; model: string; packageName: string };

/**
 * Son kontrol ekranında marka / seri / model hızlı düzeltme: ruhsattan okunan ya da yanlış seçilen model
 * (ör. müşterinin istediği motor/paket uyuşmuyor) 1. adıma dönmeden burada düzeltilir.
 */
export function QuickIdentityEdit({ vehicleId, version, initial }: { vehicleId: string; version: string; initial: Values }) {
  const router = useRouter();
  const cat = useVehicleCatalog();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!editing) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" data-testid="identity-view">
        <span className="text-zinc-600">
          <span className="text-zinc-400">Marka:</span> {initial.brand || "—"} · <span className="text-zinc-400">Seri:</span> {initial.model || "—"} ·{" "}
          <span className="text-zinc-400">Model:</span> {initial.packageName || "—"}
        </span>
        <button type="button" onClick={() => setEditing(true)} className="font-semibold text-accent-dark underline-offset-2 hover:underline" data-testid="identity-edit">
          Değiştir
        </button>
      </div>
    );
  }

  const set = (k: keyof Values, val: string) => {
    setV((s) => {
      // Marka değişince seri ve model sıfırlanır (yeni markanın serileri gelir)
      if (k === "brand" && cat.knownBrand(val) && s.brand.trim().toLocaleLowerCase("tr") !== val.trim().toLocaleLowerCase("tr") && cat.knownBrand(s.brand)) {
        return { brand: val, model: "", packageName: "" };
      }
      return { ...s, [k]: val };
    });
  };

  async function save() {
    setBusy(true);
    setError("");
    try {
      await apiCall(`/api/crm/vehicles/${vehicleId}`, {
        method: "PATCH",
        json: { brand: v.brand.trim(), model: v.model.trim(), packageName: v.packageName.trim(), baseVersion: version },
      });
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const motors = cat.motors(v.brand, v.model);
  return (
    <div className="mt-3 w-full rounded-xl border border-zinc-200 bg-zinc-50/70 p-3" data-testid="identity-form">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="q-brand">Marka</label>
          <SuggestInput id="q-brand" value={v.brand} onChange={(x) => set("brand", x)} options={cat.brands()} className="input" placeholder="Yazın veya seçin" />
        </div>
        <div>
          <label className="label" htmlFor="q-model">Seri</label>
          <SuggestInput id="q-model" value={v.model} onChange={(x) => set("model", x)} options={cat.series(v.brand)} className="input" placeholder="Yazın veya seçin" />
        </div>
        <div>
          <label className="label" htmlFor="q-package">Model (motor ve paket)</label>
          <SuggestInput id="q-package" value={v.packageName} onChange={(x) => set("packageName", x)} options={motors} className="input" placeholder={motors.length ? "Motor ve paket seçin" : "örn. 1.0 TCe Joy"} />
        </div>
      </div>
      {error && <p className="mt-2 rounded-md bg-red-50 p-2 text-sm text-red-700" role="alert">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy || !v.brand.trim() || !v.model.trim()} onClick={save} className="btn-primary py-2">{busy ? "Kaydediliyor…" : "Kaydet"}</button>
        <button type="button" disabled={busy} onClick={() => { setV(initial); setEditing(false); setError(""); }} className="btn-outline py-2">Vazgeç</button>
      </div>
    </div>
  );
}
