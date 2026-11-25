import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { IconPin, IconWhatsApp } from "@/components/site/Icons";
import { getCompanyInfo } from "@/lib/company";

export const metadata: Metadata = { title: "İletişim" };

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const company = await getCompanyInfo();
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  return (
    <>
      <PageHero eyebrow="İletişim" title="Bize ulaşın" text="Araçlarla ilgili sorularınız veya showroom ziyareti için danışmanlarımız hazır." />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-20 sm:px-6 md:grid-cols-2">
        <div className="card p-8">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-paper text-accent-dark"><IconPin className="h-5 w-5" /></span>
          <h2 className="mt-5 font-display text-xl font-semibold">Showroom</h2>
          <p className="mt-2 text-zinc-600">{company.address ?? "Adres bilgisi yakında eklenecek."}</p>
          {company.address && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}`} target="_blank" rel="noopener noreferrer" className="btn-outline mt-6 px-5 py-2.5 text-sm">
              Yol tarifi al
            </a>
          )}
        </div>
        <div className="card-dark relative overflow-hidden p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#25D366]/20 blur-3xl" />
          <div className="relative">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#25D366]/15 text-[#25D366]"><IconWhatsApp /></span>
            <h2 className="mt-5 font-display text-xl font-semibold">WhatsApp danışman hattı</h2>
            <p className="mt-2 text-zinc-400">Araçlarla ilgili sorularınız için danışmanlarımıza doğrudan yazabilirsiniz.</p>
            {wa && (
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="btn mt-6 bg-[#25D366] px-6 py-3 text-white hover:bg-[#1fb857]">
                <IconWhatsApp /> WhatsApp ile yazın
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
