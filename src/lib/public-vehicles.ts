import "server-only";
import type { Vehicle } from "@prisma/client";
import { prisma } from "./db";
import { PUBLIC_STATUSES } from "./constants";
import { PAGE_SIZE, buildPublicWhere, orderByFor, type Filters } from "./vehicle-filters";

export { PRICE_PRESETS, SORTS, parseFilters, type Filters, type SearchParams, type SortKey } from "./vehicle-filters";

/** Yayımlanmış araçta bu alanlar her zaman doludur (yayımlama koşulu: src/lib/vehicle-status.ts). */
type Required = "brand" | "model" | "year" | "km" | "price" | "fuel" | "transmission" | "bodyType";
export type Published<T extends Partial<Vehicle>> = Omit<T, Required> & { [K in Required]: NonNullable<Vehicle[K]> };
const published = <T extends Partial<Vehicle>>(v: T) => v as unknown as Published<T>;

const coverPhoto = { orderBy: [{ isCover: "desc" as const }, { sortOrder: "asc" as const }], take: 1 };

/** Filtreye uyan yayındaki araçlar (sayfalı) ve toplam sonuç sayısı. */
export async function findPublicVehicles(f: Filters) {
  const where = buildPublicWhere(f);
  const total = await prisma.vehicle.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  const [rows, optioned] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy: orderByFor(f),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { photos: coverPhoto },
    }),
    prisma.vehicle.count({ where: { AND: [where, { status: "OPTIONED" }] } }),
  ]);
  return { vehicles: rows.map(published), total, optioned, page, pages };
}

/** Ana sayfa (öne çıkanlar ve story şeridi) için yayındaki tüm araçlar, en yeni önce. */
export async function allPublicVehicles() {
  const rows = await prisma.vehicle.findMany({
    where: { status: { in: PUBLIC_STATUSES } },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    include: { photos: coverPhoto },
  });
  return rows.map(published);
}

/**
 * Filtre seçenekleri yalnızca yayındaki araçlardan üretilir (gerçek veritabanı):
 * marka → model → paket bağımlılığı, renkler ve çekiş tipleri.
 */
export async function publicFilterCatalog() {
  const rows = await prisma.vehicle.findMany({
    where: { status: { in: PUBLIC_STATUSES } },
    select: { brand: true, model: true, packageName: true, color: true, drivetrain: true },
  });
  const catalog: Record<string, Record<string, string[]>> = {};
  const colors = new Set<string>();
  const drivetrains = new Set<string>();
  for (const r of rows) {
    if (!r.brand || !r.model) continue;
    const pkgs = ((catalog[r.brand] ??= {})[r.model] ??= []);
    if (r.packageName && !pkgs.includes(r.packageName)) pkgs.push(r.packageName);
    if (r.color) colors.add(r.color);
    if (r.drivetrain) drivetrains.add(r.drivetrain);
  }
  const sortTr = (a: string, b: string) => a.localeCompare(b, "tr");
  const sorted: typeof catalog = {};
  for (const b of Object.keys(catalog).sort(sortTr)) {
    sorted[b] = {};
    for (const m of Object.keys(catalog[b]).sort(sortTr)) sorted[b][m] = catalog[b][m].sort(sortTr);
  }
  return { catalog: sorted, colors: [...colors].sort(sortTr), drivetrains: [...drivetrains].sort(sortTr) };
}
export type FilterCatalog = Awaited<ReturnType<typeof publicFilterCatalog>>;

/** Stokta bulunan marka → model eşlemesi (ana sayfa arama kartı). */
export async function publicBrandModels() {
  const { catalog } = await publicFilterCatalog();
  return Object.fromEntries(Object.entries(catalog).map(([b, models]) => [b, Object.keys(models)]));
}

export async function findPublicVehicle(id: string) {
  const v = await prisma.vehicle.findUnique({
    where: { id },
    include: { photos: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] }, parts: true },
  });
  if (!v || !PUBLIC_STATUSES.includes(v.status as (typeof PUBLIC_STATUSES)[number])) return null;
  return published(v);
}

export type PublicVehicleListItem = Awaited<ReturnType<typeof findPublicVehicles>>["vehicles"][number];
