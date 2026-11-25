import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { hashPassword, passwordProblem } from "@/lib/staff";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

const schema = z.object({ current: z.string().min(1, "Mevcut şifrenizi girin.").max(128), next: z.string().max(128) });

/**
 * Personelin kendi şifresini değiştirmesi (geçici şifreyle ilk girişte zorunlu).
 * Diğer cihazlardaki oturumlar kapanır; bu cihaz yeni oturumla devam eder.
 */
export async function POST(req: Request) {
  try {
    const me = await requireApiUser();
    const { current, next } = schema.parse(await req.json());
    const problem = passwordProblem(next);
    if (problem) return jsonError(problem, 422);
    if (next === current) return jsonError("Yeni şifre mevcut şifreyle aynı olamaz.", 422);
    const user = await prisma.user.findUnique({ where: { id: me.id } });
    if (!user || !(await bcrypt.compare(current, user.passwordHash))) return jsonError("Mevcut şifre hatalı.", 422);

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: me.id },
        data: { passwordHash: await hashPassword(next), mustChangePassword: false, sessionVersion: { increment: 1 } },
        select: { id: true, name: true, role: true, sessionVersion: true },
      });
      await tx.staffEvent.create({ data: { userId: me.id, actorId: me.id, action: "CHANGE_PASSWORD" } });
      return u;
    });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(
      SESSION_COOKIE,
      await signSession({ uid: updated.id, name: updated.name, role: updated.role as "ADMIN" | "SALES", sv: updated.sessionVersion }),
      sessionCookieOptions,
    );
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
