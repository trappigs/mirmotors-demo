import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

// Kullanıcı yoksa da bcrypt karşılaştırması yapılır; yanıt süresi e-postanın varlığını ele vermez.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

// Basit bellek içi deneme sınırı (tek sunuculu demo için): 15 dakikada IP+e-posta başına 10, e-posta başına
// (IP'den bağımsız; X-Forwarded-For sahteciliğine karşı) 30 hatalı deneme. Süresi dolan kayıtlar temizlenir.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const MAX_FAILS_PER_EMAIL = 30;
const MAX_ENTRIES = 10_000;
const fails = new Map<string, { count: number; first: number }>();

function active(key: string, now: number) {
  const e = fails.get(key);
  if (e && now - e.first >= WINDOW_MS) {
    fails.delete(key);
    return undefined;
  }
  return e;
}

function recordFail(key: string, now: number) {
  const e = active(key, now);
  if (!e && fails.size >= MAX_ENTRIES) {
    for (const [k, v] of fails) if (now - v.first >= WINDOW_MS) fails.delete(k);
    if (fails.size >= MAX_ENTRIES) fails.delete(fails.keys().next().value!);
  }
  fails.set(key, e ? { count: e.count + 1, first: e.first } : { count: 1, first: now });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const key = `${ip}|${email}`;
  const emailKey = `*|${email}`;
  const now = Date.now();
  if ((active(key, now)?.count ?? 0) >= MAX_FAILS || (active(emailKey, now)?.count ?? 0) >= MAX_FAILS_PER_EMAIL) {
    return NextResponse.json({ error: "Çok fazla hatalı deneme. Lütfen 15 dakika sonra tekrar deneyin." }, { status: 429 });
  }

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    recordFail(key, now);
    recordFail(emailKey, now);
    return NextResponse.json({ error: "E-posta veya şifre hatalı" }, { status: 401 });
  }
  fails.delete(key);
  fails.delete(emailKey);

  const token = await signSession({ uid: user.id, name: user.name, role: user.role as "ADMIN" | "SALES" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
