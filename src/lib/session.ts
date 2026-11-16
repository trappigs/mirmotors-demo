// Edge/middleware ile paylaşılan, yalnızca jose kullanan oturum yardımcıları.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "mm_session";
// Personel her gün yeniden giriş yapmasın: 14 gün geçerli, kullanıldıkça yenilenir (kayan süre).
// Middleware, 1 günden eski bir oturumu CRM isteğinde yeni 14 günlük çerezle değiştirir;
// 14 gün hiç açılmayan cihazda oturum kendiliğinden düşer.
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
export const SESSION_RENEW_AFTER_SECONDS = 60 * 60 * 24;

export type SessionPayload = { uid: string; name: string; role: "ADMIN" | "SALES" };

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
      session: { uid: payload.uid, name: String(payload.name ?? ""), role: payload.role },
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
