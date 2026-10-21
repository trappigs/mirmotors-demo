import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterPanel } from "@/components/site/FilterPanel";
import { SortSelect } from "@/components/site/SortSelect";
import { VehicleCard } from "@/components/site/VehicleCard";
import { SORTS, findPublicVehicles, parseFilters, publicBrandModels, type SearchParams } from "@/lib/public-vehicles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Araçlarımız" };

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [vehicles, brandModels] = await Promise.all([findPublicVehicles(filters), publicBrandModels()]);
  const values = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Araçlarımız</h1>
          <p className="mt-1 text-sm text-zinc-500" data-testid="result-count">{vehicles.length} araç bulundu</p>
        </div>
        <Suspense>
          <SortSelect options={Object.entries(SORTS).map(([key, s]) => ({ key, label: s.label }))} value={filters.sort} />
        </Suspense>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside>
          <FilterPanel key={JSON.stringify(values)} brandModels={brandModels} values={values} sort={filters.sort} />
        </aside>
        <section>
          {vehicles.length === 0 ? (
            <div className="card p-10 text-center text-zinc-500">Bu kriterlere uygun araç bulunamadı.</div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {vehicles.map((v) => (
                <VehicleCard key={v.id} vehicle={v} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
