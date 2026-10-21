// Araç durum makinesi. Tüm geçişler sunucu tarafında, koşullu güncelleme (UPDATE ... WHERE status = ?)
// ile yapılır: aynı anda iki istek gelirse yalnızca biri satırı günceller, diğeri count=0 alır ve reddedilir.
import type { PrismaClient, Prisma } from "@prisma/client";
import { MIN_PHOTOS_TO_PUBLISH, type VehicleStatus } from "./constants";

export type Actor = { id: string; role: "ADMIN" | "SALES" };

export type TransitionResult =
  | { ok: true; status: VehicleStatus }
  | { ok: false; status: number; error: string };

export type TransitionAction =
  | "publish"
  | "unpublish"
  | "option"
  | "releaseOption"
  | "startSale"
  | "cancelSale"
  | "completeSale";

export type TransitionInput = {
  note?: string;
  agreedPrice?: number;
  notaryCompleted?: boolean;
  notaryDate?: Date;
};

type Tx = Prisma.TransactionClient;

const fail = (status: number, error: string): TransitionResult => ({ ok: false, status, error });

async function log(tx: Tx, vehicleId: string, from: VehicleStatus, to: VehicleStatus, action: string, actor: Actor, note?: string) {
  await tx.statusHistory.create({
    data: { vehicleId, fromStatus: from, toStatus: to, action, userId: actor.id, note: note || null },
  });
}

/** Koşullu güncelleme sonrası neden başarısız olduğunu kullanıcıya açıklamak için mevcut durumu okur. */
async function explainConflict(tx: Tx, vehicleId: string, actor: Actor): Promise<TransitionResult> {
  const v = await tx.vehicle.findUnique({ where: { id: vehicleId }, include: { optionedBy: true } });
  if (!v) return fail(404, "Araç bulunamadı");
  if (v.status === "OPTIONED" && v.optionedById !== actor.id) {
    return fail(409, `Bu araç ${v.optionedBy?.name ?? "başka bir çalışan"} tarafından opsiyonlanmış. İşlem engellendi.`);
  }
  if (v.status === "SOLD") return fail(409, "Bu araç satılmış. Satılmış araç üzerinde işlem yapılamaz.");
  if (v.status === "SALE_PENDING") return fail(409, "Bu aracın satış süreci zaten başlatılmış.");
  return fail(409, `Araç bu işlem için uygun durumda değil (mevcut durum: ${v.status}).`);
}

