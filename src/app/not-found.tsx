import Link from "next/link";
import { DemoBanner, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

/** Bilinmeyen adresler için site düzeninde Türkçe 404 sayfası (DEMO bandı dahil). */
export default function NotFound() {
  return (
    <>
      <DemoBanner />
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <p className="eyebrow">404</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">Aradığınız sayfa bulunamadı</h1>
        <p className="mt-3 text-muted">Bağlantı hatalı olabilir veya sayfa kaldırılmış olabilir.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/araclar" className="btn-primary rounded-xl px-6 py-3">Araçlarımız</Link>
          <Link href="/" className="btn-outline rounded-xl px-6 py-3">Ana sayfa</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
