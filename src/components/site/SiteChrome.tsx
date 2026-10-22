import Link from "next/link";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";
import { IconClock, IconPin, IconWhatsApp } from "./Icons";

export const NAV = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/araclar", label: "Araçlarımız" },
  { href: "/hakkimizda", label: "Hakkımızda" },
  { href: "/iletisim", label: "İletişim" },
];

export function DemoBanner() {
  return (
    <div className="bg-accent px-4 py-1.5 text-center text-[11px] font-semibold tracking-wide text-ink sm:text-xs">
      DEMO · Örnek Araçlar — Bu sitedeki ilanlar ve görseller temsilidir, gerçek satış teklifi değildir.
    </div>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="Mir Motors ana sayfa">
      <span className="grid h-8 w-8 place-items-center rounded-md border border-accent/60 font-display text-sm font-bold text-accent transition group-hover:bg-accent group-hover:text-ink">
        M
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className={`font-display text-lg font-bold tracking-[0.22em] ${light ? "text-white" : "text-ink"}`}>MIR</span>
        <span className="font-display text-lg font-light tracking-[0.22em] text-accent">MOTORS</span>
      </span>
    </Link>
  );
}

export const waNumber = () => process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");

export function SiteHeader() {
  const wa = waNumber();
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-xl">
      <div className="relative mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <NavLinks items={NAV} />
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-600/30 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50">
              <IconWhatsApp className="h-4 w-4" /> WhatsApp Danışman
            </a>
          )}
          <Link href="/araclar" className="btn-primary rounded-xl px-5 py-2.5">Tüm Araçlar</Link>
        </div>
        <MobileNav items={NAV} />
      </div>
    </header>
  );
}

/** Mobilde ekranın altında sabit iletişim çubuğu (yalnızca bağlantı; ödeme/satış işlemi yok). */
export function MobileActionBar() {
  const wa = waNumber();
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur-xl lg:hidden">
      {wa ? (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600/30 py-3 text-sm font-semibold text-emerald-700">
          <IconWhatsApp className="h-4 w-4" /> WhatsApp
        </a>
      ) : (
        <Link href="/iletisim" className="btn-outline rounded-xl py-3">İletişim</Link>
      )}
      <Link href="/araclar" className="btn-primary rounded-xl py-3">Tüm Araçlar</Link>
    </div>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 bg-ink pb-20 text-zinc-400 lg:pb-0">
      <div className="h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr_1.4fr]">
        <div>
          <Logo light />
          <p className="mt-5 max-w-xs text-sm leading-relaxed">
            Seçkin ikinci el otomobiller, şeffaf ekspertiz bilgisi ve kişisel danışmanlık. Showroom deneyimini dijitale taşıyoruz.
          </p>
          <span className="mt-6 inline-flex rounded-full border border-accent/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            Demo sürüm
          </span>
        </div>

        <div className="text-sm">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">Hızlı Linkler</p>
          <ul className="space-y-2.5">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="transition hover:text-accent">{n.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-sm">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">İletişim</p>
          <ul className="space-y-3">
            <li className="flex gap-2.5"><IconPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />Showroom adresi yayın öncesi eklenecek</li>
            <li className="flex gap-2.5"><IconClock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />Hafta içi 09:00–19:00 · Cmt 10:00–18:00</li>
            <li className="flex gap-2.5"><IconWhatsApp className="mt-0.5 h-4 w-4 shrink-0 text-accent" />WhatsApp danışman hattı (demo)</li>
          </ul>
        </div>

        <div className="text-sm">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">Yasal Bilgilendirme</p>
          <p className="leading-relaxed">
            Bu site bir demo sürümüdür. İlanlar, fiyatlar ve görseller temsilidir. Site üzerinden ödeme, kapora veya
            sözleşme işlemi yapılmaz. Yetki belgesi ve zorunlu ilan bilgileri gerçek yayından önce eklenecektir.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs sm:flex-row sm:px-6">
          <span>© {year} Mir Motors · Tüm hakları saklıdır · Demo</span>
          <span className="text-zinc-500">Ödeme ve sözleşme işlemleri yalnızca galeride yapılır.</span>
        </div>
      </div>
    </footer>
  );
}
