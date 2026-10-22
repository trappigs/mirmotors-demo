"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {items.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`rounded-lg px-3.5 py-2 text-[15px] font-medium transition ${active ? "bg-zinc-100 text-ink" : "text-zinc-600 hover:bg-zinc-50 hover:text-ink"}`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
