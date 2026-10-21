import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

// Kullanıcı yoksa da bcrypt karşılaştırması yapılır; yanıt süresi e-postanın varlığını ele vermez.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

// Hesap bazlı deneme sınırı (tek sunuculu demo için): bir hesaba 15 dakikada en fazla 10 hatalı deneme.
// Sayaçlar yalnızca var olan kullanıcılar için tutulur; tablo personel sayısıyla sınırlıdır, hiçbir kayıt
// tahliye edilmez ve uydurma e-postalarla doldurulamaz. İstemcinin gönderdiği IP başlıklarına güvenilmez.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const attempts = new Map<string, { count: number; first: number }>();

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

  if (user) {
    // Kontrol ve sayım aynı senkron adımda, beklemeli bcrypt'ten önce: eşzamanlı isteklerle sınır aşılamaz.
    const now = Date.now();
    const cur = attempts.get(user.id);
    const entry = cur && now - cur.first < WINDOW_MS ? cur : { count: 0, first: now };
    if (entry.count >= MAX_FAILS) {
      return NextResponse.json({ error: "Çok fazla hatalı deneme. Lütfen 15 dakika sonra tekrar deneyin." }, { status: 429 });
    }
    attempts.set(user.id, { count: entry.count + 1, first: entry.first });
  }

  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return NextResponse.json({ error: "E-posta veya şifre hatalı" }, { status: 401 });
  attempts.delete(user.id);

  const token = await signSession({ uid: user.id, name: user.name, role: user.role as "ADMIN" | "SALES" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
