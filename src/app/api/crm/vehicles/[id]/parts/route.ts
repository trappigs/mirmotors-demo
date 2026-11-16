import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { canEditDetails } from "@/lib/permissions";
import { BODY_PART_KEYS, PART_STATES } from "@/lib/body-parts";
import { saveVehicleParts } from "@/lib/body-parts-db";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  updates: z
    .array(
      z.object({
        part: z.enum(BODY_PART_KEYS as [string, ...string[]], { message: "Geçersiz parça" }),
        state: z.enum(PART_STATES).optional(),
        reportState: z.enum(PART_STATES).optional(),
      }),
    )
    .min(1)
    .max(BODY_PART_KEYS.length * 2),
});

/** Kaporta parça durumlarını kaydeder (personel beyanı ve/veya ekspertiz raporu). */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const { updates } = bodySchema.parse(await req.json());
    const result = await prisma.$transaction(async (tx) => {
      const v = await tx.vehicle.findUnique({ where: { id }, select: { status: true, optionedById: true } });
      if (!v) return { error: "Araç bulunamadı", status: 404 } as const;
      if (!canEditDetails(v, user)) {
        return { error: "Bu araçta kaporta bilgisi değiştirilemez: satış sürecinde, satılmış veya başka bir çalışanın opsiyonunda.", status: 409 } as const;
      }
      return saveVehicleParts(tx, id, updates as Parameters<typeof saveVehicleParts>[2], user.id);
    });
    if ("error" in result) return jsonError(result.error, result.status);
    revalidatePath("/araclar");
    revalidatePath(`/araclar/${id}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return handleApiError(e);
  }
}
