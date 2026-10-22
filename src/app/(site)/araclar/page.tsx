import type { Metadata } from "next";
import Link from "next/link";
import { FilterPanel } from "@/components/site/FilterPanel";
import { SortSelect } from "@/components/site/SortSelect";
import { VehicleCard, VehicleRow } from "@/components/site/VehicleCard";
import { PRICE_PRESETS, SORTS, findPublicVehicles, parseFilters, publicBrandModels, type SearchParams } from "@/lib/public-vehicles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tüm Araçlarımız" };

type Values = Record<string, string | undefined>;

const nf = new Intl.NumberFormat("tr-TR");
const num = (v: string) => (/^\d+$/.test(v.replace(/\./g, "")) ? nf.format(Number(v.replace(/\./g, ""))) : v);

/** Mevcut parametreleri koruyarak verilen anahtarları değiştiren (undefined → kaldırır) bağlantı üretir. */
function hrefWith(values: Values, patch: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...values, ...patch })) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `/araclar?${qs}` : "/araclar";
}

/** Hızlı seçim etiketi: aktifse tıklayınca kaldırır, değilse uygular. */
function quick(values: Values, patch: Record<string, string | undefined>) {
  const active = Object.entries(patch).every(([k, v]) => (values[k] || undefined) === v);
  const off = Object.fromEntries(Object.keys(patch).map((k) => [k, undefined]));
  return { active, href: hrefWith(values, active ? off : patch) };
}

