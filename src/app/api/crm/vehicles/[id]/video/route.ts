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
    await prisma.vehicle.update({ where: { id }, data: { videoPath: rel } });
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
    await prisma.vehicle.update({ where: { id }, data: { videoPath: null } });
    if (vehicle.videoPath) await deleteStored(vehicle.videoPath);
    revalidatePath(`/araclar/${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
