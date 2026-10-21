import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { toVehicleData, vehicleInputSchema } from "@/lib/vehicle-schema";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const input = vehicleInputSchema.parse(await req.json());
    // AI taslak izi yalnızca oluşturma anında yazılır; düzenleme onu değiştirmez.
    const { aiDraftMode: _m, aiDraftJson: _j, ...data } = toVehicleData(input);
    void _m; void _j;

    // Satılmış ve satış sürecindeki araçların bilgileri değiştirilemez (satış kaydı korunur).
    // Opsiyonlu aracı yalnızca opsiyon sahibi veya yönetici düzenleyebilir (koşul aynı UPDATE içinde).
    const editable =
      user.role === "ADMIN"
        ? { status: { in: ["DRAFT", "AVAILABLE", "OPTIONED"] } }
        : { OR: [{ status: { in: ["DRAFT", "AVAILABLE"] } }, { status: "OPTIONED", optionedById: user.id }] };
    const r = await prisma.vehicle.updateMany({
      where: { id, ...editable },
      data,
    });
    if (r.count !== 1) {
      const exists = await prisma.vehicle.findUnique({ where: { id }, select: { status: true } });
      return exists ? jsonError("Bu araç düzenlenemez: satış sürecinde, satılmış veya başka bir çalışanın opsiyonunda.", 409) : jsonError("Araç bulunamadı", 404);
    }
    const v = await prisma.vehicle.findUniqueOrThrow({ where: { id }, select: { status: true } });
    await prisma.statusHistory.create({
      data: { vehicleId: id, fromStatus: v.status, toStatus: v.status, action: "edit", userId: user.id },
    });
    revalidatePath("/araclar");
    revalidatePath(`/araclar/${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
