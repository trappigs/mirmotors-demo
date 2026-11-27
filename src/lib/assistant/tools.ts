import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { STATUS_LABELS, VEHICLE_STATUSES, type VehicleStatus } from "../constants";
import { formatKm, formatPrice } from "../format";
import { normalizePlate } from "../plates";

/**
 * WhatsApp asistanının CRM sorgu araçları. Hepsi SALT OKUNUR: hiçbir kaydı değiştirmez (değişiklik: ./actions.ts, personel onayıyla).
 * Çıktı kısa düz metindir (AI'a gider); müşteri kişisel verisi (alıcı, ruhsat sahibi) içermez.
 */

export const vehicleLine = (v: {
  id: string; status: string; brand: string | null; model: string | null; packageName: string | null; year: number | null;
  km: number | null; price: number | null; color: string | null; legalPlate: string | null; stockCode: string | null;
}) =>
  [
    `#${v.id.slice(-6)}`,
    [v.brand, v.model, v.packageName].filter(Boolean).join(" ") || "Marka/model girilmedi",
    v.year ?? "yıl?",
    v.color ?? null,
    formatKm(v.km),
    formatPrice(v.price),
    STATUS_LABELS[v.status as VehicleStatus] ?? v.status,
    v.legalPlate ? `plaka ${v.legalPlate}` : null,
    v.stockCode ? `stok ${v.stockCode}` : null,
  ].filter(Boolean).join(" · ");

export const LINE_SELECT = { id: true, status: true, brand: true, model: true, packageName: true, year: true, km: true, price: true, color: true, legalPlate: true, stockCode: true } as const;

export type SearchArgs = {
  text?: string | null; status?: string | null; color?: string | null; fuel?: string | null; transmission?: string | null;
  minPrice?: number | null; maxPrice?: number | null; minYear?: number | null; maxKm?: number | null; includeSold?: boolean | null; limit?: number | null;
};

export async function searchVehicles(a: SearchArgs): Promise<string> {
  const and: Prisma.VehicleWhereInput[] = [];
  const text = (a.text ?? "").trim();
  // Metin bir plakaysa (boşluklu "34 ABC 123" ya da bitişik) plakayla eşleşen araçlar; değilse kelime kelime arama.
  const looksLikePlate = /\d/.test(text) && /[A-Za-z]/.test(text) && text.split(/\s+/).length <= 3;
  const plateIds = looksLikePlate ? await vehicleIdsByPlate(text, false) : [];
  if (plateIds.length) and.push({ id: { in: plateIds } });
  else {
    const words = text.split(/\s+/).filter((w) => w.length > 1).slice(0, 5);
    for (const w of words) {
      and.push({
        OR: [
          { brand: { contains: w, mode: "insensitive" } }, { model: { contains: w, mode: "insensitive" } },
          { packageName: { contains: w, mode: "insensitive" } }, { color: { contains: w, mode: "insensitive" } },
          { legalPlate: { contains: w, mode: "insensitive" } }, { stockCode: { contains: w, mode: "insensitive" } },
        ],
      });
    }
  }
  if (a.status && (VEHICLE_STATUSES as readonly string[]).includes(a.status)) and.push({ status: a.status });
  else if (!a.includeSold) and.push({ status: { notIn: ["SOLD", "ARCHIVED"] } });
  if (a.color) and.push({ color: { contains: a.color, mode: "insensitive" } });
  if (a.fuel) and.push({ fuel: { equals: a.fuel, mode: "insensitive" } });
  if (a.transmission) and.push({ transmission: { equals: a.transmission, mode: "insensitive" } });
  if (a.minPrice != null) and.push({ price: { gte: a.minPrice } });
  if (a.maxPrice != null) and.push({ price: { lte: a.maxPrice } });
  if (a.minYear != null) and.push({ year: { gte: a.minYear } });
  if (a.maxKm != null) and.push({ km: { lte: a.maxKm } });
  const take = Math.min(Math.max(a.limit ?? 10, 1), 20);
  const where = { AND: and };
  const [rows, total] = await Promise.all([
    prisma.vehicle.findMany({ where, select: LINE_SELECT, orderBy: { updatedAt: "desc" }, take }),
    prisma.vehicle.count({ where }),
  ]);
  if (!rows.length) return "Eşleşen araç yok.";
  return `${total} araç bulundu${total > rows.length ? ` (ilk ${rows.length} gösteriliyor)` : ""}:\n` + rows.map(vehicleLine).join("\n");
}

