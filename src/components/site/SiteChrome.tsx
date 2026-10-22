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
    <div className="bg-ink px-4 py-1.5 text-center text-[11px] font-medium tracking-wide text-white/85 sm:text-xs">
      <span className="mr-2 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">DEMO</span>
      DEMO · Örnek Araçlar — Bu sitedeki ilanlar ve görseller temsilidir, gerçek satış teklifi değildir.
    </div>
  );
}

/** Mir Motors kelime markası: kırmızı eğik blok içinde "M" + MIR (siyah) MOTORS (kırmızı), tek satır. */
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="Mir Motors ana sayfa">
      <span className="grid h-9 w-10 -skew-x-12 place-items-center rounded-[6px] bg-brand shadow-[0_4px_12px_-4px_rgba(186,16,32,0.6)] transition group-hover:bg-brand-dark">
        <span className="skew-x-12 font-display text-lg font-extrabold italic leading-none text-white">M</span>
      </span>
      <span className="flex items-baseline gap-1.5 font-display leading-none">
        <span className={`text-[22px] font-extrabold tracking-tight ${light ? "text-white" : "text-ink"}`}>MIR</span>
        <span className="text-[22px] font-semibold tracking-tight text-brand">MOTORS</span>
      </span>
    </Link>
  );
}

export const waNumber = () => process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");

export function SiteHeader() {
  const wa = waNumber();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-xl">
      <div className="relative mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        <div className="flex items-center gap-10">
          <Logo />
          <NavLinks items={NAV} />
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-600/30 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50">
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
    <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t border-line bg-white/95 p-3 backdrop-blur-xl lg:hidden">
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
    <footer className="mt-20 bg-ink pb-20 text-zinc-400 lg:pb-0">
      <div className="h-1 bg-brand" />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr_1.4fr]">
        <div>
          <Logo light />
          <p className="mt-5 max-w-xs text-sm leading-relaxed">
            Seçkin ikinci el otomobiller, şeffaf ekspertiz bilgisi ve kişisel danışmanlık.
          </p>
          <span className="mt-5 inline-flex rounded-md bg-brand px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white">
            Demo sürüm
          </span>
        </div>

        <div className="text-sm">
          <p className="section-mark mb-4 text-sm font-bold text-white">Hızlı Linkler</p>
          <ul className="space-y-2.5">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="transition hover:text-white hover:underline hover:decoration-brand hover:decoration-2 hover:underline-offset-4">{n.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-sm">
          <p className="section-mark mb-4 text-sm font-bold text-white">İletişim</p>
          <ul className="space-y-3">
            <li className="flex gap-2.5"><IconPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />Showroom adresi yayın öncesi eklenecek</li>
            <li className="flex gap-2.5"><IconClock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />Hafta içi 09:00–19:00 · Cmt 10:00–18:00</li>
            <li className="flex gap-2.5"><IconWhatsApp className="mt-0.5 h-4 w-4 shrink-0 text-brand" />WhatsApp danışman hattı (demo)</li>
          </ul>
        </div>

        <div className="text-sm">
          <p className="section-mark mb-4 text-sm font-bold text-white">Yasal Bilgilendirme</p>
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
