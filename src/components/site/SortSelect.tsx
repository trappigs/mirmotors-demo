"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SortSelect({ options, value }: { options: { key: string; label: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Sırala</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("sirala", e.target.value);
          router.push(`${pathname}?${next.toString()}`);
        }}
        className="input w-auto py-2 font-medium"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
