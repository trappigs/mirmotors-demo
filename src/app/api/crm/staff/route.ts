import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { createStaffSchema, generateTempPassword, hashPassword, normalizePhone, staffError } from "@/lib/staff";

/** Yeni personel: yalnızca yönetici açar. Geçici şifre bir kez gösterilir; ilk girişte değiştirilmesi zorunludur. */
export async function POST(req: Request) {
  try {
    const actor = await requireApiUser();
    if (actor.role !== "ADMIN") return jsonError("Personeli yalnızca yönetici ekleyebilir.", 403);
    const data = createStaffSchema.parse(await req.json());
    const ph = normalizePhone(data.phone);
    if (ph.error) return jsonError(ph.error, 422);
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { name: data.name, email: data.email, role: data.role, phone: ph.phone, passwordHash, mustChangePassword: true },
        select: { id: true },
      });
      await tx.staffEvent.create({ data: { userId: u.id, actorId: actor.id, action: "CREATE" } });
      return u;
    });
    return NextResponse.json({ ok: true, id: user.id, tempPassword });
  } catch (e) {
    return staffError(e);
  }
}
