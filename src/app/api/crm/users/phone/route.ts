import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { normalizePhone } from "@/lib/whatsapp-webhook";

const schema = z.object({ userId: z.string().min(1), phone: z.string().max(30) });

/** Personelin WhatsApp numarası (asistan yalnız kayıtlı numaralara cevap verir). Yalnız yönetici değiştirir; boş = kaldır. */
export async function PUT(req: Request) {
  try {
    const user = await requireApiUser();
    if (user.role !== "ADMIN") return jsonError("Personel numaralarını yalnızca yönetici değiştirebilir.", 403);
    const { userId, phone } = schema.parse(await req.json());
    const value = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !value) return jsonError("Telefon numarası geçersiz. Örnek: 0532 123 45 67");
    try {
      await prisma.user.update({ where: { id: userId }, data: { phone: value } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return jsonError("Bu numara başka bir personele kayıtlı.", 409);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return jsonError("Personel bulunamadı.", 404);
      throw e;
    }
    return NextResponse.json({ ok: true, phone: value });
  } catch (e) {
    return handleApiError(e);
  }
}
