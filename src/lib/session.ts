// Edge/middleware ile paylaşılan, yalnızca jose kullanan oturum yardımcıları.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "mm_session";
// PWA: personel bir kez giriş yapınca hesap açık kalır. 180 gün geçerli, kullanıldıkça yenilenir (kayan süre):
// middleware 1 günden eski oturumu yeni 180 günlük çerezle değiştirir; 180 gün hiç açılmayan cihazda oturum düşer.
// Kaybolan telefon / ayrılan personel: yönetici pasif yapınca ya da şifre sıfırlayınca oturum anında kapanır (sessionVersion).
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 180;
export const SESSION_RENEW_AFTER_SECONDS = 60 * 60 * 24;

// sv: kullanıcının oturum sürümü; veritabanındaki sessionVersion artınca eski oturumlar geçersiz olur.
export type SessionPayload = { uid: string; name: string; role: "ADMIN" | "SALES"; sv?: number };

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET en az 16 karakter olmalı");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  return (await readSession(token))?.session ?? null;
}

/** Oturumu doğrular ve imzalanma zamanını (saniye) da döndürür; kayan yenileme kararı için. */
export async function readSession(token: string | undefined): Promise<{ session: SessionPayload; issuedAt: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.uid !== "string" || (payload.role !== "ADMIN" && payload.role !== "SALES")) return null;
    return {
      session: { uid: payload.uid, name: String(payload.name ?? ""), role: payload.role, sv: typeof payload.sv === "number" ? payload.sv : 0 },
      issuedAt: typeof payload.iat === "number" ? payload.iat : 0,
    };
  } catch {
    return null;
  }
}

/** Oturum yenilenmeli mi (1 günden eski)? */
export function sessionNeedsRenewal(issuedAt: number, nowSeconds = Math.floor(Date.now() / 1000)) {
  return nowSeconds - issuedAt > SESSION_RENEW_AFTER_SECONDS;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  // Vercel'de (HTTPS) her zaman Secure; yerelde HTTP için COOKIE_SECURE ile açılır.
  secure: process.env.COOKIE_SECURE === "1" || process.env.VERCEL === "1",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
