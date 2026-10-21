import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// İlk savunma hattı: CRM sayfaları ve CRM API'leri oturumsuz erişilemez.
// Her API rotası ayrıca kendi içinde requireApiUser() ile yetki kontrolü yapar.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/crm/login" || pathname === "/api/auth/login") return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/crm/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/crm/:path*", "/api/crm/:path*"],
};
