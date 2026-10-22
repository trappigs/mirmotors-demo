"use client";
import { useRouter } from "next/navigation";

/** Sıralama seçimi. Mevcut parametreler sunucudan gelir; böylece ilk yüklemede de görünür. */
export function SortSelect({ options, value, params }: { options: { key: string; label: string }[]; value: string; params: Record<string, string> }) {
  const router = useRouter();
  return (
    <label className="relative">
      <span className="sr-only">Sırala</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          next.set("sirala", e.target.value);
          router.push(`/araclar?${next.toString()}`);
        }}
        className="h-11 min-w-[200px] appearance-none rounded-xl border border-zinc-200 bg-white pl-4 pr-10 text-sm font-medium text-ink shadow-sm outline-none transition hover:border-zinc-400 focus:border-accent-dark focus:ring-4 focus:ring-accent/15"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </label>
  );
}
