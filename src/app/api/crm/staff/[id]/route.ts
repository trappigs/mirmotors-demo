import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { generateTempPassword, hashPassword, normalizePhone, staffError, updateStaffSchema } from "@/lib/staff";

class StaffRuleError extends Error {}

/**
 * Personel işlemleri (yalnızca yönetici): bilgileri güncelle, pasif yap, yeniden aktif yap, şifre sıfırla.
 * Pasif yapma ve şifre sıfırlama sessionVersion'ı artırır: o kişinin tüm açık oturumları anında kapanır.
 * Kurallar: kimse kendini pasif yapamaz / yetkisini düşüremez; son aktif yönetici pasif yapılamaz veya satış personeline çevrilemez.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    if (actor.role !== "ADMIN") return jsonError("Personel işlemlerini yalnızca yönetici yapabilir.", 403);
    const { id } = await params;
    const input = updateStaffSchema.parse(await req.json());
    const self = id === actor.id;
    if (self && input.action === "deactivate") return jsonError("Kendi hesabınızı pasif yapamazsınız.", 422);
    if (self && input.action === "update" && input.role !== "ADMIN") return jsonError("Kendi yönetici yetkinizi kaldıramazsınız.", 422);
    if (self && input.action === "resetPassword") return jsonError("Kendi şifrenizi Ayarlar > Şifremi değiştir bölümünden değiştirin.", 422);

    let phone: string | null = null;
    if (input.action === "update") {
      const ph = normalizePhone(input.phone);
      if (ph.error) return jsonError(ph.error, 422);
      phone = ph.phone;
    }
    const tempPassword = input.action === "resetPassword" ? generateTempPassword() : null;
    const passwordHash = tempPassword ? await hashPassword(tempPassword) : null;

    await prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({ where: { id }, select: { id: true, role: true, active: true } });
        if (!target) throw new StaffRuleError("Personel bulunamadı.");
        // Son aktif yönetici korunur: sisteme kimsenin giremeyeceği bir duruma düşülmez.
        const losesAdmin =
          target.role === "ADMIN" && target.active && (input.action === "deactivate" || (input.action === "update" && input.role !== "ADMIN"));
        if (losesAdmin) {
          const others = await tx.user.count({ where: { role: "ADMIN", active: true, id: { not: id } } });
          if (others === 0) throw new StaffRuleError("Son aktif yönetici pasif yapılamaz veya satış personeline çevrilemez.");
        }
        switch (input.action) {
          case "update":
            await tx.user.update({ where: { id }, data: { name: input.name, email: input.email, role: input.role, phone } });
            await tx.staffEvent.create({ data: { userId: id, actorId: actor.id, action: "UPDATE" } });
            break;
          case "deactivate":
            if (!target.active) throw new StaffRuleError("Bu personel zaten pasif.");
            await tx.user.update({ where: { id }, data: { active: false, deactivatedAt: new Date(), sessionVersion: { increment: 1 } } });
            await tx.pushSubscription.deleteMany({ where: { userId: id } }); // bildirimler de durur
            await tx.staffEvent.create({ data: { userId: id, actorId: actor.id, action: "DEACTIVATE" } });
            break;
          case "activate":
            if (target.active) throw new StaffRuleError("Bu personel zaten aktif.");
            await tx.user.update({ where: { id }, data: { active: true, deactivatedAt: null } });
            await tx.staffEvent.create({ data: { userId: id, actorId: actor.id, action: "ACTIVATE" } });
            break;
          case "resetPassword":
            await tx.user.update({
              where: { id },
              data: { passwordHash: passwordHash!, mustChangePassword: true, sessionVersion: { increment: 1 }, failedLogins: 0, failWindowStart: null },
            });
            await tx.staffEvent.create({ data: { userId: id, actorId: actor.id, action: "RESET_PASSWORD" } });
            break;
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return NextResponse.json({ ok: true, ...(tempPassword ? { tempPassword } : {}) });
  } catch (e) {
    if (e instanceof StaffRuleError) return jsonError(e.message, 422);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
      return jsonError("Aynı anda başka bir personel işlemi yapıldı. Lütfen tekrar deneyin.", 409);
    }
    return staffError(e);
  }
}
