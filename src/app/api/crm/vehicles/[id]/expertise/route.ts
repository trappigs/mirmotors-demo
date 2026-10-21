import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { deleteStored, saveUpload } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

// Ekspertiz PDF'i yalnızca CRM içinde görüntülenir (storage/private, oturumlu rota).
export async function POST(req: Request, { params }: Ctx) {
  try {
    await requireApiUser();
    const { id } = await params;
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) return jsonError("Araç bulunamadı", 404);
    if (vehicle.status === "SOLD") return jsonError("Satılmış aracın ekspertiz belgesi değiştirilemez", 409);
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return jsonError("PDF seçilmedi");
    const rel = await saveUpload(file, "pdf", id);
    await prisma.vehicle.update({ where: { id }, data: { expertisePdfPath: rel } });
    if (vehicle.expertisePdfPath) await deleteStored(vehicle.expertisePdfPath, true);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await requireApiUser();
    const { id } = await params;
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) return jsonError("Araç bulunamadı", 404);
    if (vehicle.status === "SOLD") return jsonError("Satılmış aracın ekspertiz belgesi korunur", 409);
    await prisma.vehicle.update({ where: { id }, data: { expertisePdfPath: null } });
    if (vehicle.expertisePdfPath) await deleteStored(vehicle.expertisePdfPath, true);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
