import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession, sessionCookieOptions, sessionNeedsRenewal, signSession } from "@/lib/session";

/**
 * Demo erişim kapısı (HTTP Basic). İnternete açık demo adresinde CRM, personel girişinden önce ayrı bir
 * erişim şifresiyle korunur; müşteri sitesi açık kalır. DEMO_ACCESS_SCOPE=all ise müşteri sitesi de korunur.
 * Vercel'de DEMO_ACCESS_PASSWORD tanımlı değilse korunan sayfalar açılmaz (yanlışlıkla korumasız yayın olmasın).
 */
function accessGate(req: NextRequest, isCrm: boolean): NextResponse | null {
  const password = process.env.DEMO_ACCESS_PASSWORD;
  const scope = process.env.DEMO_ACCESS_SCOPE === "all" ? "all" : "crm";
  if (scope === "crm" && !isCrm) return null;
  if (!password) {
    // İnternete açık kurulumlar (Vercel veya DEMO_REQUIRE_ACCESS=1 verilen sunucu): şifre yoksa CRM açılmaz.
    if (process.env.VERCEL === "1" || process.env.DEMO_REQUIRE_ACCESS === "1") {
      return new NextResponse("Demo erişim şifresi yapılandırılmadı (DEMO_ACCESS_PASSWORD).", { status: 503 });
    }
    return null; // yerel geliştirme
  }
  const user = process.env.DEMO_ACCESS_USER || "mirmotors";
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(header.slice(6));
    } catch {}
    const i = decoded.indexOf(":");
    if (i > 0 && safeEqual(decoded.slice(0, i), user) && safeEqual(decoded.slice(i + 1), password)) return null;
  }
  return new NextResponse("Bu demo erişim şifresiyle korunmaktadır.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Mir Motors Demo", charset="UTF-8"', "Cache-Control": "no-store" },
  });
}

// Sabit süreli karşılaştırma (şifre uzunluğu dışında zamanlama bilgisi sızdırmaz).
function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isCrm = pathname.startsWith("/crm") || pathname.startsWith("/api/crm") || pathname.startsWith("/api/auth");

  const gate = accessGate(req, isCrm);
  if (gate) return gate;

  // İlk savunma hattı: CRM sayfaları ve CRM API'leri oturumsuz erişilemez.
  // Her API rotası ayrıca kendi içinde requireApiUser() ile yetki kontrolü yapar.
  if (!(pathname.startsWith("/crm") || pathname.startsWith("/api/crm"))) return NextResponse.next();
  if (pathname === "/crm/login") return NextResponse.next();

  const current = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (current) {
    const res = NextResponse.next();
    // Kayan oturum: 1 günden eski çerez yeni 14 günlük çerezle değiştirilir (httpOnly/lax/secure ayarları aynı).
    // Yenileme başarısız olursa istek yine geçer; mevcut çerez süresi dolana kadar geçerlidir.
    if (sessionNeedsRenewal(current.issuedAt)) {
      try {
        res.cookies.set(SESSION_COOKIE, await signSession(current.session), sessionCookieOptions);
      } catch {}
    }
    return res;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/crm/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Statik derleme dosyaları dışındaki tüm istekler (erişim kapısı müşteri sitesini de kapsar).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
