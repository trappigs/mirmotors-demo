// Edge/middleware ile paylaşılan, yalnızca jose kullanan oturum yardımcıları.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "mm_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

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
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.uid !== "string" || (payload.role !== "ADMIN" && payload.role !== "SALES")) return null;
    return { uid: payload.uid, name: String(payload.name ?? ""), role: payload.role };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  // Vercel'de (HTTPS) her zaman Secure; yerelde HTTP için COOKIE_SECURE ile açılır.
  secure: process.env.COOKIE_SECURE === "1" || process.env.VERCEL === "1",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
