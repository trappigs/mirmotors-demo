"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {items.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`relative rounded-md px-3.5 py-2 text-sm font-medium transition ${active ? "text-white" : "text-zinc-400 hover:text-white"}`}
          >
            {n.label}
            {active && <span className="absolute inset-x-3.5 -bottom-[13px] h-px bg-accent" />}
          </Link>
        );
      })}
    </nav>
  );
}
