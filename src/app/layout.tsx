import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: { default: "Mir Motors — DEMO", template: "%s · Mir Motors DEMO" },
  description: "Mir Motors premium ikinci el araç galerisi — demo sürümü. İlanlar temsilidir.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = { themeColor: "#17181b" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className={`${inter.variable} ${sora.variable} antialiased`}>{children}</body>
    </html>
  );
}
