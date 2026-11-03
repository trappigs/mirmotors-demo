import Image from "next/image";
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
      <span className="mr-2 rounded bg-gold px-1.5 py-0.5 text-[10px] font-bold text-ink">DEMO</span>
      DEMO · Örnek Araçlar — Bu sitedeki ilanlar ve görseller temsilidir, gerçek satış teklifi değildir.
    </div>
  );
}

/**
 * Mir Motors'un gerçek logosu (işletmenin gönderdiği görsel; yalnızca kırpıldı, yeniden çizilmedi).
 * Logo siyah zeminlidir; bu yüzden yalnızca siyah alanlarda (üst menü, alt bilgi) kullanılır.
 * Not: elimizdeki dosya düşük çözünürlüklü (364 px); keskin görünüm için işletmeden SVG istenmeli.
 */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const h = size === "lg" ? "h-16" : "h-12 sm:h-[54px]";
  return (
    <Link href="/" className="flex shrink-0 items-center" aria-label="Mir Motors ana sayfa">
      <Image src="/brand/mir-motors-logo.png" alt="Mir Motors" width={364} height={144} priority className={`${h} w-auto`} />
    </Link>
  );
}

export const waNumber = () => process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");

export function SiteHeader() {
  const wa = waNumber();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black">
      <div className="relative mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-6 px-4 sm:h-[76px] sm:px-6">
        <div className="flex items-center gap-10">
          <Logo />
          <NavLinks items={NAV} />
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white/90 transition hover:border-gold hover:text-gold">
              <IconWhatsApp className="h-4 w-4" /> WhatsApp Danışman
            </a>
          )}
          <Link href="/araclar" className="inline-flex items-center rounded-xl border border-gold/60 px-5 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold hover:text-ink">Tüm Araçlar</Link>
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
    <footer className="mt-20 bg-black pb-20 text-zinc-400 lg:pb-0">
      <div className="h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr_1.4fr]">
        <div>
          <Logo size="lg" />
          <p className="mt-5 max-w-xs text-sm leading-relaxed">
            Seçkin ikinci el otomobiller, şeffaf ekspertiz bilgisi ve kişisel danışmanlık.
          </p>
          <span className="mt-5 inline-flex rounded-md bg-gold px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ink">
            Demo sürüm
          </span>
        </div>

        <div className="text-sm">
          <p className="mb-4 border-l-2 border-gold pl-2.5 text-sm font-bold text-white">Hızlı Linkler</p>
          <ul className="space-y-2.5">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="transition hover:text-gold">{n.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-sm">
          <p className="mb-4 border-l-2 border-gold pl-2.5 text-sm font-bold text-white">İletişim</p>
          <ul className="space-y-3">
            <li className="flex gap-2.5"><IconPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />Showroom adresi yayın öncesi eklenecek</li>
            <li className="flex gap-2.5"><IconClock className="mt-0.5 h-4 w-4 shrink-0 text-gold" />Hafta içi 09:00–19:00 · Cmt 10:00–18:00</li>
            <li className="flex gap-2.5"><IconWhatsApp className="mt-0.5 h-4 w-4 shrink-0 text-gold" />WhatsApp danışman hattı (demo)</li>
          </ul>
        </div>

        <div className="text-sm">
          <p className="mb-4 border-l-2 border-gold pl-2.5 text-sm font-bold text-white">Yasal Bilgilendirme</p>
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