export async function transitionVehicle(
  db: PrismaClient,
  actor: Actor,
  vehicleId: string,
  action: TransitionAction,
  input: TransitionInput = {},
): Promise<TransitionResult> {
  const isAdmin = actor.role === "ADMIN";
  const now = new Date();

  return db.$transaction(async (tx) => {
    switch (action) {
      case "publish": {
        const photoCount = await tx.vehiclePhoto.count({ where: { vehicleId } });
        if (photoCount < MIN_PHOTOS_TO_PUBLISH) {
          return fail(422, `Yayımlamak için en az ${MIN_PHOTOS_TO_PUBLISH} fotoğraf yüklenmelidir.`);
        }
        const v = await tx.vehicle.findUnique({ where: { id: vehicleId } });
        if (!v) return fail(404, "Araç bulunamadı");
        if (!v.brand || !v.model || !v.price || v.price <= 0 || !v.year) {
          return fail(422, "Marka, model, yıl ve fiyat doldurulmadan yayımlanamaz.");
        }
        const r = await tx.vehicle.updateMany({
          where: { id: vehicleId, status: "DRAFT" },
          data: { status: "AVAILABLE", publishedAt: now },
        });
        if (r.count !== 1) return explainConflict(tx, vehicleId, actor);
        await log(tx, vehicleId, "DRAFT", "AVAILABLE", "publish", actor, input.note);
        return { ok: true, status: "AVAILABLE" };
      }

      case "unpublish": {
        if (!isAdmin) return fail(403, "Yayından kaldırma yalnızca yönetici yetkisindedir.");
        const r = await tx.vehicle.updateMany({
          where: { id: vehicleId, status: "AVAILABLE" },
          data: { status: "DRAFT" },
        });
        if (r.count !== 1) return explainConflict(tx, vehicleId, actor);
        await log(tx, vehicleId, "AVAILABLE", "DRAFT", "unpublish", actor, input.note);
        return { ok: true, status: "DRAFT" };
      }

      case "option": {
        // Yalnızca "Satışta" olan araç opsiyonlanabilir; ikinci istek count=0 alır.
        const r = await tx.vehicle.updateMany({
          where: { id: vehicleId, status: "AVAILABLE" },
          data: { status: "OPTIONED", optionedById: actor.id, optionedAt: now },
        });
        if (r.count !== 1) return explainConflict(tx, vehicleId, actor);
        await log(tx, vehicleId, "AVAILABLE", "OPTIONED", "option", actor, input.note);
        return { ok: true, status: "OPTIONED" };
      }

      case "releaseOption": {
        // Yönetici her opsiyonu, çalışan yalnızca kendi opsiyonunu kaldırabilir.
        const r = await tx.vehicle.updateMany({
          where: { id: vehicleId, status: "OPTIONED", ...(isAdmin ? {} : { optionedById: actor.id }) },
          data: { status: "AVAILABLE", optionedById: null, optionedAt: null },
        });
        if (r.count !== 1) return explainConflict(tx, vehicleId, actor);
        await log(tx, vehicleId, "OPTIONED", "AVAILABLE", "releaseOption", actor, input.note);
        return { ok: true, status: "AVAILABLE" };
      }

      case "startSale": {
        // Opsiyon sahibi veya yönetici satış başlatabilir.
        const r = await tx.vehicle.updateMany({
          where: { id: vehicleId, status: "OPTIONED", ...(isAdmin ? {} : { optionedById: actor.id }) },
          data: { status: "SALE_PENDING" },
        });
        if (r.count !== 1) return explainConflict(tx, vehicleId, actor);
        await tx.sale.create({
          data: { vehicleId, startedById: actor.id, agreedPrice: input.agreedPrice ?? null, note: input.note || null },
        });
        await log(tx, vehicleId, "OPTIONED", "SALE_PENDING", "startSale", actor, input.note);
        return { ok: true, status: "SALE_PENDING" };
      }

      case "cancelSale": {
        if (!isAdmin) return fail(403, "Satış iptali yalnızca yönetici yetkisindedir.");
        const r = await tx.vehicle.updateMany({
          where: { id: vehicleId, status: "SALE_PENDING" },
          data: { status: "AVAILABLE", optionedById: null, optionedAt: null },
        });
        if (r.count !== 1) return explainConflict(tx, vehicleId, actor);
        await tx.sale.updateMany({ where: { vehicleId, completedAt: null, cancelledAt: null }, data: { cancelledAt: now } });
        await log(tx, vehicleId, "SALE_PENDING", "AVAILABLE", "cancelSale", actor, input.note);
        return { ok: true, status: "AVAILABLE" };
      }

      case "completeSale": {
        if (!input.notaryCompleted) return fail(422, "Satışı tamamlamak için noter devrinin tamamlandığı onaylanmalıdır.");
        const sale = await tx.sale.findFirst({ where: { vehicleId, completedAt: null, cancelledAt: null } });
        if (!sale) return explainConflict(tx, vehicleId, actor);
        // Yetkili personel: yönetici veya satışı başlatan çalışan.
        if (!isAdmin && sale.startedById !== actor.id) {
          return fail(403, "Satışı yalnızca satışı başlatan çalışan veya yönetici tamamlayabilir.");
        }
        const r = await tx.vehicle.updateMany({
          where: { id: vehicleId, status: "SALE_PENDING" },
          data: { status: "SOLD", soldAt: now },
        });
        if (r.count !== 1) return explainConflict(tx, vehicleId, actor);
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            notaryCompleted: true,
            notaryDate: input.notaryDate ?? now,
            completedById: actor.id,
            completedAt: now,
            agreedPrice: input.agreedPrice ?? sale.agreedPrice,
          },
        });
        await log(tx, vehicleId, "SALE_PENDING", "SOLD", "completeSale", actor, input.note || "Noter devri tamamlandı");
        return { ok: true, status: "SOLD" };
      }
    }
  });
}

export const ACTION_LABELS: Record<TransitionAction | "create" | "edit", string> = {
  create: "Oluşturuldu",
  edit: "Düzenlendi",
  publish: "Yayımlandı",
  unpublish: "Yayından alındı",
  option: "Opsiyonlandı",
  releaseOption: "Opsiyon kaldırıldı",
  startSale: "Satış başlatıldı",
  cancelSale: "Satış iptal edildi",
  completeSale: "Satış tamamlandı (noter)",
};
