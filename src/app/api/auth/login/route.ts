import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

// Kullanıcı yoksa da bcrypt karşılaştırması yapılır; yanıt süresi e-postanın varlığını ele vermez.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

// Basit bellek içi deneme sınırı (tek sunuculu demo için): IP+e-posta başına 15 dakikada 10 hatalı deneme.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const fails = new Map<string, { count: number; first: number }>();

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const key = `${ip}|${email}`;
  const now = Date.now();
  const entry = fails.get(key);
  if (entry && now - entry.first < WINDOW_MS && entry.count >= MAX_FAILS) {
    return NextResponse.json({ error: "Çok fazla hatalı deneme. Lütfen 15 dakika sonra tekrar deneyin." }, { status: 429 });
  }

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    const fresh = !entry || now - entry.first >= WINDOW_MS;
    fails.set(key, fresh ? { count: 1, first: now } : { count: entry.count + 1, first: entry.first });
    return NextResponse.json({ error: "E-posta veya şifre hatalı" }, { status: 401 });
  }
  fails.delete(key);

  const token = await signSession({ uid: user.id, name: user.name, role: user.role as "ADMIN" | "SALES" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
