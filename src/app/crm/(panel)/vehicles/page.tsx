import Link from "next/link";
import { prisma } from "@/lib/db";
import { STATUS_LABELS, VEHICLE_STATUSES, type VehicleStatus } from "@/lib/constants";
import { formatKm, formatPrice, mediaUrl } from "@/lib/format";
import { StatusBadge } from "@/components/crm/StatusBadge";

export default async function CrmVehiclesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams;
  const validStatus = VEHICLE_STATUSES.includes(status as VehicleStatus) ? status : undefined;
  const vehicles = await prisma.vehicle.findMany({
    where: {
      status: validStatus,
      ...(q ? { OR: [{ brand: { contains: q } }, { model: { contains: q } }, { packageName: { contains: q } }] } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { photos: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1 }, optionedBy: true, _count: { select: { photos: true } } },
  });

  const tab = (s: string | undefined, label: string) => (
    <Link
      key={label}
      href={s ? `/crm/vehicles?status=${s}` : "/crm/vehicles"}
      className={`rounded-full px-3 py-1 text-sm ${validStatus === s ? "bg-ink text-white" : "bg-white text-zinc-700 hover:bg-zinc-200"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Araçlar</h1>
        <div className="flex gap-2">
          <form className="flex gap-2">
            {validStatus && <input type="hidden" name="status" value={validStatus} />}
            <input name="q" defaultValue={q} placeholder="Marka / model ara" className="input w-48" />
          </form>
          <Link href="/crm/vehicles/new" className="btn-primary">+ Araç ekle</Link>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {tab(undefined, "Tümü")}
        {VEHICLE_STATUSES.map((s) => tab(s, STATUS_LABELS[s]))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="p-3">Araç</th>
              <th className="p-3">Yıl / Km</th>
              <th className="p-3">Fiyat</th>
              <th className="p-3">Durum</th>
              <th className="p-3">Opsiyon</th>
              <th className="p-3">Foto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {vehicles.map((v) => (
              <tr key={v.id} className="hover:bg-zinc-50">
                <td className="p-3">
                  <Link href={`/crm/vehicles/${v.id}`} className="flex items-center gap-3 font-medium hover:underline">
                    <span className="h-10 w-16 shrink-0 overflow-hidden rounded bg-zinc-200">
                      {v.photos[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(v.photos[0].path)!} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span>{v.brand} {v.model} <span className="text-zinc-500">{v.packageName}</span></span>
                  </Link>
                </td>
                <td className="p-3">{v.year} · {formatKm(v.km)}</td>
                <td className="p-3">{formatPrice(v.price)}</td>
                <td className="p-3"><StatusBadge status={v.status} /></td>
                <td className="p-3">{v.optionedBy?.name ?? "—"}</td>
                <td className="p-3">{v._count.photos}</td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-zinc-500">Araç bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
