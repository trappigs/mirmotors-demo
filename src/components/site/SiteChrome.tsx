import Link from "next/link";
import { MobileNav } from "./MobileNav";

export const NAV = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/araclar", label: "Araçlarımız" },
  { href: "/hakkimizda", label: "Hakkımızda" },
  { href: "/iletisim", label: "İletişim" },
];

export function DemoBanner() {
  return (
    <div className="bg-accent px-4 py-1.5 text-center text-xs font-semibold tracking-wide text-ink">
      DEMO · Örnek Araçlar — Bu sitedeki ilanlar ve görseller temsilidir, gerçek satış teklifi değildir.
    </div>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-baseline gap-1.5" aria-label="Mir Motors ana sayfa">
      <span className={`font-display text-xl font-bold tracking-[0.2em] ${light ? "text-white" : "text-ink"}`}>MIR</span>
      <span className="font-display text-xl font-light tracking-[0.2em] text-accent">MOTORS</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo light />
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm font-medium text-zinc-300 transition hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>
        <MobileNav items={NAV} />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-ink text-zinc-400">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            Seçkin ikinci el araçlar, şeffaf ekspertiz ve kişisel danışmanlık. (Demo içerik)
          </p>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold text-white">Keşfet</p>
          <ul className="space-y-2">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="hover:text-white">{n.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold text-white">Yasal Bilgilendirme</p>
          <p className="leading-relaxed">
            Bu site bir demo sürümüdür. İlanlar, fiyatlar ve görseller temsilidir. Site üzerinden ödeme, kapora veya
            sözleşme işlemi yapılmaz. Yetki belgesi ve ilan bilgileri gerçek yayından önce eklenecektir.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs">© {new Date().getFullYear()} Mir Motors · Demo</div>
    </footer>
  );
}
