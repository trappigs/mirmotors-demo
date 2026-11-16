"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BODY_TYPES, EQUIPMENT_OPTIONS, FUEL_TYPES, TRANSMISSIONS } from "@/lib/constants";
import { DETAIL_FILTER_KEYS } from "@/lib/vehicle-filters";

type Values = Record<string, string | undefined>;
type Catalog = { catalog: Record<string, Record<string, string[]>>; colors: string[]; drivetrains: string[] };

function Group({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <fieldset className="border-t border-zinc-100 py-4 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <p className="label">{title}</p>
      {children}
      {hint && <p className="mt-1.5 text-[11px] leading-snug text-muted">{hint}</p>}
    </fieldset>
  );
}

/** Var / Yok / Tümü seçimi (bilinmeyen bilgi hiçbir zaman "Yok" sonucuna girmez — sunucuda uygulanır). */
function YesNo({ name, values, labels = ["Var", "Yok"] }: { name: string; values: Values; labels?: [string, string] }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 text-xs font-semibold">
      {[["", "Tümü"], ["var", labels[0]], ["yok", labels[1]]].map(([val, label]) => (
        <label key={val} className="cursor-pointer">
          <input type="radio" name={name} value={val} defaultChecked={(values[name] ?? "") === val} className="peer sr-only" />
          <span className="block rounded-lg px-2 py-2 text-center text-zinc-500 transition peer-checked:bg-ink peer-checked:text-white peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
            {label}
          </span>
        </label>
      ))}
    </div>
  );
}

/**
 * "Detaylı Filtreler" düğmesi + sağdan (mobilde tam ekran) açılan panel. Tüm filtreler URL parametresi olarak
 * GET ile gönderilir ve sunucuda gerçek veritabanı sorgusuna çevrilir. Seçenekler yalnızca yayındaki araçlardan gelir.
 */
