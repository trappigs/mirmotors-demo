"use client";
import { useState } from "react";

/**
 * Slider altındaki arama kartı. Mevcut /araclar filtrelerine GET ile bağlanır
 * (marka, model, model yılı → minYil = maxYil). Ayrı bir arama mantığı yoktur.
 */
export function HeroSearch({ brandModels, years }: { brandModels: Record<string, string[]>; years: number[] }) {
  const [brand, setBrand] = useState("");
  const [year, setYear] = useState("");
  const models = brand ? brandModels[brand] ?? [] : [];
  return (
    <form
      action="/araclar"
      className="grid gap-3 rounded-2xl bg-white p-4 text-ink shadow-[0_20px_50px_-20px_rgba(16,24,40,0.45)] ring-1 ring-black/[0.05] sm:grid-cols-3 md:grid-cols-[1fr_1fr_1fr_auto] md:p-5"
      data-testid="hero-search"
      onSubmit={(e) => {
        // Boş seçimleri göndermeyerek URL'yi sade tut
        for (const el of Array.from(e.currentTarget.elements)) {
          if (el instanceof HTMLSelectElement && el.value === "") el.disabled = true;
          if (el instanceof HTMLInputElement && el.type === "hidden" && el.value === "") el.disabled = true;
        }
      }}
    >
      <div>
        <label className="label" htmlFor="hs-marka">Marka</label>
        <select id="hs-marka" name="marka" value={brand} onChange={(e) => setBrand(e.target.value)} className="input h-11 rounded-xl">
          <option value="">Seçiniz</option>
          {Object.keys(brandModels).map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="hs-model">Model</label>
        <select id="hs-model" name="model" key={brand} defaultValue="" disabled={!brand} className="input h-11 rounded-xl">
          <option value="">{brand ? "Tüm modeller" : "Önce marka seçin"}</option>
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="hs-yil">Model yılı</label>
        <select id="hs-yil" name="minYil" value={year} onChange={(e) => setYear(e.target.value)} className="input h-11 rounded-xl">
          <option value="">Seçiniz</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <input type="hidden" name="maxYil" value={year} />
      </div>
      <button className="btn-primary h-11 self-end rounded-xl px-8 font-bold sm:col-span-3 md:col-span-1" data-testid="hero-search-submit">Araç Ara →</button>
    </form>
  );
}
