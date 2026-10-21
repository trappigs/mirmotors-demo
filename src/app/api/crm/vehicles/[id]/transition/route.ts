import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { transitionVehicle } from "@/lib/vehicle-status";

const bodySchema = z.object({
  action: z.enum(["publish", "unpublish", "option", "releaseOption", "startSale", "cancelSale", "completeSale"]),
  note: z.string().max(1000).optional(),
  agreedPrice: z.coerce.number().int().positive().optional(),
  notaryCompleted: z.boolean().optional(),
  notaryDate: z.coerce.date().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const { action, ...input } = body;

    let result;
    try {
      result = await transitionVehicle(prisma, { id: user.id, role: user.role }, id, action, input);
    } catch (e) {
      // SQLite kilit çakışması vb.: eşzamanlı başka bir işlem kazandı.
      console.warn("transition conflict", e);
      result = { ok: false as const, status: 409, error: "Araç üzerinde eşzamanlı bir işlem yapıldı. Sayfayı yenileyip tekrar deneyin." };
    }
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    // Müşteri sitesi dinamik render edilir; yine de olası önbellekleri anında temizle.
    revalidatePath("/");
    revalidatePath("/araclar");
    revalidatePath(`/araclar/${id}`);
    return NextResponse.json({ ok: true, status: result.status });
  } catch (e) {
    return handleApiError(e);
  }
}
