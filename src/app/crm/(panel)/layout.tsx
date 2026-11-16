import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { LogoutButton } from "@/components/crm/LogoutButton";
import { MobileNav } from "@/components/crm/MobileNav";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    // crm-app: telefonda form alanı/düğme boyutu kuralları yalnızca CRM'e uygulanır (globals.css).
    <div className="crm-app min-h-dvh bg-[#f3f3f1]">
      {/* Ana ekran uygulamasında (iOS black-translucent) durum çubuğunun altında kalmasın diye üstte safe-area boşluğu */}
      <header className="bg-ink pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
          <div className="flex items-center gap-6">
            <Link href="/crm" className="font-display font-bold tracking-[0.2em]">
              MIR <span className="font-light text-accent">CRM</span>
            </Link>
            <nav className="hidden flex-wrap items-center gap-4 text-sm sm:flex">
              <Link href="/crm" className="text-zinc-300 hover:text-white">Özet</Link>
              <Link href="/crm/vehicles" className="text-zinc-300 hover:text-white">Araçlar</Link>
              <Link href="/crm/mesajlar" className="text-zinc-300 hover:text-white">Mesajlar</Link>
              <Link href="/crm/vehicles/new" className="rounded-md bg-accent/15 px-2.5 py-1 font-semibold text-accent hover:bg-accent hover:text-white">+ Araç ekle</Link>
              {user.role === "ADMIN" && <Link href="/crm/ayarlar" className="text-zinc-300 hover:text-white">Ayarlar</Link>}
              <a href="/araclar" target="_blank" className="text-zinc-300 hover:text-white">Siteyi aç ↗</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm" data-testid="current-user">
              {user.name} <span className="text-zinc-400">· {ROLE_LABELS[user.role]}</span>
            </span>
            {/* Telefonda çıkış "Menü" sayfasındadır */}
            <span className="hidden sm:inline">
              <LogoutButton />
            </span>
          </div>
        </div>
      </header>
      <div className="bg-brand px-4 py-1 text-center text-xs font-semibold text-white">DEMO ORTAMI — örnek veriler</div>
      {/* Telefonda alt sekme çubuğu içeriği örtmesin diye altta ek boşluk */}
      <main className="mx-auto max-w-7xl pb-[calc(6rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-6 sm:pb-8 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pt-8">{children}</main>
      <MobileNav isAdmin={user.role === "ADMIN"} userName={user.name} roleLabel={ROLE_LABELS[user.role]} />
    </div>
  );
}
