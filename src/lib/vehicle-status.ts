// Araç durum makinesi. Tüm geçişler sunucu tarafında, koşullu güncelleme (UPDATE ... WHERE status = ?)
// ile yapılır: aynı anda iki istek gelirse yalnızca biri satırı günceller, diğeri count=0 alır ve reddedilir.
import type { PrismaClient, Prisma } from "@prisma/client";
import { MIN_PHOTOS_TO_PUBLISH, type VehicleStatus } from "./constants";
import { autoListingNo, blockerMessage, envCompanyInfo, publishBlockers, publishChecklist } from "./listing-rules";
import { toPartMap } from "./body-parts";
import { parseReview, reviewBlockers } from "./doc-review";

export type Actor = { id: string; role: "ADMIN" | "SALES" };

export type TransitionResult =
  | { ok: true; status: VehicleStatus }
  | { ok: false; status: number; error: string };

export type TransitionAction =
  | "completeReview"
  | "publish"
  | "unpublish"
  | "option"
  | "releaseOption"
  | "startSale"
  | "cancelSale"
  | "completeSale"
  | "archive"
  | "restore";

export type TransitionInput = {
  note?: string;
  agreedPrice?: number;
  notaryCompleted?: boolean;
  notaryDate?: Date;
  /** Satışı yapan personel (isteğe bağlı; yalnızca satış notuna yazılır, yetki kuralları işlemi yapan kişiye göre işler). */
  sellerId?: string;
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
  if (v.status === "ARCHIVED") return fail(409, "Bu araç arşivde. Önce yönetici arşivden geri yüklemelidir.");
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

  return db.$transaction(async (tx): Promise<TransitionResult> => {
    switch (action) {
      case "completeReview": {
        // Belgeden oluşturulan aracın kontrolü: çözülmemiş eşleşme / çelişki / onay varsa Taslak'a geçmez.
        const v = await tx.vehicle.findUnique({ where: { id: vehicleId }, select: { docReview: true, status: true } });
        if (!v) return fail(404, "Araç bulunamadı");
        const blockers = reviewBlockers(parseReview(v.docReview));
        if (blockers.length) return fail(422, `Kontrol tamamlanamaz: ${blockers.join(" · ")}`);
        const r = await tx.vehicle.updateMany({ where: { id: vehicleId, status: "REVIEW" }, data: { status: "DRAFT" } });
        if (r.count !== 1) return explainConflict(tx, vehicleId, actor);
        await log(tx, vehicleId, "REVIEW", "DRAFT", "completeReview", actor, input.note);
        return { ok: true, status: "DRAFT" };
      }

      case "publish": {
        const photoCount = await tx.vehiclePhoto.count({ where: { vehicleId } });
        if (photoCount < MIN_PHOTOS_TO_PUBLISH) {
          return fail(422, `Yayımlamak için en az ${MIN_PHOTOS_TO_PUBLISH} fotoğraf yüklenmelidir.`);
        }
        const v = await tx.vehicle.findUnique({ where: { id: vehicleId } });
        if (!v) return fail(404, "Araç bulunamadı");
        // Belgeden oluşturulan araç (Kontrol Bekliyor) son kontrol ekranından tek onayla yayımlanır:
        // belge kontrolündeki her konu (eşleşme, çelişki, AI bilgilerinin personel onayı) çözülmüş olmalıdır.
        if (v.status !== "DRAFT" && v.status !== "REVIEW") return explainConflict(tx, vehicleId, actor);
        const pending = reviewBlockers(parseReview(v.docReview));
        if (pending.length) return fail(422, `Belge kontrolünde çözülmemiş konular var: ${pending.join(" · ")}`);
        // Kontrol listesi (mevzuat + galeri kuralları): eksik her madde yayını engeller; arayüzdeki liste yalnızca yol gösterir.
        const [parts, settings] = await Promise.all([
          tx.vehiclePart.findMany({ where: { vehicleId }, select: { part: true, state: true, reportState: true } }),
          tx.companySettings.findUnique({ where: { id: "default" } }),
        ]);
        const env = envCompanyInfo();
        const company = { title: settings?.title || env.title, authorizationNo: settings?.authorizationNo || env.authorizationNo, mersis: null, address: null };
        const items = publishChecklist({
          v, company, photoCount, staffParts: toPartMap(parts), reportParts: toPartMap(parts, "reportState"), reviewBlockers: [],
        });
        const blockers = publishBlockers(items);
        if (blockers.length) return fail(422, blockerMessage(blockers));
        // Eski kayıtlarda ilan numarası yoksa yayında verilir.
        const listingNo = v.legalListingNo ?? autoListingNo(vehicleId);
        const r = await tx.vehicle.updateMany({
          where: { id: vehicleId, status: v.status },
          data: { status: "AVAILABLE", publishedAt: now, legalListingNo: listingNo },
        });
        if (r.count !== 1) return explainConflict(tx, vehicleId, actor);
        if (v.status === "REVIEW") await log(tx, vehicleId, "REVIEW", "DRAFT", "completeReview", actor, "Son kontrolde onaylandı");
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
        // Opsiyonlu araçta: opsiyon sahibi veya yönetici. Satıştaki (AVAILABLE) araçta: her personel; araç işlemi yapanın
        // adına opsiyonlanmış sayılır (optionedById) ki sonraki sahiplik kuralları aynı şekilde işlesin.
        // Her iki durumda da araç SALE_PENDING olur (sitede gizlenir); SOLD için noter onayı (completeSale) gerekir.
        const cur = await tx.vehicle.findUnique({ where: { id: vehicleId }, select: { status: true } });
        if (!cur) return fail(404, "Araç bulunamadı");
        // Satan personel güncellemeden önce doğrulanır (geçersizse araç hiç değişmez).
        let note = input.note || null;
        if (input.sellerId && input.sellerId !== actor.id) {
          const seller = await tx.user.findUnique({ where: { id: input.sellerId }, select: { name: true } });
          if (!seller) return fail(422, "Seçilen satış personeli bulunamadı.");
          note = [`Satan personel: ${seller.name}`, note].filter(Boolean).join(" · ");
        }
        let from: VehicleStatus;
        let r: Prisma.BatchPayload;
        if (cur.status === "AVAILABLE") {
          from = "AVAILABLE";
          r = await tx.vehicle.updateMany({
            where: { id: vehicleId, status: "AVAILABLE" },
            data: { status: "SALE_PENDING", optionedById: actor.id, optionedAt: now },
          });
        } else {
          from = "OPTIONED";
          r = await tx.vehicle.updateMany({
            where: { id: vehicleId, status: "OPTIONED", ...(isAdmin ? {} : { optionedById: actor.id }) },
            data: { status: "SALE_PENDING" },
          });
        }
        if (r.count !== 1) return explainConflict(tx, vehicleId, actor);
        await tx.sale.create({
          data: { vehicleId, startedById: actor.id, agreedPrice: input.agreedPrice ?? null, note },
        });
        await log(tx, vehicleId, from, "SALE_PENDING", "startSale", actor, note ?? undefined);
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

      case "archive": {
        // Kalıcı silme yerine arşiv: kayıt, belgeler ve geçmiş korunur; müşteri sitesinde görünmez.
        // Taslak / Kontrol Bekliyor: oluşturan personel veya yönetici. Satıştaki ilan: yalnızca yönetici (canlı ilanı kaldırır).
        // Opsiyonlu, satış sürecindeki veya satılmış araç arşivlenemez.
        const v = await tx.vehicle.findUnique({ where: { id: vehicleId }, select: { status: true, createdById: true } });
        if (!v) return fail(404, "Araç bulunamadı");
        if (v.status === "AVAILABLE") {
          if (!isAdmin) return fail(403, "Satıştaki ilanı yalnızca yönetici arşivleyebilir.");
        } else if (v.status === "DRAFT" || v.status === "REVIEW") {
          if (!isAdmin && v.createdById !== actor.id) return fail(403, "Bu kaydı yalnızca oluşturan personel veya yönetici arşivleyebilir.");
        } else {
          return v.status === "ARCHIVED" ? fail(409, "Bu araç zaten arşivde.") : explainConflict(tx, vehicleId, actor);
        }
        const from = v.status as VehicleStatus;
        const r = await tx.vehicle.updateMany({
          where: { id: vehicleId, status: from, ...(isAdmin ? {} : { createdById: actor.id }) },
          data: { status: "ARCHIVED", archivedAt: now, archivedById: actor.id, archivedFromStatus: from },
        });
        if (r.count !== 1) return explainConflict(tx, vehicleId, actor);
        await log(tx, vehicleId, from, "ARCHIVED", "archive", actor, input.note);
        return { ok: true, status: "ARCHIVED" };
      }

      case "restore": {
        // Arşivden geri yükleme yalnızca yöneticidedir ve araç her zaman Taslak'a döner:
        // yeniden yayın normal yayın kontrollerinden geçer.
        if (!isAdmin) return fail(403, "Arşivden geri yükleme yalnızca yönetici yetkisindedir.");
        const r = await tx.vehicle.updateMany({
          where: { id: vehicleId, status: "ARCHIVED" },
          data: { status: "DRAFT", archivedAt: null, archivedById: null, archivedFromStatus: null },
        });
        if (r.count !== 1) return explainConflict(tx, vehicleId, actor);
        await log(tx, vehicleId, "ARCHIVED", "DRAFT", "restore", actor, input.note);
        return { ok: true, status: "DRAFT" };
      }
    }
  });
}

export const ACTION_LABELS: Record<TransitionAction | "create" | "edit" | "docReview" | "bodyParts" | "videoPublic" | "videoPrivate" | "photoOrder", string> = {
  create: "Oluşturuldu",
  edit: "Düzenlendi",
  completeReview: "Belge kontrolü tamamlandı",
  docReview: "Belge incelemesi",
  bodyParts: "Kaporta şeması güncellendi",
  videoPublic: "Video müşteriye açıldı",
  videoPrivate: "Video müşteriden gizlendi",
  photoOrder: "Fotoğraf sırası değişti",
  publish: "Yayımlandı",
  unpublish: "Yayından alındı",
  option: "Opsiyonlandı",
  releaseOption: "Opsiyon kaldırıldı",
  startSale: "Satış başlatıldı",
  cancelSale: "Satış iptal edildi",
  completeSale: "Satış tamamlandı (noter)",
  archive: "Arşivlendi",
  restore: "Arşivden geri yüklendi",
};
