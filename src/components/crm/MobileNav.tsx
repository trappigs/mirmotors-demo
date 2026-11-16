"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Telefonda (sm altı) CRM'in alt sekme çubuğu ve "Menü" sayfası.
 * Masaüstünde gizlidir; üst menü aynen kalır. iPhone ana ekran çubuğu için safe-area boşluğu bırakılır.
 */
type Props = { isAdmin: boolean; userName: string; roleLabel: string };

type Tab = "home" | "new" | "list" | "yarim" | "menu";

function activeTab(pathname: string, status: string | null): Tab | null {
  if (pathname === "/crm") return "home";
  if (pathname.startsWith("/crm/vehicles/new")) return "new";
  if (pathname === "/crm/vehicles" && status === "yarim") return "yarim";
  if (pathname.startsWith("/crm/vehicles")) return "list";
  if (pathname.startsWith("/crm/ayarlar") || pathname.startsWith("/crm/mesajlar")) return "menu";
  return null;
}

const ICONS: Record<Tab, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z" />,
  new: <path d="M12 5v14M5 12h14" />,
  list: (
    <>
      <path d="M5 16l1.5-5A2 2 0 0 1 8.4 9.5h7.2a2 2 0 0 1 1.9 1.5L19 16" />
      <path d="M4 16h16v3H4zM7 19v1.5M17 19v1.5" />
    </>
  ),
  yarim: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
};

function Icon({ tab }: { tab: Tab }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[tab]}
    </svg>
  );
}

function NavBar({ status, ...props }: Props & { status: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = open ? "menu" : activeTab(pathname, status);

  // Menü açıkken Esc ile kapanır.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const tabs: { key: Exclude<Tab, "menu">; label: string; href: string }[] = [
    { key: "home", label: "Ana sayfa", href: "/crm" },
    { key: "new", label: "Araç ekle", href: "/crm/vehicles/new" },
    { key: "list", label: "Araçlar", href: "/crm/vehicles" },
    { key: "yarim", label: "Yarım", href: "/crm/vehicles?status=yarim" },
  ];
  const itemClass = (key: Tab) =>
    `flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${
      active === key ? "text-gold" : "text-zinc-400 active:text-white"
    }`;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 sm:hidden" role="dialog" aria-modal="true" aria-label="Menü" data-testid="mobile-menu">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Menüyü kapat" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-2 shadow-2xl">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-zinc-300" aria-hidden />
            <p className="px-5 py-2 text-sm text-zinc-500">
              <span className="font-semibold text-ink">{props.userName}</span> · {props.roleLabel}
            </p>
            <ul className="divide-y divide-zinc-100 border-t border-zinc-100 text-base">
              <li>
                <Link href="/crm/mesajlar" onClick={() => setOpen(false)} className="flex min-h-[52px] items-center px-5 font-medium active:bg-zinc-50">
                  WhatsApp mesajları
                </Link>
              </li>
              {props.isAdmin && (
                <li>
                  <Link href="/crm/ayarlar" onClick={() => setOpen(false)} className="flex min-h-[52px] items-center px-5 font-medium active:bg-zinc-50">
                    Ayarlar
                  </Link>
                </li>
              )}
              <li>
                <a href="/araclar" target="_blank" rel="noopener" onClick={() => setOpen(false)} className="flex min-h-[52px] items-center px-5 font-medium active:bg-zinc-50">
                  Siteyi aç ↗
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    window.location.href = "/crm/login";
                  }}
                  className="flex min-h-[52px] w-full items-center px-5 text-left font-medium text-red-700 active:bg-zinc-50"
                >
                  Çıkış
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}
      <nav
        aria-label="Alt menü"
        data-testid="mobile-nav"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-ink pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] sm:hidden"
      >
        <div className="grid grid-cols-5">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              onClick={() => setOpen(false)}
              aria-current={active === t.key ? "page" : undefined}
              className={itemClass(t.key)}
            >
              <Icon tab={t.key} />
              {t.label}
            </Link>
          ))}
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={itemClass("menu")}>
            <Icon tab="menu" />
            Menü
          </button>
        </div>
      </nav>
    </>
  );
}

export function MobileNav(props: Props) {
  // CRM sayfaları her istekte oturumla çizilir (dinamik); bu yüzden Suspense sarmalayıcısına gerek yok ve vurgu ilk açılışta doğru olur.
  const status = useSearchParams().get("status");
  return <NavBar {...props} status={status} />;
}
