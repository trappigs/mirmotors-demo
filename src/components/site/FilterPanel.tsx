"use client";
import Link from "next/link";
import { useState } from "react";
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS } from "@/lib/constants";

type Values = Record<string, string | undefined>;

const FILTER_KEYS = ["marka", "model", "minFiyat", "maxFiyat", "minYil", "maxYil", "minKm", "maxKm", "yakit", "vites", "kasa", "durum"];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-zinc-100 px-5 py-4 first:border-t-0">
      <legend className="sr-only">{title}</legend>
      <p className="label">{title}</p>
      {children}
    </fieldset>
  );
}

export function FilterPanel({ brandModels, values, sort }: { brandModels: Record<string, string[]>; values: Values; sort: string }) {
  const [brand, setBrand] = useState(values.marka ?? "");
  const [open, setOpen] = useState(false);
  const models = brand ? brandModels[brand] ?? [] : [];
  const activeCount = FILTER_KEYS.filter((k) => values[k]).length;

  const range = (min: string, max: string, unit: string) => (
    <div className="grid grid-cols-2 gap-2">
      {[min, max].map((name, i) => (
        <div key={name} className="relative">
          <input name={name} aria-label={`${i ? "Maks" : "Min"} ${unit}`} defaultValue={values[name] ?? ""} inputMode="numeric" placeholder={i ? "Maks" : "Min"} className="input pr-9" />
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
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn-outline w-full lg:hidden" aria-expanded={open}>
        {open ? "Filtreleri gizle" : "Filtreler"}
        {activeCount > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-ink">{activeCount}</span>}
      </button>
      <form action="/araclar" className={`${open ? "block" : "hidden"} card mt-3 overflow-hidden lg:mt-0 lg:block`}>
        <input type="hidden" name="sirala" value={sort} />
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-5 py-3.5">
          <p className="font-display text-sm font-semibold">
            Filtreler {activeCount > 0 && <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[11px] text-ink">{activeCount}</span>}
          </p>
          {activeCount > 0 && <Link href="/araclar" className="text-xs font-semibold text-zinc-500 hover:text-ink">Temizle</Link>}
        </div>

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
        <Group title="Yakıt">{select("yakit", "Yakıt", FUEL_TYPES)}</Group>
        <Group title="Vites">{select("vites", "Vites", TRANSMISSIONS)}</Group>
        <Group title="Kasa tipi">{select("kasa", "Kasa tipi", BODY_TYPES)}</Group>
        <Group title="Durum">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1 text-xs font-semibold">
            {[["", "Tümü"], ["AVAILABLE", "Satışta"], ["OPTIONED", "Opsiyonlu"]].map(([val, label]) => (
              <label key={label} className="cursor-pointer">
                <input type="radio" name="durum" value={val} defaultChecked={(values.durum ?? "") === val} className="peer sr-only" />
                <span className="block rounded-md px-2 py-2 text-center text-zinc-500 transition peer-checked:bg-white peer-checked:text-ink peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </Group>

        <div className="sticky bottom-0 border-t border-zinc-100 bg-white p-4">
          <button className="btn-primary w-full py-3">Filtrele</button>
        </div>
      </form>
    </div>
  );
}
