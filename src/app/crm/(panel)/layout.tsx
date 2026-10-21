import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { LogoutButton } from "@/components/crm/LogoutButton";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/crm" className="font-display font-bold tracking-[0.2em]">
              MIR <span className="font-light text-accent">CRM</span>
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/crm" className="text-zinc-300 hover:text-white">Özet</Link>
              <Link href="/crm/vehicles" className="text-zinc-300 hover:text-white">Araçlar</Link>
              <Link href="/crm/vehicles/new" className="text-zinc-300 hover:text-white">+ Araç ekle</Link>
              <a href="/araclar" target="_blank" className="text-zinc-300 hover:text-white">Siteyi aç ↗</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm" data-testid="current-user">
              {user.name} <span className="text-zinc-400">· {ROLE_LABELS[user.role]}</span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="bg-accent/90 px-4 py-1 text-center text-xs font-semibold text-ink">DEMO ORTAMI — örnek veriler</div>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
