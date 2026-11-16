import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { mediaChangeBlock } from "@/lib/permissions";
import { deleteStored, receiveUpload } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) return jsonError("Araç bulunamadı", 404);
    const blocked = mediaChangeBlock(vehicle, user);
    if (blocked) return jsonError(blocked, 409);
    const rel = await receiveUpload(req, "video", id, "Video seçilmedi");
    // Yeni video müşteriye otomatik açılmaz; personel ayrıca onaylar (PATCH).
    await prisma.vehicle.update({ where: { id }, data: { videoPath: rel, videoPublic: false } });
    if (vehicle.videoPath) await deleteStored(vehicle.videoPath);
    revalidatePath(`/araclar/${id}`);
    return NextResponse.json({ ok: true, path: rel }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) return jsonError("Araç bulunamadı", 404);
    const blocked = mediaChangeBlock(vehicle, user);
    if (blocked) return jsonError(blocked, 409);
    await prisma.vehicle.update({ where: { id }, data: { videoPath: null, videoPublic: false } });
    if (vehicle.videoPath) await deleteStored(vehicle.videoPath);
    revalidatePath(`/araclar/${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** Videoyu müşteri sitesinde tanıtım videosu olarak açar veya gizler (personel onayı). */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const { public: makePublic } = (await req.json().catch(() => ({}))) as { public?: unknown };
    if (typeof makePublic !== "boolean") return jsonError("Geçersiz istek");
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) return jsonError("Araç bulunamadı", 404);
    if (!vehicle.videoPath) return jsonError("Bu araçta video yok", 422);
    const blocked = mediaChangeBlock(vehicle, user);
    if (blocked) return jsonError(blocked, 409);
    if (vehicle.videoPublic !== makePublic) {
      await prisma.$transaction([
        prisma.vehicle.update({ where: { id }, data: { videoPublic: makePublic } }),
        prisma.statusHistory.create({
          data: { vehicleId: id, fromStatus: vehicle.status, toStatus: vehicle.status, action: makePublic ? "videoPublic" : "videoPrivate", userId: user.id },
        }),
      ]);
    }
    revalidatePath(`/araclar/${id}`);
    return NextResponse.json({ ok: true, public: makePublic });
  } catch (e) {
    return handleApiError(e);
  }
}
