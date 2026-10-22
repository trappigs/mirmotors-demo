"use client";
import Link from "next/link";
import { useState } from "react";

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid h-11 w-11 place-items-center rounded-xl border border-zinc-200 text-ink"
        aria-expanded={open}
        aria-label="Menüyü aç/kapat"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <nav className="absolute inset-x-0 top-full border-b border-zinc-200 bg-white px-4 pb-4 shadow-lg">
          {items.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block border-b border-zinc-100 py-3.5 text-base font-medium text-ink last:border-0">
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
