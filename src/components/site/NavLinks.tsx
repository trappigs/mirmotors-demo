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
            className={`relative rounded-lg px-3 py-2 text-[15px] font-semibold transition ${active ? "text-brand" : "text-ink hover:text-brand"}`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
