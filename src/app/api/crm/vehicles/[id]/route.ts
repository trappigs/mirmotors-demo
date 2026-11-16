import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { toVehicleData, vehicleInputSchema } from "@/lib/vehicle-schema";
import { LISTING_FIELD_KEYS, missingVehicleFields, publishChecklist } from "@/lib/listing-rules";
import { toPartMap } from "@/lib/body-parts";
import { getCompanyInfo } from "@/lib/company";
import { deleteStored } from "@/lib/storage";
import { audit } from "@/lib/doc-analysis";
import { duplicatePlateResponse, normalizePlate, plateDuplicates } from "@/lib/plates";

type Ctx = { params: Promise<{ id: string }> };
/** Başka çalışan aracı daha yeni güncelledi: istemci uyarı gösterir (yenile / benimkini kaydet). */
const staleResponse = (by: string, at: Date) =>
  NextResponse.json({ error: `Bu araç siz düzenlerken ${by} tarafından güncellendi.`, code: "STALE", by, version: at.toISOString() }, { status: 409 });
const NOT_EDITABLE = "Bu araç düzenlenemez: satış sürecinde, satılmış veya başka bir çalışanın opsiyonunda.";

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const input = vehicleInputSchema.parse(await req.json());
    // AI taslak izi yalnızca oluşturma anında yazılır; düzenleme onu değiştirmez.
    const { aiDraftMode: _m, aiDraftJson: _j, ...data } = toVehicleData(input);
    void _m; void _j;

    // Yayındaki ilanın zorunlu bilgileri boşaltılamaz (taslakta eksik bilgi serbesttir).
    const current = await prisma.vehicle.findUnique({ where: { id }, include: { parts: true } });
    if (!current) return jsonError("Araç bulunamadı", 404);
    const editableNow = ["REVIEW", "DRAFT", "AVAILABLE"].includes(current.status) || (current.status === "OPTIONED" && (user.role === "ADMIN" || current.optionedById === user.id));
    if (!editableNow) return jsonError(NOT_EDITABLE, 409);
    // Eşzamanlı düzenleme: istemcinin gördüğü sürümden sonra BAŞKA bir çalışan aracı değiştirdiyse sessizce ezilmez.
    if (input.baseVersion && !input.overwrite && current.updatedAt.toISOString() !== input.baseVersion) {
      const since = new Date(input.baseVersion);
      const other = await prisma.statusHistory.findFirst({
        where: { vehicleId: id, createdAt: { gt: since }, userId: { not: user.id } },
        orderBy: { createdAt: "desc" }, select: { user: { select: { name: true } } },
      }) ?? await prisma.vehiclePart.findFirst({
        where: { vehicleId: id, updatedAt: { gt: since }, updatedById: { not: user.id } },
        orderBy: { updatedAt: "desc" }, select: { updatedBy: { select: { name: true } } },
      }).then((p) => (p ? { user: p.updatedBy } : null));
      if (other) return staleResponse(other.user?.name ?? "başka bir çalışan", current.updatedAt);
    }
    // Plaka stoktaki başka bir araçla aynıysa personel "yine de" demeden değişmez (otomatik taslak plakayı bekletir).
    if (data.legalPlate && normalizePlate(data.legalPlate) !== normalizePlate(current.legalPlate) && !input.plateDuplicateAck) {
      const duplicates = await plateDuplicates(prisma, data.legalPlate, id);
      if (duplicates.length) return duplicatePlateResponse(duplicates);
    }
    if (current.status !== "DRAFT" && current.status !== "REVIEW") {
      // Gönderilmeyen alan değişmez; boş gönderilen alan (null) silinmek istenmiştir.
      const changes = Object.fromEntries(Object.entries(data).filter(([, val]) => val !== undefined)) as Partial<typeof current>;
      const missing = missingVehicleFields({ ...current, ...changes });
      if (missing.length) return jsonError(`Yayındaki ilanda bu bilgiler boş bırakılamaz: ${missing.join(", ")}.`, 422);
      // Yayındaki ilanda tamam olan zorunlu ilan bilgisi düzenlemeyle eksik/doğrulanmamış hâle getirilemez
      // (eski kayıtlarda zaten eksik olan madde düzenlemeyi engellemez; tamamlanması beklenir).
      const company = await getCompanyInfo();
      const check = (v: typeof current) => publishChecklist({
        v, company, photoCount: 1, staffParts: toPartMap(current.parts), reportParts: toPartMap(current.parts, "reportState"), reviewBlockers: [],
      }).filter((i) => LISTING_FIELD_KEYS.includes(i.key));
      const before = new Map(check(current).map((i) => [i.key, i.ok]));
      const broken = check({ ...current, ...changes }).filter((i) => !i.ok && before.get(i.key));
      if (broken.length) return jsonError(`Yayındaki ilanda bu değişiklik yapılamaz: ${broken.map((b) => b.reason).join(" ")} Önce aracı yayından alın.`, 422);
    }

    // Satılmış ve satış sürecindeki araçların bilgileri değiştirilemez (satış kaydı korunur).
    // Opsiyonlu aracı yalnızca opsiyon sahibi veya yönetici düzenleyebilir (koşul aynı UPDATE içinde).
    const editable =
      user.role === "ADMIN"
        ? { status: { in: ["REVIEW", "DRAFT", "AVAILABLE", "OPTIONED"] } }
        : { OR: [{ status: { in: ["REVIEW", "DRAFT", "AVAILABLE"] } }, { status: "OPTIONED", optionedById: user.id }] };
    const r = await prisma.vehicle.updateMany({
      // Sürüm denetimi yapıldıysa güncelleme aynı sürüme koşullu: arada yazılan değişiklik ezilmez
      where: { id, ...editable, ...(input.baseVersion && !input.overwrite ? { updatedAt: current.updatedAt } : {}) },
      data,
    });
    if (r.count !== 1) {
      const now = await prisma.vehicle.findUnique({ where: { id }, select: { updatedAt: true, status: true } });
      if (now && input.baseVersion && !input.overwrite && now.updatedAt.getTime() !== current.updatedAt.getTime() && now.status === current.status) {
        return staleResponse("başka bir çalışan", now.updatedAt);
      }
      const exists = await prisma.vehicle.findUnique({ where: { id }, select: { status: true } });
      return exists ? jsonError(NOT_EDITABLE, 409) : jsonError("Araç bulunamadı", 404);
    }
    const v = await prisma.vehicle.findUniqueOrThrow({ where: { id }, select: { status: true, updatedAt: true } });
    // Otomatik kayıt birkaç saniyede bir gelir: aynı çalışanın 10 dakika içindeki düzenlemeleri geçmişte tek satırdır.
    const last = await prisma.statusHistory.findFirst({ where: { vehicleId: id }, orderBy: { createdAt: "desc" }, select: { action: true, userId: true, createdAt: true } });
    const recentEdit = last?.action === "edit" && last.userId === user.id && Date.now() - last.createdAt.getTime() < 10 * 60_000;
    // Tek satırın zamanı son düzenlemeye çekilir: başka çalışanın sürüm denetimi bu düzenlemeyi görür
    const lastEdit = recentEdit ? await prisma.statusHistory.findFirst({ where: { vehicleId: id }, orderBy: { createdAt: "desc" }, select: { id: true } }) : null;
    if (lastEdit) await prisma.statusHistory.update({ where: { id: lastEdit.id }, data: { createdAt: new Date() } });
    else {
      await prisma.statusHistory.create({
        data: { vehicleId: id, fromStatus: v.status, toStatus: v.status, action: "edit", userId: user.id },
      });
    }
    revalidatePath("/araclar");
    revalidatePath(`/araclar/${id}`);
    return NextResponse.json({ ok: true, version: v.updatedAt.toISOString() });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * Hiç yayımlanmamış "Kontrol Bekliyor" veya "Taslak" aracı kalıcı olarak siler (yanlış/deneme kayıtları için).
 * Yayımlanmış veya satış kaydı olan araç silinemez (geçmiş korunur). Satış personeli yalnızca kendi oluşturduğu aracı silebilir.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const v = await prisma.vehicle.findUnique({
      where: { id },
      select: { status: true, publishedAt: true, createdById: true, videoPath: true, expertisePdfPath: true, photos: { select: { path: true } }, documents: { select: { id: true, path: true, kind: true, page: true } }, _count: { select: { sales: true } } },
    });
    if (!v) return jsonError("Araç bulunamadı", 404);
    if (v.status !== "REVIEW" && v.status !== "DRAFT") return jsonError("Yalnızca Kontrol Bekliyor veya Taslak durumundaki araç silinebilir.", 409);
    if (v.publishedAt || v._count.sales) return jsonError("Daha önce yayımlanmış veya satış kaydı olan araç silinemez; geçmiş korunur.", 409);
    if (user.role !== "ADMIN" && v.createdById !== user.id) return jsonError("Bu aracı yalnızca oluşturan personel veya yönetici silebilir.", 403);

    // Koşullu silme: bu arada durum değiştiyse (ör. yayımlandıysa) hiçbir şey silinmez.
    const deleted = await prisma.$transaction(async (tx) => {
      const r = await tx.vehicle.deleteMany({ where: { id, status: { in: ["REVIEW", "DRAFT"] }, publishedAt: null, sales: { none: {} } } });
      if (r.count !== 1) return false;
      for (const d of v.documents) await audit(tx, { action: "DELETE", userId: user.id, documentId: d.id, vehicleId: id, note: `${d.kind} sayfa ${d.page} (araç silindi)` });
      return true;
    });
    if (!deleted) return jsonError("Araç bu arada değişti; silinmedi. Sayfayı yenileyin.", 409);

    // Kayıt silindikten sonra dosyalar (seed görselleri deleteStored içinde atlanır)
    await Promise.all([
      ...v.photos.map((p) => deleteStored(p.path)),
      ...v.documents.map((d) => deleteStored(d.path, true)),
      v.videoPath ? deleteStored(v.videoPath) : null,
      v.expertisePdfPath ? deleteStored(v.expertisePdfPath, true) : null,
    ]);
    revalidatePath("/crm/vehicles");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
