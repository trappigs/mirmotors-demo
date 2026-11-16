// Müşteri sitesi filtreleri: URL parametrelerini okur ve Prisma sorgu koşuluna çevirir.
// Saf fonksiyonlar (veritabanı içe aktarmaz) — birim testleri doğrudan kullanır.
import type { Prisma } from "@prisma/client";
import { PUBLIC_STATUSES } from "./constants";

export type SearchParams = Record<string, string | string[] | undefined>;

export const SORTS = {
  new: { label: "Yeni eklenenler", orderBy: { publishedAt: "desc" } },
  price_asc: { label: "Fiyat (artan)", orderBy: { price: "asc" } },
  price_desc: { label: "Fiyat (azalan)", orderBy: { price: "desc" } },
  km_asc: { label: "Kilometre (artan)", orderBy: { km: "asc" } },
  year_desc: { label: "Model yılı (yeni → eski)", orderBy: { year: "desc" } },
  year_asc: { label: "Model yılı (eski → yeni)", orderBy: { year: "asc" } },
} satisfies Record<string, { label: string; orderBy: Prisma.VehicleOrderByWithRelationInput }>;
export type SortKey = keyof typeof SORTS;

export const PAGE_SIZE = 12;

/** var / yok seçimli filtreler (bilinmeyen bilgi hiçbir zaman "yok" sonucuna girmez). */
export type YesNo = "var" | "yok";

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const num = (v: string | string[] | undefined) => {
  const s = str(v)?.replace(/\./g, "").replace(/\s/g, "");
  if (!s || !/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : undefined;
};
const yesNo = (v: string | string[] | undefined): YesNo | undefined => {
  const s = str(v);
  return s === "var" || s === "yok" ? s : undefined;
};
/** Ters girilmiş aralığı (min > maks) düzeltir. */
const ordered = (min?: number, max?: number): [number | undefined, number | undefined] =>
  min !== undefined && max !== undefined && min > max ? [max, min] : [min, max];

export function parseFilters(sp: SearchParams) {
  const status = str(sp.durum);
  const sort = str(sp.sirala);
  const [minPrice, maxPrice] = ordered(num(sp.minFiyat), num(sp.maxFiyat));
  const [minYear, maxYear] = ordered(num(sp.minYil), num(sp.maxYil));
  const [minKm, maxKm] = ordered(num(sp.minKm), num(sp.maxKm));
  const [minCc, maxCc] = ordered(num(sp.minCc), num(sp.maxCc));
  const [minHp, maxHp] = ordered(num(sp.minHp), num(sp.maxHp));
  const page = num(sp.sayfa);
  return {
    q: str(sp.q)?.slice(0, 80),
    brand: str(sp.marka),
    model: str(sp.model),
    packageName: str(sp.paket),
    minPrice, maxPrice, minYear, maxYear, minKm, maxKm, minCc, maxCc, minHp, maxHp,
    fuel: str(sp.yakit),
    transmission: str(sp.vites),
    bodyType: str(sp.kasa),
    color: str(sp.renk),
    drivetrain: str(sp.cekis),
    status: status === "AVAILABLE" || status === "OPTIONED" ? status : undefined,
    painted: yesNo(sp.boyali),
    changed: yesNo(sp.degisen),
    localPaint: yesNo(sp.lokal),
    damage: yesNo(sp.hasar),
    heavyDamage: yesNo(sp.agirHasar),
    expertise: yesNo(sp.ekspertiz),
    equipment: (str(sp.donanim) ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10),
    sort: (sort && sort in SORTS ? sort : "new") as SortKey,
    page: page && page > 0 ? page : 1,
    view: (str(sp.gorunum) === "liste" ? "list" : "grid") as "grid" | "list",
  };
}
export type Filters = ReturnType<typeof parseFilters>;

const range = (min?: number, max?: number) =>
  min === undefined && max === undefined ? undefined : { ...(min !== undefined && { gte: min }), ...(max !== undefined && { lte: max }) };

/** Parça sayacı filtresi: "var" en az bir parça; "yok" yalnızca TÜM parçalar doğrulanmış ve hiçbiri o durumda değilse. */
function partFilter(v: YesNo | undefined, field: "paintedCount" | "localPaintCount" | "changedCount"): Prisma.VehicleWhereInput[] {
  if (v === "var") return [{ [field]: { gt: 0 } }];
  if (v === "yok") return [{ bodyVerified: true, [field]: 0 }];
  return [];
}

/** Yalnızca Satışta ve Opsiyonlu araçlar müşteriye görünür; satış bekleyen / satılan / taslak hiçbir filtreyle gelmez. */
export function buildPublicWhere(f: Filters): Prisma.VehicleWhereInput {
  const and: Prisma.VehicleWhereInput[] = [
    // Metin araması: her kelime marka, model veya pakette geçmeli (büyük/küçük harf duyarsız).
    ...(f.q ?? "").split(/\s+/).filter(Boolean).slice(0, 6).map((w) => ({
      OR: [
        { brand: { contains: w, mode: "insensitive" as const } },
        { model: { contains: w, mode: "insensitive" as const } },
        { packageName: { contains: w, mode: "insensitive" as const } },
      ],
    })),
    ...partFilter(f.painted, "paintedCount"),
    ...partFilter(f.changed, "changedCount"),
    ...partFilter(f.localPaint, "localPaintCount"),
    // Hasar kaydı bilgisi girilmemiş (null) araç hiçbir hasar filtresine girmez.
    ...(f.damage === "yok" ? [{ damageRecord: "NONE" }] : f.damage === "var" ? [{ damageRecord: { in: ["MINOR", "HEAVY"] } }] : []),
    ...(f.heavyDamage === "yok" ? [{ damageRecord: { in: ["NONE", "MINOR"] } }] : f.heavyDamage === "var" ? [{ damageRecord: "HEAVY" }] : []),
    ...(f.expertise === "var" ? [{ expertisePdfPath: { not: null } }] : f.expertise === "yok" ? [{ expertisePdfPath: null }] : []),
    // Donanım JSON dizisi olarak saklanır; tırnaklı arama tam eşleşme sağlar.
    ...f.equipment.map((e) => ({ equipment: { contains: JSON.stringify(e) } })),
  ];
  return {
    status: f.status ? f.status : { in: PUBLIC_STATUSES },
    brand: f.brand,
    model: f.model,
    packageName: f.packageName,
    price: range(f.minPrice, f.maxPrice),
    year: range(f.minYear, f.maxYear),
    km: range(f.minKm, f.maxKm),
    engineCc: range(f.minCc, f.maxCc),
    enginePower: range(f.minHp, f.maxHp),
    fuel: f.fuel,
    transmission: f.transmission,
    bodyType: f.bodyType,
    color: f.color,
    drivetrain: f.drivetrain,
    AND: and,
  };
}

export function orderByFor(f: Filters): Prisma.VehicleOrderByWithRelationInput[] {
  return [SORTS[f.sort].orderBy, { createdAt: "desc" }, { id: "asc" }];
}

/** Hızlı fiyat aralığı seçimleri (TL). */
export const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: "1,5 milyon altı", max: 1_500_000 },
  { label: "1,5 – 2,5 milyon", min: 1_500_000, max: 2_500_000 },
  { label: "2,5 – 3,5 milyon", min: 2_500_000, max: 3_500_000 },
  { label: "3,5 – 5 milyon", min: 3_500_000, max: 5_000_000 },
  { label: "5 milyon üzeri", min: 5_000_000 },
];

/** "Detaylı filtreler" panelindeki parametreler (etkin filtre sayısı ve temizleme için). */
export const DETAIL_FILTER_KEYS = [
  "marka", "model", "paket", "minFiyat", "maxFiyat", "minYil", "maxYil", "minKm", "maxKm", "yakit", "vites", "kasa", "durum",
  "renk", "minCc", "maxCc", "minHp", "maxHp", "cekis", "boyali", "degisen", "lokal", "hasar", "agirHasar", "ekspertiz", "donanim",
];
