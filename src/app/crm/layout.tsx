import type { Metadata, Viewport } from "next";

/**
 * Personel CRM'inin (panel + giriş) ortak üst düzeni: yalnızca PWA/ana ekran meta bilgileri.
 * Manifest burada bağlanır; müşteri sitesi bu düzenin dışında kaldığı için etkilenmez.
 * noindex kök düzenden devralınır.
 */
export const metadata: Metadata = {
  manifest: "/pwa/crm.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Mir Motors",
    // Koyu üst menü durum çubuğunun altına uzanır; boşluk safe-area ile bırakılır.
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#17181b",
  width: "device-width",
  initialScale: 1,
  // iPhone çentik/ana ekran çubuğu alanını kullanabilmek için; içerik env(safe-area-inset-*) ile korunur.
  viewportFit: "cover",
};

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return children;
}