export function FilterPanel({ catalog, values, sort }: { catalog: Catalog; values: Values; sort: string }) {
  const [brand, setBrand] = useState(values.marka ?? "");
  const [model, setModel] = useState(brand === values.marka ? values.model ?? "" : "");
  const [open, setOpen] = useState(false);
  const models = brand ? Object.keys(catalog.catalog[brand] ?? {}) : [];
  const packages = brand && model ? catalog.catalog[brand]?.[model] ?? [] : [];
  const equipment = new Set((values.donanim ?? "").split(",").filter(Boolean));
  const activeCount = DETAIL_FILTER_KEYS.filter((k) => values[k]).length;

  // Tarayıcıda "geri" ile dönülünce (bfcache) gönderim sırasında kapatılan boş alanları yeniden aç.
  useEffect(() => {
    const onShow = () => document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-testid=filter-form] [disabled]").forEach((el) => {
      if (el.dataset.testid !== "f-model" && el.dataset.testid !== "f-paket") el.disabled = false;
    });
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

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
          <input name={name} aria-label={`${i ? "Maks" : "Min"} ${unit}`} defaultValue={values[name] ?? ""} inputMode="numeric" pattern="[0-9.]*" placeholder={i ? "Maks" : "Min"} className="input pr-10" />
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
      <button type="button" onClick={() => setOpen(true)} className="btn-outline h-11 w-full rounded-xl bg-white px-4 font-bold sm:w-auto" aria-expanded={open} data-testid="open-filters">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        Detaylı Filtreler
        {activeCount > 0 && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] text-white">{activeCount}</span>}
      </button>

      {/* Panel her zaman DOM'da kalır (form değerleri korunur); kapalıyken görünmez */}
      <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open} inert={!open}>
        <div className={`absolute inset-0 bg-ink/50 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={() => setOpen(false)} />
        <form
          action="/araclar"
          role="dialog"
          aria-label="Detaylı filtreler"
          data-testid="filter-form"
          onSubmit={(e) => {
            // Donanım onay kutuları tek parametrede (virgülle) birleştirilir; boş alanlar gönderilmez.
            const form = e.currentTarget;
            const picked = Array.from(form.querySelectorAll<HTMLInputElement>("input[data-equipment]:checked")).map((el) => el.value);
            const hidden = form.querySelector<HTMLInputElement>("input[name=donanim]")!;
            hidden.value = picked.join(",");
            for (const el of Array.from(form.elements)) {
              // "Tümü" seçenekleri (boş değerli radyo) dahil boş alanlar URL'ye yazılmaz.
              if ((el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && el.value === "") {
                el.disabled = true;
              }
            }
          }}
          className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        >
          <input type="hidden" name="sirala" value={sort} />
          <input type="hidden" name="donanim" defaultValue={values.donanim ?? ""} />
          {values.q && <input type="hidden" name="q" value={values.q} />}
          {values.gorunum && <input type="hidden" name="gorunum" value={values.gorunum} />}
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 sm:px-6">
            <p className="font-display text-lg font-bold">Detaylı Filtreler</p>
            <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-ink" aria-label="Kapat">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <Group title="Marka / Model / Seri">
              <div className="space-y-2">
                <select id="marka" name="marka" aria-label="Marka" value={brand} onChange={(e) => { setBrand(e.target.value); setModel(""); }} className="input" data-testid="f-marka">
                  <option value="">Tüm markalar</option>
                  {Object.keys(catalog.catalog).map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <select id="model" name="model" aria-label="Model" value={model} onChange={(e) => setModel(e.target.value)} disabled={!brand} className="input" data-testid="f-model">
                  <option value="">{brand ? "Tüm modeller" : "Önce marka seçin"}</option>
                  {models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select id="paket" name="paket" aria-label="Seri / donanım paketi" key={`${brand}/${model}`} defaultValue={brand === values.marka && model === values.model ? values.paket ?? "" : ""} disabled={!model || packages.length === 0} className="input" data-testid="f-paket">
                  <option value="">{!model ? "Önce model seçin" : packages.length ? "Tüm seriler / paketler" : "Bu modelde paket bilgisi yok"}</option>
                  {packages.map((p) => <option key={p} value={p}>{p}</option>)}
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
            <div className="grid grid-cols-2 gap-x-3">
              <Group title="Kasa tipi">{select("kasa", "Kasa tipi", BODY_TYPES)}</Group>
              <Group title="Renk">{select("renk", "Renk", catalog.colors)}</Group>
            </div>
            <Group title="Durum">
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 text-xs font-semibold">
                {[["", "Tümü"], ["AVAILABLE", "Satışta"], ["OPTIONED", "Opsiyonlu"]].map(([val, label]) => (
                  <label key={label} className="cursor-pointer">
                    <input type="radio" name="durum" value={val} defaultChecked={(values.durum ?? "") === val} className="peer sr-only" />
                    <span className="block rounded-lg px-2 py-2 text-center text-zinc-500 transition peer-checked:bg-ink peer-checked:text-white peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </Group>

            <p className="mt-2 border-t-2 border-zinc-900/80 pt-4 font-display text-sm font-bold">Gelişmiş filtreler</p>
            <Group title="Motor hacmi">{range("minCc", "maxCc", "cc")}</Group>
            <Group title="Motor gücü">{range("minHp", "maxHp", "hp")}</Group>
            <Group title="Çekiş">{select("cekis", "Çekiş", catalog.drivetrains)}</Group>
            <Group title="Boyalı parça" hint="&quot;Yok&quot; yalnızca tüm parçaları doğrulanmış araçları gösterir.">
              <YesNo name="boyali" values={values} />
            </Group>
            <Group title="Lokal boyalı parça"><YesNo name="lokal" values={values} /></Group>
            <Group title="Değişen parça"><YesNo name="degisen" values={values} /></Group>
            <Group title="Hasar kaydı" hint="Hasar bilgisi girilmemiş araçlar bu filtrelere dahil edilmez."><YesNo name="hasar" values={values} /></Group>
            <Group title="Ağır hasar kaydı"><YesNo name="agirHasar" values={values} /></Group>
            <Group title="Ekspertiz raporu"><YesNo name="ekspertiz" values={values} labels={["Mevcut", "Yok"]} /></Group>
            <Group title="Donanım" hint="Seçilen donanımların hepsine sahip araçlar listelenir.">
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <label key={eq} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-2 text-[13px] has-[:checked]:border-ink has-[:checked]:bg-zinc-50">
                    <input type="checkbox" value={eq} data-equipment defaultChecked={equipment.has(eq)} className="accent-[#141416]" />
                    {eq}
                  </label>
                ))}
              </div>
            </Group>
          </div>

          <div className="flex gap-3 border-t border-zinc-200 px-5 py-4 sm:px-6">
            <Link href="/araclar" className="btn-outline flex-1 rounded-xl py-3" data-testid="clear-filters">Temizle</Link>
            <button className="btn-primary flex-[2] rounded-xl py-3 font-bold" data-testid="apply-filters">Filtrele</button>
          </div>
        </form>
      </div>
    </>
  );
}
