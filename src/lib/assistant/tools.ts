import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { STATUS_LABELS, VEHICLE_STATUSES, type VehicleStatus } from "../constants";
import { formatKm, formatPrice } from "../format";

/**
 * WhatsApp asistanının CRM araçları. Hepsi SALT OKUNUR: hiçbir kaydı değiştirmez.
 * Çıktı kısa düz metindir (AI'a gider); müşteri kişisel verisi (alıcı, ruhsat sahibi) içermez.
 */

const vehicleLine = (v: {
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

const LINE_SELECT = { id: true, status: true, brand: true, model: true, packageName: true, year: true, km: true, price: true, color: true, legalPlate: true, stockCode: true } as const;

export type SearchArgs = {
  text?: string | null; status?: string | null; color?: string | null; fuel?: string | null; transmission?: string | null;
  minPrice?: number | null; maxPrice?: number | null; minYear?: number | null; maxKm?: number | null; includeSold?: boolean | null; limit?: number | null;
};

export async function searchVehicles(a: SearchArgs): Promise<string> {
  const and: Prisma.VehicleWhereInput[] = [];
  const words = (a.text ?? "").trim().split(/\s+/).filter((w) => w.length > 1).slice(0, 5);
  for (const w of words) {
    const plate = w.replace(/\s/g, "").toUpperCase();
    and.push({
      OR: [
        { brand: { contains: w, mode: "insensitive" } }, { model: { contains: w, mode: "insensitive" } },
        { packageName: { contains: w, mode: "insensitive" } }, { color: { contains: w, mode: "insensitive" } },
        { legalPlate: { contains: plate, mode: "insensitive" } }, { stockCode: { contains: w, mode: "insensitive" } },
      ],
    });
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

export async function getVehicle(ref: string): Promise<string> {
  const r = ref.trim().replace(/^#/, "");
  const plate = r.replace(/\s/g, "").toUpperCase();
  const v = await prisma.vehicle.findFirst({
    where: { OR: [{ id: { endsWith: r } }, { legalPlate: { equals: plate, mode: "insensitive" } }, { stockCode: { equals: r, mode: "insensitive" } }] },
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