/**
 * Plakası verilen metinle eşleşen araç kimlikleri. Kayıtlı plaka "34 ABC 123", "34-abc-123" veya "34ABC123" olabilir;
 * karşılaştırma iki tarafta da boşluk/tire/harf büyüklüğü atılarak yapılır. exact=false: plakanın bir kısmı (arama).
 */
export async function vehicleIdsByPlate(text: string, exact: boolean): Promise<string[]> {
  const n = normalizePlate(text);
  if (n.length < (exact ? 2 : 3)) return [];
  const pattern = exact ? n : `%${n}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Vehicle"
    WHERE regexp_replace(upper(coalesce("legalPlate", '')), '[^0-9A-Z]', '', 'g') LIKE ${pattern}
    LIMIT 50`;
  return rows.map((r) => r.id);
}

/** Kısa numara (#abc123, en az 4 karakter), plaka (boşluklu/boşluksuz) ya da stok kodu ile arama koşulu. */
export async function refWhere(ref: string): Promise<Prisma.VehicleWhereInput> {
  const r = ref.trim().replace(/^#/, "");
  const plateIds = await vehicleIdsByPlate(r, true);
  return {
    OR: [
      ...(r.length >= 4 ? [{ id: { endsWith: r } }] : []),
      ...(plateIds.length ? [{ id: { in: plateIds } }] : []),
      { stockCode: { equals: r, mode: "insensitive" } },
    ],
  };
}

export async function getVehicle(ref: string): Promise<string> {
  const v = await prisma.vehicle.findFirst({
    where: await refWhere(ref),
    include: { optionedBy: { select: { name: true } }, createdBy: { select: { name: true } }, _count: { select: { photos: true } } },
  });
  if (!v) return "Bu numara/plaka/stok koduyla araç bulunamadı.";
  const yesNo = (b: boolean | null | undefined) => (b == null ? "girilmedi" : b ? "evet" : "hayır");
  return [
    vehicleLine(v),
    `Yakıt: ${v.fuel ?? "?"} · Vites: ${v.transmission ?? "?"} · Kasa: ${v.bodyType ?? "?"} · Motor: ${v.enginePower ? v.enginePower + " HP" : "?"} ${v.engineCc ? v.engineCc + " cc" : ""}`,
    `Boyalı: ${v.paintedCount} · Lokal boya: ${v.localPaintCount} · Değişen: ${v.changedCount} · Tramer: ${v.tramerAmount == null ? "girilmedi" : formatPrice(v.tramerAmount)} · Kaporta doğrulandı: ${yesNo(v.bodyVerified)}`,
    v.damageNote ? `Hasar notu: ${v.damageNote}` : null,
    v.expertiseSummary ? `Ekspertiz: ${v.expertiseSummary}` : null,
    `Takas: ${yesNo(v.tradeIn)} · Fotoğraf: ${v._count.photos} · Muayene: ${v.inspectionUntil ?? "girilmedi"}`,
    v.status === "OPTIONED" ? `Opsiyonlayan: ${v.optionedBy?.name ?? "?"}${v.optionedAt ? " · " + v.optionedAt.toISOString().slice(0, 10) : ""}` : null,
    `Kaydı açan: ${v.createdBy.name} · Kayıt: ${v.createdAt.toISOString().slice(0, 10)}${v.publishedAt ? " · Yayın: " + v.publishedAt.toISOString().slice(0, 10) : ""}${v.soldAt ? " · Satış: " + v.soldAt.toISOString().slice(0, 10) : ""}`,
    `CRM: /crm/vehicles/${v.id}`,
  ].filter(Boolean).join("\n");
}

export async function stockSummary(days: number): Promise<string> {
  const d = Math.min(Math.max(Math.round(days) || 7, 1), 365);
  const since = new Date(Date.now() - d * 86400_000);
  const [byStatus, soldRows, added] = await Promise.all([
    prisma.vehicle.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.vehicle.findMany({ where: { status: "SOLD", soldAt: { gte: since } }, select: LINE_SELECT, orderBy: { soldAt: "desc" }, take: 20 }),
    prisma.vehicle.count({ where: { createdAt: { gte: since } } }),
  ]);
  const counts = VEHICLE_STATUSES.map((s) => `${STATUS_LABELS[s]}: ${byStatus.find((b) => b.status === s)?._count._all ?? 0}`).join(" · ");
  return [
    `Durumlara göre stok: ${counts}`,
    `Son ${d} günde eklenen araç: ${added}`,
    `Son ${d} günde satılan: ${soldRows.length}${soldRows.length ? "\n" + soldRows.map(vehicleLine).join("\n") : ""}`,
    `("Taslak" ve "Kontrol Bekliyor" yarım kalan kayıtlardır.)`,
  ].join("\n");
}
