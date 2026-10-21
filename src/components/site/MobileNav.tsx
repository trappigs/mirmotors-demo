"use client";
import Link from "next/link";
import { useState } from "react";

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-2 text-white"
        aria-expanded={open}
        aria-label="Menüyü aç/kapat"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <nav className="absolute inset-x-0 top-16 border-b border-white/10 bg-ink px-4 pb-4">
          {items.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block py-3 text-base font-medium text-zinc-200">
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
