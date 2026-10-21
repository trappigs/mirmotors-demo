import Link from "next/link";
import { prisma } from "@/lib/db";
import { STATUS_LABELS, VEHICLE_STATUSES } from "@/lib/constants";
import { formatDateTime, formatPrice } from "@/lib/format";
import { ACTION_LABELS } from "@/lib/vehicle-status";
import { StatusBadge } from "@/components/crm/StatusBadge";

export default async function DashboardPage() {
  const [counts, recent, sales] = await Promise.all([
    prisma.vehicle.groupBy({ by: ["status"], _count: true }),
    prisma.statusHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { user: true, vehicle: { select: { id: true, brand: true, model: true } } },
    }),
    prisma.sale.findMany({
      where: { completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 5,
      include: { vehicle: true, startedBy: true },
    }),
  ]);
  const by = Object.fromEntries(counts.map((c) => [c.status, c._count])) as Record<string, number>;
  const total = VEHICLE_STATUSES.filter((s) => s !== "SOLD").reduce((sum, s) => sum + (by[s] ?? 0), 0);

  const cards = [
    { label: "Toplam stok", value: total, hint: "Satılanlar hariç", href: "/crm/vehicles", bar: "bg-ink" },
    { label: "Satıştaki araçlar", value: by.AVAILABLE ?? 0, hint: "Sitede yayında", href: "/crm/vehicles?status=AVAILABLE", bar: "bg-emerald-500" },
    { label: "Opsiyonlu araçlar", value: by.OPTIONED ?? 0, hint: "Sitede etiketli", href: "/crm/vehicles?status=OPTIONED", bar: "bg-amber-400" },
    { label: "Satış bekleyenler", value: by.SALE_PENDING ?? 0, hint: "Siteden gizli", href: "/crm/vehicles?status=SALE_PENDING", bar: "bg-sky-500" },
    { label: "Satılan araçlar", value: by.SOLD ?? 0, hint: "Kayıtlar korunur", href: "/crm/vehicles?status=SOLD", bar: "bg-zinc-400" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Galeri özeti</h1>
          <p className="mt-1 text-sm text-zinc-500">Stok durumu ve son işlemler</p>
        </div>
        <Link href="/crm/vehicles/new" className="btn-accent px-5 py-3 text-[15px]">+ Yeni araç ekle</Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card relative flex min-h-[132px] flex-col justify-between overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-md" data-testid={`stat-${c.label}`}>
            <span className={`absolute inset-x-0 top-0 h-1 ${c.bar}`} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{c.label}</p>
            <div>
              <p className="font-display text-4xl font-bold tracking-tight">{c.value}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{c.hint}</p>
            </div>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-display font-semibold">Son işlemler</h2>
          <ul className="mt-4 divide-y divide-zinc-100 text-sm">
            {recent.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>
                  <Link href={`/crm/vehicles/${h.vehicle.id}`} className="font-medium hover:underline">{h.vehicle.brand} {h.vehicle.model}</Link>
                  {" · "}{ACTION_LABELS[h.action as keyof typeof ACTION_LABELS] ?? h.action}
                  {h.fromStatus !== h.toStatus && <span className="text-zinc-500"> → {STATUS_LABELS[h.toStatus as keyof typeof STATUS_LABELS]}</span>}
                </span>
                <span className="text-xs text-zinc-500">{h.user.name} · {formatDateTime(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-6">
          <h2 className="font-display font-semibold">Son tamamlanan satışlar</h2>
          {sales.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">Henüz satış yok.</p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-100 text-sm">
              {sales.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <Link href={`/crm/vehicles/${s.vehicleId}`} className="font-medium hover:underline">{s.vehicle.brand} {s.vehicle.model} {s.vehicle.year}</Link>
                  <span className="flex items-center gap-2 text-xs text-zinc-500">
                    {s.agreedPrice ? formatPrice(s.agreedPrice) : ""} · {s.startedBy.name} · <StatusBadge status="SOLD" />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
