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
    { label: "Toplam stok", value: total, hint: "Satılanlar hariç", href: "/crm/vehicles" },
    { label: "Satıştaki araçlar", value: by.AVAILABLE ?? 0, href: "/crm/vehicles?status=AVAILABLE" },
    { label: "Opsiyonlu araçlar", value: by.OPTIONED ?? 0, href: "/crm/vehicles?status=OPTIONED" },
    { label: "Satış bekleyenler", value: by.SALE_PENDING ?? 0, href: "/crm/vehicles?status=SALE_PENDING" },
    { label: "Satılan araçlar", value: by.SOLD ?? 0, href: "/crm/vehicles?status=SOLD" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Galeri özeti</h1>
        <Link href="/crm/vehicles/new" className="btn-primary">+ Yeni araç ekle</Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card p-5 transition hover:border-zinc-400" data-testid={`stat-${c.label}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{c.label}</p>
            <p className="mt-2 font-display text-3xl font-bold">{c.value}</p>
            {c.hint && <p className="text-xs text-zinc-400">{c.hint}</p>}
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Son işlemler</h2>
          <ul className="mt-4 divide-y divide-zinc-100 text-sm">
            {recent.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
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
        <section className="card p-5">
          <h2 className="font-semibold">Son tamamlanan satışlar</h2>
          {sales.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">Henüz satış yok.</p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-100 text-sm">
              {sales.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
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
