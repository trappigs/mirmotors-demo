import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { mediaChangeBlock } from "@/lib/permissions";
import { saveUpload } from "@/lib/storage";

const MAX_PHOTOS = 40;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const vehicle = await prisma.vehicle.findUnique({ where: { id }, include: { photos: true } });
    if (!vehicle) return jsonError("Araç bulunamadı", 404);
    const blocked = mediaChangeBlock(vehicle, user);
    if (blocked) return jsonError(blocked, 409);

    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) return jsonError("Fotoğraf seçilmedi");
    if (vehicle.photos.length + files.length > MAX_PHOTOS) return jsonError(`En fazla ${MAX_PHOTOS} fotoğraf yüklenebilir`);

    // Önce tüm dosyaları doğrula ve kaydet; biri hatalıysa hiçbiri veritabanına yazılmaz.
    const saved: string[] = [];
    for (const f of files) saved.push(await saveUpload(f, "photo", id));

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
