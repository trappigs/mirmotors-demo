import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FilterPanel } from "@/components/site/FilterPanel";
import { SortSelect } from "@/components/site/SortSelect";
import { VehicleCard } from "@/components/site/VehicleCard";
import { SORTS, findPublicVehicles, parseFilters, publicBrandModels, type SearchParams } from "@/lib/public-vehicles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Araçlarımız" };

const nf = new Intl.NumberFormat("tr-TR");
const num = (v: string) => (/^\d+$/.test(v.replace(/\./g, "")) ? nf.format(Number(v.replace(/\./g, ""))) : v);

/** Seçili filtreleri okunur etiketlere çevirir; her etiket kendi parametresini kaldıran bağlantıya sahiptir. */
function activeFilterChips(values: Record<string, string | undefined>) {
  const range = (min: string, max: string, unit: string, label: string) => {
    const a = values[min], b = values[max];
    if (!a && !b) return null;
    const text = a && b ? `${num(a)} – ${num(b)}` : a ? `${num(a)}+` : `≤ ${num(b!)}`;
    return { keys: [min, max], text: `${label}: ${text}${unit}` };
  };
  const one = (k: string, label?: string, map?: Record<string, string>) =>
    values[k] ? { keys: k === "marka" ? ["marka", "model"] : [k], text: `${label ? label + ": " : ""}${map?.[values[k]!] ?? values[k]}` } : null;
  const chips = [
    one("marka"),
    one("model"),
    range("minFiyat", "maxFiyat", " TL", "Fiyat"),
    range("minYil", "maxYil", "", "Yıl"),
    range("minKm", "maxKm", " km", "Km"),
    one("yakit"),
    one("vites"),
    one("kasa"),
    one("durum", undefined, { AVAILABLE: "Satışta", OPTIONED: "Opsiyonlu" }),
  ].filter((c): c is { keys: string[]; text: string } => Boolean(c));

  return chips.map((c) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(values)) if (v && !c.keys.includes(k)) params.set(k, v);
    const qs = params.toString();
    return { text: c.text, href: qs ? `/araclar?${qs}` : "/araclar" };
  });
}

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [vehicles, brandModels] = await Promise.all([findPublicVehicles(filters), publicBrandModels()]);
  const values = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const chips = activeFilterChips(values);

  return (
    <>
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_120%_at_90%_0%,rgba(201,165,107,0.18),transparent_60%),linear-gradient(180deg,#0e1015,#111a2b)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <p className="eyebrow-light">Stok</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">Araçlarımız</h1>
          <p className="mt-3 max-w-xl text-zinc-400">Ekspertiz özetli, gerçek fotoğraflı seçkin ikinci el otomobiller.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:rounded-2xl lg:pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterPanel key={JSON.stringify(values)} brandModels={brandModels} values={values} sort={filters.sort} />
          </aside>

          <section className="min-w-0">
            <div className="card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <p className="text-sm text-zinc-600" data-testid="result-count">
                <span className="font-display text-lg font-bold text-ink">{vehicles.length}</span> araç bulundu
              </p>
              <Suspense>
                <SortSelect options={Object.entries(SORTS).map(([key, s]) => ({ key, label: s.label }))} value={filters.sort} />
              </Suspense>
            </div>

            {chips.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Seçili filtreler">
                {chips.map((c) => (
                  <Link key={c.text} href={c.href} className="chip border-accent/50 bg-accent/10 text-ink" title="Filtreyi kaldır">
                    {c.text} <span aria-hidden className="text-zinc-500">×</span>
                  </Link>
                ))}
                <Link href="/araclar" className="ml-1 text-xs font-semibold text-zinc-500 underline-offset-4 hover:text-ink hover:underline">
                  Tümünü temizle
                </Link>
              </div>
            )}

            {vehicles.length === 0 ? (
              <div className="card mt-6 px-6 py-16 text-center">
                <p className="font-display text-lg font-semibold">Bu kriterlere uygun araç bulunamadı.</p>
                <p className="mt-2 text-sm text-zinc-500">Filtreleri genişletmeyi deneyin veya danışmanımıza yazın.</p>
                <Link href="/araclar" className="btn-outline mt-6">Filtreleri temizle</Link>
              </div>
            ) : (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {vehicles.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
