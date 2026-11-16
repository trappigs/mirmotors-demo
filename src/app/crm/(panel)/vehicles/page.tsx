import Link from "next/link";
import { prisma } from "@/lib/db";
import { STATUS_LABELS, VEHICLE_STATUSES, type VehicleStatus } from "@/lib/constants";
import { formatKm, formatPrice, mediaUrl } from "@/lib/format";
import { StatusBadge } from "@/components/crm/StatusBadge";

export default async function CrmVehiclesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams;
  // "yarim": Taslak + Kontrol Bekliyor (CRM ana sayfasındaki "Yarım kalan" bağlantısı).
  // Arşivlenmiş araçlar yalnızca "Arşiv" sekmesinde görünür; diğer tüm sekmelerden ve "Tümü"nden çıkarılır.
  const validStatus = status === "yarim" || VEHICLE_STATUSES.includes(status as VehicleStatus) ? status : undefined;
  const statusWhere =
    validStatus === "yarim" ? { in: ["DRAFT", "REVIEW"] } : validStatus ? validStatus : { not: "ARCHIVED" };
  const vehicles = await prisma.vehicle.findMany({
    where: {
      status: statusWhere,
      // Büyük/küçük harf duyarsız arama ("bmw" → "BMW")
      ...(q
        ? { OR: (["brand", "model", "packageName"] as const).map((f) => ({ [f]: { contains: q, mode: "insensitive" as const } })) }
        : {}),
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
        <h1 className="font-display text-2xl font-bold tracking-tight">Araçlar</h1>
        <div className="flex flex-wrap gap-2">
          <form className="flex gap-2">
            {validStatus && <input type="hidden" name="status" value={validStatus} />}
            <input name="q" defaultValue={q} placeholder="Marka / model ara" className="input w-48" />
          </form>
          <Link href="/crm/vehicles/new" className="btn-accent">+ Yeni araç ekle</Link>
          <Link href="/crm/ayarlar#bildirimler" className="btn-outline" title="Bu cihazda opsiyon / satış bildirimlerini aç">Bildirimler</Link>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {tab(undefined, "Tümü")}
        {tab("yarim", "Yarım kalan")}
        {VEHICLE_STATUSES.filter((s) => s !== "ARCHIVED").map((s) => tab(s, STATUS_LABELS[s]))}
        {tab("ARCHIVED", "Arşiv")}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-left text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <th className="px-4 py-3.5">Araç</th>
              <th className="px-4 py-3.5">Yıl / Km</th>
              <th className="px-4 py-3.5">Fiyat</th>
              <th className="px-4 py-3.5">Durum</th>
              <th className="px-4 py-3.5">Opsiyon</th>
              <th className="px-4 py-3.5">Foto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {vehicles.map((v) => (
              <tr key={v.id} className="transition hover:bg-amber-50/40">
                <td className="px-4 py-3.5">
                  <Link href={`/crm/vehicles/${v.id}`} className="flex items-center gap-3 font-medium hover:underline">
                    <span className="h-11 w-[70px] shrink-0 overflow-hidden rounded-md bg-zinc-200">
                      {v.photos[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(v.photos[0].path)!} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span>{v.brand ?? <em className="text-zinc-500">Marka girilmedi</em>} {v.model} <span className="text-zinc-500">{v.packageName}</span></span>
                  </Link>
                </td>
                <td className="px-4 py-3.5">{v.year ?? "Yıl girilmedi"} · {formatKm(v.km)}</td>
                <td className="px-4 py-3.5">{formatPrice(v.price)}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={v.status} />
                  {(v.status === "DRAFT" || v.status === "REVIEW") && (
                    <span className="mt-1 block text-[11px] text-amber-700" data-testid="not-on-site">Sitede görünmüyor{v._count.photos === 0 ? " · fotoğraf yok" : " · yayımlanmadı"}</span>
                  )}
                </td>
                <td className="px-4 py-3.5">{v.optionedBy?.name ?? "—"}</td>
                <td className="px-4 py-3.5">{v._count.photos}</td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-zinc-500">{validStatus === "ARCHIVED" ? "Arşivde araç yok." : "Araç bulunamadı."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
