import Link from "next/link";
import { prisma } from "@/lib/db";
import { STATUS_LABELS } from "@/lib/constants";
import { formatDateTime, vehicleTitle } from "@/lib/format";
import { ACTION_LABELS } from "@/lib/vehicle-status";

/**
 * CRM başlangıç ekranı: telefonda tek elle kullanılacak beş büyük kutucuk ve kısa "son işlemler" listesi.
 * Grafik ve ayrıntılı istatistik bilerek yok; personel buradan doğrudan işe geçer.
 */
export default async function DashboardPage() {
  const [counts, recent] = await Promise.all([
    prisma.vehicle.groupBy({ by: ["status"], _count: true }),
    prisma.statusHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: true, vehicle: { select: { id: true, brand: true, model: true } } },
    }),
  ]);
  // ARCHIVED (yanlış/mükerrer kayıt) hiçbir sayıma girmez; yalnızca adı geçen durumlar okunur.
  const by = Object.fromEntries(counts.map((c) => [c.status, c._count])) as Record<string, number>;
  const n = (s: string) => by[s] ?? 0;

  const tiles: { label: string; href: string; count?: number; hint: string; testid: string; accent?: boolean }[] = [
    { label: "Yeni Araç Ekle", href: "/crm/vehicles/new", hint: "Belgeden ya da elle", testid: "home-new", accent: true },
    { label: "Araçlarım / Stok", href: "/crm/vehicles?status=AVAILABLE", count: n("AVAILABLE"), hint: "Satışta, sitede yayında", testid: "stat-Satıştaki araçlar" },
    { label: "Yarım Kalan Araçlar", href: "/crm/vehicles?status=yarim", count: n("DRAFT") + n("REVIEW"), hint: "Taslak ve kontrol bekleyenler", testid: "home-yarim" },
    { label: "Opsiyonlu Araçlar", href: "/crm/vehicles?status=OPTIONED", count: n("OPTIONED"), hint: "Sitede etiketli", testid: "stat-Opsiyonlu araçlar" },
    // "Satılan araçlar" ifadesi E2E senaryosunda aranır; ipucu metninde birebir korunur.
    { label: "Satılan Araçlar", href: "/crm/vehicles?status=SOLD", count: n("SOLD"), hint: "Satılan araçlar kayıtta kalır", testid: "stat-Satılan araçlar" },
  ];
  const salePending = n("SALE_PENDING");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Ana sayfa</h1>
        <p className="mt-1 text-sm text-zinc-500">Ne yapmak istiyorsunuz?</p>
      </div>

      <nav aria-label="Hızlı işlemler" className="grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <Link
            key={t.testid}
            href={t.href}
            data-testid={t.testid}
            className={`flex min-h-[76px] items-center justify-between gap-4 rounded-2xl px-5 py-4 shadow-sm transition active:scale-[0.99] ${
              t.accent
                ? "bg-brand text-white hover:bg-brand-dark sm:col-span-2"
                : "border border-line bg-white text-ink hover:border-brand"
            }`}
          >
            <span className="min-w-0">
              <span className="block font-display text-xl font-bold leading-tight">{t.accent ? `+ ${t.label}` : t.label}</span>
              <span className={`mt-0.5 block text-sm ${t.accent ? "text-white/80" : "text-zinc-500"}`}>{t.hint}</span>
            </span>
            {t.count !== undefined ? (
              <span className="shrink-0 font-display text-3xl font-bold tabular-nums" aria-label={`${t.count} araç`}>{t.count}</span>
            ) : (
              <span className="shrink-0 text-3xl font-light" aria-hidden>›</span>
            )}
          </Link>
        ))}
      </nav>

      {salePending > 0 && (
        <p className="text-sm text-zinc-600">
          <Link href="/crm/vehicles?status=SALE_PENDING" className="font-semibold text-brand hover:underline">
            {salePending} araç satış bekliyor →
          </Link>
        </p>
      )}

      <section className="card p-5">
        <h2 className="font-display font-semibold">Son işlemler</h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Henüz işlem yok.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100 text-sm">
            {recent.map((h) => (
              <li key={h.id} className="py-2.5">
                <Link href={`/crm/vehicles/${h.vehicle.id}`} className="font-medium hover:underline">{vehicleTitle(h.vehicle)}</Link>
                {" · "}{ACTION_LABELS[h.action as keyof typeof ACTION_LABELS] ?? h.action}
                {h.fromStatus !== h.toStatus && (
                  <span className="text-zinc-500"> → {STATUS_LABELS[h.toStatus as keyof typeof STATUS_LABELS] ?? h.toStatus}</span>
                )}
                <span className="block text-xs text-zinc-500">{h.user.name} · {formatDateTime(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
