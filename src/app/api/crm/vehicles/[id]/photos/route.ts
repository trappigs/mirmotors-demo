import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { mediaChangeBlock } from "@/lib/permissions";
import { optimizeStoredImage, saveUpload, storageDriver, verifyDirectUpload } from "@/lib/storage";

const MAX_PHOTOS = 40;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const vehicle = await prisma.vehicle.findUnique({ where: { id }, include: { photos: true } });
    if (!vehicle) return jsonError("Araç bulunamadı", 404);
    const blocked = mediaChangeBlock(vehicle, user);
    if (blocked) return jsonError(blocked, 409);

    // Önce tüm dosyaları doğrula ve kaydet; biri hatalıysa hiçbiri veritabanına yazılmaz.
    const saved: string[] = [];
    if (storageDriver() === "blob") {
      // Doğrudan yükleme: dosyalar Blob'a tarayıcıdan yüklendi; burada yalnızca yolları doğrulanıp kaydedilir.
      const { paths } = (await req.json().catch(() => ({}))) as { paths?: unknown };
      if (!Array.isArray(paths) || paths.length === 0) return jsonError("Fotoğraf seçilmedi");
      if (vehicle.photos.length + paths.length > MAX_PHOTOS) return jsonError(`En fazla ${MAX_PHOTOS} fotoğraf yüklenebilir`);
      for (const p of paths) {
        const rel = await verifyDirectUpload(p, "photo", id);
        await optimizeStoredImage(rel, "photo"); // konum bilgisini sil, boyutu küçült (yerel yüklemeyle aynı)
        saved.push(rel);
      }
    } else {
      const form = await req.formData();
      const files = form.getAll("files").filter((f): f is File => f instanceof File);
      if (files.length === 0) return jsonError("Fotoğraf seçilmedi");
      if (vehicle.photos.length + files.length > MAX_PHOTOS) return jsonError(`En fazla ${MAX_PHOTOS} fotoğraf yüklenebilir`);
      for (const f of files) saved.push(await saveUpload(f, "photo", id));
    }

    let order = vehicle.photos.reduce((m, p) => Math.max(m, p.sortOrder), -1);
    const hasCover = vehicle.photos.some((p) => p.isCover);
    await prisma.$transaction(
      saved.map((p, i) =>
        prisma.vehiclePhoto.create({ data: { vehicleId: id, path: p, sortOrder: ++order, isCover: !hasCover && i === 0 } }),
      ),
    );
    revalidatePath(`/araclar/${id}`);
    return NextResponse.json({ ok: true, count: saved.length }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

/** Fotoğraf sırasını kaydeder: { order: [fotoğrafId, ...] } — aracın tüm fotoğrafları, yeni sırasıyla. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const { order } = (await req.json().catch(() => ({}))) as { order?: unknown };
    if (!Array.isArray(order) || order.some((x) => typeof x !== "string")) return jsonError("Geçersiz sıralama");
    const vehicle = await prisma.vehicle.findUnique({ where: { id }, include: { photos: true } });
    if (!vehicle) return jsonError("Araç bulunamadı", 404);
    const blocked = mediaChangeBlock(vehicle, user);
    if (blocked) return jsonError(blocked, 409);
    const ids = new Set(vehicle.photos.map((p) => p.id));
    if (order.length !== ids.size || new Set(order).size !== ids.size || !order.every((x) => ids.has(x))) {
      return jsonError("Sıralama aracın fotoğraflarıyla uyuşmuyor; sayfayı yenileyin.", 409);
    }
    await prisma.$transaction([
      // Sıradaki ilk fotoğraf kapak olur: CRM'deki 1 numara sitede de ilk görünür.
      ...order.map((photoId, i) => prisma.vehiclePhoto.update({ where: { id: photoId as string }, data: { sortOrder: i, isCover: i === 0 } })),
      prisma.statusHistory.create({ data: { vehicleId: id, fromStatus: vehicle.status, toStatus: vehicle.status, action: "photoOrder", userId: user.id } }),
    ]);
    revalidatePath(`/araclar/${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
