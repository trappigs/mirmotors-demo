import Link from "next/link";
import type { CheckItem } from "@/lib/listing-rules";
import { checkTarget, fixHref } from "@/lib/fix-targets";

/**
 * Yayın kontrol listesi: mevzuat (Yönetmelik m.20/2, 21/1-a) ve Mir Motors kuralları ayrı gruplarda.
 * Eksik her madde yayını engeller (sunucu da aynı kuralı uygular). Eksik maddeye tıklanınca sihirbazın ilgili adımı ve alanı açılır.
 */
export function PublishChecklist({ items, vehicleId, compact }: { items: CheckItem[]; vehicleId: string; compact?: boolean }) {
  const groups: [CheckItem["group"], string, string][] = [
    ["LEGAL", "İlanda bulunması zorunlu bilgiler", "İkinci el araç ticareti yönetmeliği gereği"],
    ["RULE", "Galeri kuralları", ""],
  ];
  const missing = items.filter((i) => !i.ok);
  return (
    <section className="card p-5" data-testid="publish-checklist">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Yayın kontrolü</h2>
        <span className={`text-xs font-semibold ${missing.length ? "text-amber-700" : "text-emerald-700"}`}>
          {items.length - missing.length}/{items.length} tamam
        </span>
      </div>
      <p className={`mt-1 text-xs ${missing.length ? "text-red-700" : "text-zinc-500"}`}>
        {missing.length ? `${missing.length} madde tamamlanmadan ilan yayımlanamaz.` : "Tüm zorunlu maddeler tamam."}
      </p>
      {groups.map(([g, title, sub]) => {
        const list = items.filter((i) => i.group === g && (!compact || !i.ok));
        if (!list.length) return null;
        return (
          <div key={g} className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
            {sub && <p className="text-[11px] text-zinc-400">{sub}</p>}
            <ul className="mt-2 space-y-1.5 text-sm">
              {list.map((i) => (
                <li key={i.key} className="flex gap-2" data-check={i.key} data-ok={i.ok ? "1" : "0"}>
                  <span aria-hidden className={i.ok ? "text-emerald-600" : "text-red-600"}>{i.ok ? "✓" : "✕"}</span>
                  <span className="min-w-0">
                    {i.ok ? (
                      <span className="text-zinc-600">{i.label}</span>
                    ) : (
                      <Link href={fixHref(vehicleId, checkTarget(i.key))} className="font-medium text-red-700 hover:underline">{i.label}</Link>
                    )}
                    {!i.ok && <span className="block text-xs text-zinc-600">{i.reason}</span>}
                    {!i.ok && i.detail && <span className="block text-xs text-zinc-500">{i.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">EİDS doğrulaması: yapılmadı</p>
    </section>
  );
}
