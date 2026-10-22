import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { PUBLIC_STATUSES } from "./constants";

export type SearchParams = Record<string, string | string[] | undefined>;

export const SORTS = {
  new: { label: "Yeni eklenenler", orderBy: { publishedAt: "desc" } },
  price_asc: { label: "Fiyat (artan)", orderBy: { price: "asc" } },
  price_desc: { label: "Fiyat (azalan)", orderBy: { price: "desc" } },
  km_asc: { label: "Kilometre (artan)", orderBy: { km: "asc" } },
  year_desc: { label: "Model yılı (yeni → eski)", orderBy: { year: "desc" } },
} satisfies Record<string, { label: string; orderBy: Prisma.VehicleOrderByWithRelationInput }>;
export type SortKey = keyof typeof SORTS;

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const num = (v: string | string[] | undefined) => {
  const s = str(v)?.replace(/\./g, "").replace(/\s/g, "");
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
};

export function parseFilters(sp: SearchParams) {
  const status = str(sp.durum);
  const sort = str(sp.sirala);
  return {
    brand: str(sp.marka),
    model: str(sp.model),
    minPrice: num(sp.minFiyat),
    maxPrice: num(sp.maxFiyat),
    minYear: num(sp.minYil),
    maxYear: num(sp.maxYil),
    minKm: num(sp.minKm),
    maxKm: num(sp.maxKm),
    fuel: str(sp.yakit),
    transmission: str(sp.vites),
    bodyType: str(sp.kasa),
    status: status === "AVAILABLE" || status === "OPTIONED" ? status : undefined,
    sort: (sort && sort in SORTS ? sort : "new") as SortKey,
    q: str(sp.q)?.slice(0, 80),
    view: (str(sp.gorunum) === "liste" ? "list" : "grid") as "grid" | "list",
  };
}
export type Filters = ReturnType<typeof parseFilters>;

const range = (min?: number, max?: number) =>
  min === undefined && max === undefined ? undefined : { ...(min !== undefined && { gte: min }), ...(max !== undefined && { lte: max }) };

/** Yalnızca Satışta ve Opsiyonlu araçlar müşteriye görünür. */
export async function findPublicVehicles(f: Filters) {
  const where: Prisma.VehicleWhereInput = {
    status: f.status ? f.status : { in: PUBLIC_STATUSES },
    brand: f.brand,
    model: f.model,
    price: range(f.minPrice, f.maxPrice),
    year: range(f.minYear, f.maxYear),
    km: range(f.minKm, f.maxKm),
    fuel: f.fuel,
    transmission: f.transmission,
    bodyType: f.bodyType,
    // Metin araması: her kelime marka, model veya pakette geçmeli.
    AND: (f.q ?? "").split(/\s+/).filter(Boolean).slice(0, 6).map((w) => ({
      OR: [{ brand: { contains: w } }, { model: { contains: w } }, { packageName: { contains: w } }],
    })),
  };
  return prisma.vehicle.findMany({
    where,
    orderBy: [SORTS[f.sort].orderBy, { createdAt: "desc" }],
    include: { photos: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1 } },
  });
}

/** Stokta bulunan marka → model eşlemesi (filtre seçenekleri için). */
export async function publicBrandModels() {
  const rows = await prisma.vehicle.findMany({
    where: { status: { in: PUBLIC_STATUSES } },
    select: { brand: true, model: true },
    distinct: ["brand", "model"],
    orderBy: [{ brand: "asc" }, { model: "asc" }],
  });
  const map: Record<string, string[]> = {};
  for (const r of rows) (map[r.brand] ??= []).push(r.model);
  return map;
}

export async function findPublicVehicle(id: string) {
  const v = await prisma.vehicle.findUnique({
    where: { id },
    include: { photos: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] } },
  });
  if (!v || !PUBLIC_STATUSES.includes(v.status as (typeof PUBLIC_STATUSES)[number])) return null;
  return v;
}

export type PublicVehicleListItem = Awaited<ReturnType<typeof findPublicVehicles>>[number];

/** Hızlı fiyat aralığı seçimleri (TL). */
export const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: "1,5 milyon altı", max: 1_500_000 },
  { label: "1,5 – 2,5 milyon", min: 1_500_000, max: 2_500_000 },
  { label: "2,5 – 3,5 milyon", min: 2_500_000, max: 3_500_000 },
  { label: "3,5 – 5 milyon", min: 3_500_000, max: 5_000_000 },
  { label: "5 milyon üzeri", min: 5_000_000 },
];
