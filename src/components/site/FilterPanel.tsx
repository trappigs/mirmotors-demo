"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS } from "@/lib/constants";

type Values = Record<string, string | undefined>;

export const DETAIL_FILTER_KEYS = ["marka", "model", "minFiyat", "maxFiyat", "minYil", "maxYil", "minKm", "maxKm", "yakit", "vites", "kasa", "durum"];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-zinc-100 py-4 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <p className="label">{title}</p>
      {children}
    </fieldset>
  );
}

/** "Detaylı Filtreler" düğmesi + sağdan açılan panel. Tüm filtreler URL parametresi olarak GET ile gönderilir. */
export function FilterPanel({ brandModels, values, sort }: { brandModels: Record<string, string[]>; values: Values; sort: string }) {
  const [brand, setBrand] = useState(values.marka ?? "");
  const [open, setOpen] = useState(false);
  const models = brand ? brandModels[brand] ?? [] : [];
  const activeCount = DETAIL_FILTER_KEYS.filter((k) => values[k]).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const range = (min: string, max: string, unit: string) => (
    <div className="grid grid-cols-2 gap-2">
      {[min, max].map((name, i) => (
        <div key={name} className="relative">
          <input name={name} aria-label={`${i ? "Maks" : "Min"} ${unit}`} defaultValue={values[name] ?? ""} inputMode="numeric" placeholder={i ? "Maks" : "Min"} className="input pr-10" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400">{unit}</span>
        </div>
      ))}
    </div>
  );
  const select = (name: string, label: string, options: string[]) => (
    <select id={name} name={name} aria-label={label} defaultValue={values[name] ?? ""} className="input">
      <option value="">Tümü</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-outline h-11 rounded-xl px-4" aria-expanded={open} data-testid="open-filters">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        Detaylı Filtreler
        {activeCount > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-ink">{activeCount}</span>}
      </button>

      {/* Panel her zaman DOM'da kalır (form değerleri korunur); kapalıyken görünmez */}
      <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open} inert={!open}>
        <div className={`absolute inset-0 bg-ink/50 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={() => setOpen(false)} />
        <form
          action="/araclar"
          role="dialog"
          aria-label="Detaylı filtreler"
          onSubmit={(e) => {
            // Boş alanları göndermeyerek URL'yi sade tut
            for (const el of Array.from(e.currentTarget.elements)) {
              if ((el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && el.value === "" && !(el instanceof HTMLInputElement && el.type === "radio")) {
                el.disabled = true;
              }
            }
          }}
          className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        >
          <input type="hidden" name="sirala" value={sort} />
          {values.q && <input type="hidden" name="q" value={values.q} />}
          {values.gorunum && <input type="hidden" name="gorunum" value={values.gorunum} />}
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
            <p className="font-display text-lg font-bold">Detaylı Filtreler</p>
            <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-ink" aria-label="Kapat">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <Group title="Marka / Model">
              <div className="space-y-2">
                <select id="marka" name="marka" aria-label="Marka" value={brand} onChange={(e) => setBrand(e.target.value)} className="input">
                  <option value="">Tüm markalar</option>
                  {Object.keys(brandModels).map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <select id="model" name="model" aria-label="Model" key={brand} defaultValue={brand === values.marka ? values.model ?? "" : ""} disabled={!brand} className="input">
                  <option value="">{brand ? "Tüm modeller" : "Önce marka seçin"}</option>
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </Group>
            <Group title="Fiyat">{range("minFiyat", "maxFiyat", "TL")}</Group>
            <Group title="Model yılı">{range("minYil", "maxYil", "yıl")}</Group>
            <Group title="Kilometre">{range("minKm", "maxKm", "km")}</Group>
            <div className="grid grid-cols-2 gap-x-3">
              <Group title="Yakıt">{select("yakit", "Yakıt", FUEL_TYPES)}</Group>
              <Group title="Vites">{select("vites", "Vites", TRANSMISSIONS)}</Group>
            </div>
            <Group title="Kasa tipi">{select("kasa", "Kasa tipi", BODY_TYPES)}</Group>
            <Group title="Durum">
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 text-xs font-semibold">
                {[["", "Tümü"], ["AVAILABLE", "Satışta"], ["OPTIONED", "Opsiyonlu"]].map(([val, label]) => (
                  <label key={label} className="cursor-pointer">
                    <input type="radio" name="durum" value={val} defaultChecked={(values.durum ?? "") === val} className="peer sr-only" />
                    <span className="block rounded-lg px-2 py-2 text-center text-zinc-500 transition peer-checked:bg-white peer-checked:text-ink peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </Group>
          </div>

          <div className="flex gap-3 border-t border-zinc-200 px-6 py-4">
            <Link href="/araclar" className="btn-outline flex-1 rounded-xl py-3">Temizle</Link>
            <button className="btn-primary flex-[2] rounded-xl py-3">Filtrele</button>
          </div>
        </form>
      </div>
    </>
  );
}
