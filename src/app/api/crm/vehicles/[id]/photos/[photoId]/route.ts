import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { deleteStored } from "@/lib/storage";
import { mediaChangeBlock } from "@/lib/permissions";
import { PUBLIC_STATUSES, type VehicleStatus } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string; photoId: string }> };

/** Kapak fotoğrafı seçer. */
export async function PATCH(_req: Request, { params }: Ctx) {
  try {
    const user = await requireApiUser();
    const { id, photoId } = await params;
    const photo = await prisma.vehiclePhoto.findFirst({ where: { id: photoId, vehicleId: id }, include: { vehicle: true } });
    if (!photo) return jsonError("Fotoğraf bulunamadı", 404);
    const blocked = mediaChangeBlock(photo.vehicle, user);
    if (blocked) return jsonError(blocked, 409);
    await prisma.$transaction([
      prisma.vehiclePhoto.updateMany({ where: { vehicleId: id }, data: { isCover: false } }),
      prisma.vehiclePhoto.update({ where: { id: photoId }, data: { isCover: true } }),
    ]);
    revalidatePath(`/araclar/${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await requireApiUser();
    const { id, photoId } = await params;
    const result = await prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({ where: { id }, include: { photos: true } });
      if (!vehicle) return { error: "Araç bulunamadı", status: 404 };
      const photo = vehicle.photos.find((p) => p.id === photoId);
      if (!photo) return { error: "Fotoğraf bulunamadı", status: 404 };
      const blocked = mediaChangeBlock(vehicle, user);
      if (blocked) return { error: blocked, status: 409 };
      if (PUBLIC_STATUSES.includes(vehicle.status as VehicleStatus) && vehicle.photos.length <= 1) {
        return { error: "Yayındaki ilanın son fotoğrafı silinemez", status: 409 };
      }
      await tx.vehiclePhoto.delete({ where: { id: photoId } });
      if (photo.isCover) {
        const next = vehicle.photos.filter((p) => p.id !== photoId).sort((a, b) => a.sortOrder - b.sortOrder)[0];
        if (next) await tx.vehiclePhoto.update({ where: { id: next.id }, data: { isCover: true } });
      }
      return { path: photo.path };
    });
    if ("error" in result) return jsonError(result.error!, result.status);
    if (!result.path.startsWith("seed/")) await deleteStored(result.path);
    revalidatePath(`/araclar/${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
