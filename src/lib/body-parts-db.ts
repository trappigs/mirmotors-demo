// Kaporta parçalarının veritabanı işlemleri (her parça ayrı satır) ve filtre sayaçlarının güncellenmesi.
import type { Prisma, PrismaClient } from "@prisma/client";
import { BODY_PART_LABELS, PART_STATE_INFO, summarizeParts, toPartMap, type BodyPartKey, type PartState } from "./body-parts";

type Tx = Prisma.TransactionClient;
export type PartUpdate = { part: BodyPartKey; state?: PartState; reportState?: PartState };

/** Parçaların sayaçlarını (boyalı / lokal / değişen / tümü doğrulandı) araç satırına yazar. */
export async function recomputeBodySummary(tx: Tx, vehicleId: string) {
  const rows = await tx.vehiclePart.findMany({ where: { vehicleId } });
  const s = summarizeParts(toPartMap(rows));
  await tx.vehicle.update({
    where: { id: vehicleId },
    data: { bodyVerified: s.bodyVerified, paintedCount: s.paintedCount, localPaintCount: s.localPaintCount, changedCount: s.changedCount },
  });
  return s;
}

/**
 * Parça durumlarını kaydeder: değişen her parça için personel ve tarih (updatedById/updatedAt) yazılır,
 * işlem geçmişine okunur bir not düşülür ve filtre sayaçları yeniden hesaplanır.
 */
export async function saveVehicleParts(db: PrismaClient | Tx, vehicleId: string, updates: PartUpdate[], userId: string) {
  const run = async (tx: Tx) => {
    const before = await tx.vehiclePart.findMany({ where: { vehicleId } });
    const staffBefore = toPartMap(before);
    const reportBefore = toPartMap(before, "reportState");
    const changes: string[] = [];
    for (const u of updates) {
      const state = u.state ?? staffBefore[u.part];
      const reportState = u.reportState ?? reportBefore[u.part];
      if (state === staffBefore[u.part] && reportState === reportBefore[u.part]) continue;
      await tx.vehiclePart.upsert({
        where: { vehicleId_part: { vehicleId, part: u.part } },
        create: { vehicleId, part: u.part, state, reportState, updatedById: userId },
        update: { state, reportState, updatedById: userId },
      });
      if (state !== staffBefore[u.part]) changes.push(`${BODY_PART_LABELS[u.part]}: ${PART_STATE_INFO[state].label}`);
      if (reportState !== reportBefore[u.part]) changes.push(`${BODY_PART_LABELS[u.part]} (ekspertiz): ${PART_STATE_INFO[reportState].label}`);
    }
    const summary = await recomputeBodySummary(tx, vehicleId);
    if (changes.length) {
      const v = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId }, select: { status: true } });
      await tx.statusHistory.create({
        data: { vehicleId, fromStatus: v.status, toStatus: v.status, action: "bodyParts", userId, note: changes.join(" · ").slice(0, 1000) },
      });
    }
    return { changed: changes.length, summary };
  };
  return "$transaction" in db ? (db as PrismaClient).$transaction(run) : run(db as Tx);
}
