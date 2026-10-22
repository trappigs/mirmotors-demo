import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

// Kullanıcı yoksa da bcrypt karşılaştırması yapılır; yanıt süresi e-postanın varlığını ele vermez.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

// Hesap bazlı deneme sınırı: bir hesaba 15 dakikada en fazla 10 hatalı deneme.
// Sayaç veritabanında (User tablosu) tutulur; sunucusuz ortamda tüm örnekler aynı sayacı görür.
// Yalnızca var olan kullanıcılar için sayılır, uydurma e-postalarla doldurulamaz. İstemcinin IP başlıklarına güvenilmez.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;

/** Denemeyi bcrypt'ten ÖNCE tek bir atomik UPDATE ile sayar; eşzamanlı isteklerle sınır aşılamaz. */
async function countAttempt(userId: string): Promise<number> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - WINDOW_MS);
  const rows = await prisma.$queryRaw<{ failedLogins: number }[]>`
    UPDATE "User" SET
      "failedLogins" = CASE WHEN "failWindowStart" IS NULL OR "failWindowStart" < ${cutoff} THEN 1 ELSE "failedLogins" + 1 END,
      "failWindowStart" = CASE WHEN "failWindowStart" IS NULL OR "failWindowStart" < ${cutoff} THEN ${now} ELSE "failWindowStart" END
    WHERE "id" = ${userId}
    RETURNING "failedLogins"`;
  return rows[0]?.failedLogins ?? 0;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

  if (user && (await countAttempt(user.id)) > MAX_FAILS) {
    return NextResponse.json({ error: "Çok fazla hatalı deneme. Lütfen 15 dakika sonra tekrar deneyin." }, { status: 429 });
  }

  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return NextResponse.json({ error: "E-posta veya şifre hatalı" }, { status: 401 });
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, failWindowStart: null } });

  const token = await signSession({ uid: user.id, name: user.name, role: user.role as "ADMIN" | "SALES" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
