import type { MetadataRoute } from "next";

/**
 * Personel CRM'i için web uygulaması bildirimi (PWA manifest).
 * Bilerek /crm altında DEĞİL: tarayıcı manifesti ve ikonları çerezsiz/şifresiz ister; /crm ile başlayan
 * yollar middleware'deki oturum ve demo erişim kapısına takılır. Yalnızca CRM düzenlerinden bağlanır,
 * müşteri sitesi bu manifesti görmez.
 */
export const dynamic = "force-static";

const manifest: MetadataRoute.Manifest = {
  id: "/crm",
  name: "Mir Motors CRM",
  short_name: "Mir Motors",
  description: "Mir Motors galeri personel paneli",
  lang: "tr",
  dir: "ltr",
  start_url: "/crm",
  scope: "/crm",
  display: "standalone",
  theme_color: "#17181b",
  background_color: "#17181b",
  icons: [
    { src: "/pwa/crm-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/pwa/crm-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/pwa/crm-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export function GET() {
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