/** Seçili filtreleri okunur etiketlere çevirir; her etiket kendi parametresini kaldırır. */
function activeFilterChips(values: Values) {
  const range = (min: string, max: string, unit: string, label: string) => {
    const a = values[min], b = values[max];
    if (!a && !b) return null;
    const text = a && b ? `${num(a)} – ${num(b)}` : a ? `${num(a)}+` : `≤ ${num(b!)}`;
    return { keys: [min, max], text: `${label}: ${text}${unit}` };
  };
  const one = (k: string, label?: string, map?: Record<string, string>) =>
    values[k] ? { keys: k === "marka" ? ["marka", "model"] : [k], text: `${label ? label + ": " : ""}${map?.[values[k]!] ?? values[k]}` } : null;
  return [
    one("q", "Arama"),
    one("marka"),
    one("model"),
    range("minFiyat", "maxFiyat", " TL", "Fiyat"),
    range("minYil", "maxYil", "", "Yıl"),
    range("minKm", "maxKm", " km", "Km"),
    one("yakit"),
    one("vites"),
    one("kasa"),
    one("durum", undefined, { AVAILABLE: "Satışta", OPTIONED: "Opsiyonlu" }),
  ]
    .filter((c): c is { keys: string[]; text: string } => Boolean(c))
    .map((c) => ({ text: c.text, href: hrefWith(values, Object.fromEntries(c.keys.map((k) => [k, undefined]))) }));
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition ${
        active ? "border-brand bg-brand text-white shadow-[0_4px_10px_-4px_rgba(186,16,32,0.6)]" : "border-line bg-white text-ink hover:border-brand hover:text-brand"
      }`}
    >
      {children}
      {active && <span aria-hidden className="text-white/80">×</span>}
    </Link>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="section-mark mb-2 text-[13px] font-bold text-ink">{children}</p>;
}

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [vehicles, brandModels] = await Promise.all([findPublicVehicles(filters), publicBrandModels()]);
  const values: Values = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const chips = activeFilterChips(values);
  const optionedCount = vehicles.filter((v) => v.status === "OPTIONED").length;
  const isList = filters.view === "list";

  // Arama formu kendi alanları dışındaki seçili filtreleri gizli alanlarla korur.
  const searchOwn = ["q", "maxFiyat", "durum"];
  const keep = Object.entries(values).filter(([k, v]) => v && !searchOwn.includes(k));

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-7 sm:px-6 md:pt-8">
      {/* Başlık + görünüm + sıralama */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-brand md:text-[28px]">Tüm Araçlarımız</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-line bg-white p-1 shadow-sm" role="group" aria-label="Görünüm">
            <Link href={hrefWith(values, { gorunum: "liste" })} aria-label="Liste görünümü" aria-pressed={isList}
              className={`grid h-9 w-9 place-items-center rounded-lg transition ${isList ? "bg-ink text-white" : "text-muted hover:text-brand"}`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>
            </Link>
            <Link href={hrefWith(values, { gorunum: undefined })} aria-label="Izgara görünümü" aria-pressed={!isList}
              className={`grid h-9 w-9 place-items-center rounded-lg transition ${!isList ? "bg-ink text-white" : "text-muted hover:text-brand"}`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>
            </Link>
          </div>
          <SortSelect
            options={Object.entries(SORTS).map(([key, s]) => ({ key, label: s.label }))}
            value={filters.sort}
            params={Object.fromEntries(Object.entries(values).filter((e): e is [string, string] => Boolean(e[1])))}
          />
        </div>
      </div>

      {/* Geniş arama alanı */}
      <section className="mt-5 rounded-2xl bg-white p-5 shadow-[0_6px_24px_-10px_rgba(16,24,40,0.18)] ring-1 ring-black/[0.04] md:px-6 md:py-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="shrink-0">
            <p className="font-display text-xl font-bold text-ink">Araçlar</p>
            <p className="mt-0.5 text-[13px] text-muted" data-testid="result-count">
              {vehicles.length} ilan listeleniyor · {vehicles.length - optionedCount} satışta, {optionedCount} opsiyonlu
            </p>
          </div>
          <form action="/araclar" className="grid flex-1 grid-cols-2 gap-2.5 lg:max-w-3xl lg:grid-cols-[1.6fr_1fr_0.9fr_auto]">
            {keep.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <input name="q" defaultValue={values.q ?? ""} placeholder="Marka, model veya paket ara" aria-label="Marka, model veya paket ara" className="input h-12 rounded-xl bg-white col-span-2 lg:col-span-1" />
            <input name="maxFiyat" defaultValue={values.maxFiyat ?? ""} inputMode="numeric" placeholder="Maks. fiyat (TL)" aria-label="Maksimum fiyat" className="input h-12 rounded-xl" />
            <select name="durum" defaultValue={values.durum ?? ""} aria-label="Durum" className="input h-12 rounded-xl">
              <option value="">Tüm durumlar</option>
              <option value="AVAILABLE">Satışta</option>
              <option value="OPTIONED">Opsiyonlu</option>
            </select>
            <button className="btn-primary col-span-2 h-12 rounded-xl px-9 text-[15px] font-bold lg:col-span-1" data-testid="search-submit">Ara</button>
          </form>
        </div>
      </section>

      {/* Yatay hızlı filtreler */}
      <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0 space-y-3">
          <div>
            <GroupLabel>Fiyat aralığı</GroupLabel>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
              {PRICE_PRESETS.map((p) => {
                const c = quick(values, { minFiyat: p.min?.toString(), maxFiyat: p.max?.toString() });
                return <Chip key={p.label} {...c}>{p.label}</Chip>;
              })}
            </div>
          </div>
          <div>
            <GroupLabel>Kasa tipi ve durum</GroupLabel>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
              {["SUV", "Sedan", "Hatchback", "Coupe"].map((k) => {
                const c = quick(values, { kasa: k });
                return <Chip key={k} {...c}>{k}</Chip>;
              })}
              <span className="mx-1 hidden w-px self-stretch bg-line sm:block" />
              {[["AVAILABLE", "Satışta"], ["OPTIONED", "Opsiyonlu"]].map(([val, label]) => {
                const c = quick(values, { durum: val });
                return <Chip key={val} {...c}>{label}</Chip>;
              })}
            </div>
          </div>
        </div>
        <div>
          <FilterPanel key={JSON.stringify(values)} brandModels={brandModels} values={values} sort={filters.sort} />
        </div>
      </section>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-white px-4 py-2.5 ring-1 ring-line" aria-label="Seçili filtreler">
          <span className="mr-1 text-xs font-bold uppercase tracking-[0.1em] text-muted">Seçili:</span>
          {chips.map((c) => (
            <Link key={c.text} href={c.href} className="chip border-brand/30 bg-brand-soft font-semibold text-brand" title="Filtreyi kaldır">
              {c.text} <span aria-hidden>×</span>
            </Link>
          ))}
          <Link href="/araclar" className="ml-1 text-xs font-semibold text-muted underline-offset-4 hover:text-brand hover:underline">Tümünü temizle</Link>
        </div>
      )}

      {/* Sonuçlar */}
      {vehicles.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white px-6 py-16 text-center ring-1 ring-line">
          <p className="font-display text-lg font-semibold">Bu kriterlere uygun araç bulunamadı.</p>
          <p className="mt-2 text-sm text-muted">Filtreleri genişletmeyi deneyin veya danışmanımıza yazın.</p>
          <Link href="/araclar" className="btn-outline mt-6">Filtreleri temizle</Link>
        </div>
      ) : isList ? (
        <div className="mt-6 space-y-4">
          {vehicles.map((v) => <VehicleRow key={v.id} vehicle={v} />)}
        </div>
      ) : (
        <div className="mt-6 grid gap-3.5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
        </div>
      )}
    </div>
  );
}
