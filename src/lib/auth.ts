import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentUser = { id: string; name: string; email: string; role: "ADMIN" | "SALES" };

/** Oturumu doğrular ve kullanıcının veritabanında hâlâ var olduğunu kontrol eder. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role as CurrentUser["role"] };
}

/** Sayfalar için: oturum yoksa giriş ekranına yönlendirir. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/crm/login");
  return user;
}

export class AuthError extends Error {
  constructor(message = "Yetkisiz işlem", public status = 401) {
    super(message);
  }
}

/** API rotaları için: oturum yoksa hata fırlatır. */
export async function requireApiUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Oturum gerekli", 401);
  return user;
}
