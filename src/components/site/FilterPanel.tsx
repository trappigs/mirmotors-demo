"use client";
import Link from "next/link";
import { useState } from "react";
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS } from "@/lib/constants";

type Values = Record<string, string | undefined>;

export function FilterPanel({ brandModels, values, sort }: { brandModels: Record<string, string[]>; values: Values; sort: string }) {
  const [brand, setBrand] = useState(values.marka ?? "");
  const [open, setOpen] = useState(false);
  const models = brand ? brandModels[brand] ?? [] : [];

  const field = (name: string, placeholder: string) => (
    <input name={name} defaultValue={values[name] ?? ""} inputMode="numeric" placeholder={placeholder} className="input" />
  );
  const select = (name: string, label: string, options: string[]) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={values[name] ?? ""} className="input">
        <option value="">Tümü</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn-outline w-full lg:hidden">
        {open ? "Filtreleri gizle" : "Filtrele"}
      </button>
      <form action="/araclar" className={`${open ? "block" : "hidden"} card mt-3 space-y-4 p-5 lg:mt-0 lg:block`}>
        <input type="hidden" name="sirala" value={sort} />
        <div>
          <label className="label" htmlFor="marka">Marka</label>
          <select id="marka" name="marka" value={brand} onChange={(e) => setBrand(e.target.value)} className="input">
            <option value="">Tüm markalar</option>
            {Object.keys(brandModels).map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="model">Model</label>
          <select id="model" name="model" key={brand} defaultValue={brand === values.marka ? values.model ?? "" : ""} disabled={!brand} className="input">
            <option value="">{brand ? "Tüm modeller" : "Önce marka seçin"}</option>
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">Fiyat (TL)</span>
          <div className="grid grid-cols-2 gap-2">{field("minFiyat", "Min")}{field("maxFiyat", "Maks")}</div>
        </div>
        <div>
          <span className="label">Model yılı</span>
          <div className="grid grid-cols-2 gap-2">{field("minYil", "Min")}{field("maxYil", "Maks")}</div>
        </div>
        <div>
          <span className="label">Kilometre</span>
          <div className="grid grid-cols-2 gap-2">{field("minKm", "Min")}{field("maxKm", "Maks")}</div>
        </div>
        {select("yakit", "Yakıt", FUEL_TYPES)}
        {select("vites", "Vites", TRANSMISSIONS)}
        {select("kasa", "Kasa tipi", BODY_TYPES)}
        <div>
          <label className="label" htmlFor="durum">Durum</label>
          <select id="durum" name="durum" defaultValue={values.durum ?? ""} className="input">
            <option value="">Tümü</option>
            <option value="AVAILABLE">Satışta</option>
            <option value="OPTIONED">Opsiyonlu</option>
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button className="btn-primary flex-1">Filtrele</button>
          <Link href="/araclar" className="btn-outline">Temizle</Link>
        </div>
      </form>
    </div>
  );
}
