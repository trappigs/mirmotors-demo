import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PUBLIC_STATUSES, STATUS_LABELS, type VehicleStatus } from "@/lib/constants";
import { formatDateTime, formatPrice, mediaUrl, parseEquipment } from "@/lib/format";
import { ACTION_LABELS } from "@/lib/vehicle-status";
import { canEditDetails, mediaChangeBlock } from "@/lib/permissions";
import { MediaManager } from "@/components/crm/MediaManager";
import { StatusActions } from "@/components/crm/StatusActions";
import { VehicleForm, type VehicleFormValues } from "@/components/crm/VehicleForm";

const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export default async function CrmVehicleDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { created } = await searchParams;
  const v = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      photos: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
      optionedBy: true,
      createdBy: true,
      history: { orderBy: { createdAt: "desc" }, include: { user: true } },
      sales: { orderBy: { startedAt: "desc" }, include: { startedBy: true, completedBy: true } },
    },
  });
  if (!v) notFound();

  const actor = { id: user.id, role: user.role };
  const locked = !canEditDetails(v, actor);
  const mediaLocked = mediaChangeBlock(v, actor) !== null;
  const isPublic = PUBLIC_STATUSES.includes(v.status as VehicleStatus);
  const initial: VehicleFormValues = {
    brand: v.brand, model: v.model, packageName: s(v.packageName), year: s(v.year), km: s(v.km), price: s(v.price),
    fuel: v.fuel, transmission: v.transmission, bodyType: v.bodyType, color: s(v.color), enginePower: s(v.enginePower),
    engineCc: s(v.engineCc), drivetrain: s(v.drivetrain), description: s(v.description), equipment: parseEquipment(v.equipment),
    paintedParts: s(v.paintedParts), changedParts: s(v.changedParts), damageNote: s(v.damageNote), tramerAmount: s(v.tramerAmount),
    expertiseSummary: s(v.expertiseSummary), legalListingNo: s(v.legalListingNo), legalAuthorizationNo: s(v.legalAuthorizationNo),
    legalPlate: s(v.legalPlate), legalVin: s(v.legalVin), legalOwnerConsent: v.legalOwnerConsent,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/crm/vehicles" className="text-sm text-zinc-500 hover:text-ink">← Araçlar</Link>
          <h1 className="mt-2 font-display text-2xl font-bold">{v.brand} {v.model} <span className="font-normal text-zinc-500">{v.packageName}</span></h1>
          <p className="text-sm text-zinc-500">
            {v.year} · {formatPrice(v.price)} · Oluşturan: {v.createdBy.name} · {formatDateTime(v.createdAt)}
            {v.aiDraftMode && <span className="ml-2 rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-800">AI taslağı ({v.aiDraftMode === "LIVE" ? "canlı" : "simülasyon"})</span>}
          </p>
        </div>
        {isPublic ? (
          <a href={`/araclar/${v.id}`} target="_blank" className="btn-outline">Sitede görüntüle ↗</a>
        ) : (
          <span className="text-sm text-zinc-500">Müşteri sitesinde görünmüyor ({STATUS_LABELS[v.status as VehicleStatus]})</span>
        )}
      </div>

      {created && v.status === "DRAFT" && (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Taslak kaydedildi. Şimdi fotoğrafları yükleyin ve yayımlayın.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <MediaManager
            vehicleId={v.id}
            photos={v.photos.map((p) => ({ id: p.id, url: mediaUrl(p.path)!, isCover: p.isCover }))}
            videoUrl={mediaUrl(v.videoPath)}
            pdfUrl={v.expertisePdfPath ? `/api/crm/files/${v.expertisePdfPath}` : null}
            locked={mediaLocked}
          />
          <div>
            <h2 className="mb-3 font-display text-lg font-semibold">Araç bilgileri {locked && <span className="text-sm font-normal text-zinc-500">(bu durumda düzenleme yetkiniz yok)</span>}</h2>
            <VehicleForm mode="edit" vehicleId={v.id} initial={initial} readOnly={locked} />
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <StatusActions
            vehicleId={v.id}
            status={v.status}
            photoCount={v.photos.length}
            user={{ id: user.id, role: user.role }}
            optionedBy={v.optionedBy ? { id: v.optionedBy.id, name: v.optionedBy.name } : null}
            price={v.price}
          />

          {v.sales.length > 0 && (
            <section className="card p-5" data-testid="sales-records">
              <h2 className="font-semibold">Satış kayıtları</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {v.sales.map((sale) => (
                  <li key={sale.id} className="rounded-md bg-zinc-50 p-3">
                    <p className="font-medium">
                      {sale.completedAt ? "Tamamlandı" : sale.cancelledAt ? "İptal edildi" : "Devam ediyor"}
                      {sale.agreedPrice ? ` · ${formatPrice(sale.agreedPrice)}` : ""}
                    </p>
                    <p className="text-zinc-600">Başlatan: {sale.startedBy.name} · {formatDateTime(sale.startedAt)}</p>
                    {sale.completedAt && (
                      <p className="text-zinc-600">
                        Noter devri: {sale.notaryDate ? new Intl.DateTimeFormat("tr-TR").format(sale.notaryDate) : "—"} · Tamamlayan: {sale.completedBy?.name}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card p-5" data-testid="history">
            <h2 className="font-semibold">İşlem geçmişi</h2>
            <ol className="mt-3 space-y-3 border-l-2 border-zinc-200 pl-4 text-sm">
              {v.history.map((h) => (
                <li key={h.id}>
                  <p className="font-medium">{ACTION_LABELS[h.action as keyof typeof ACTION_LABELS] ?? h.action}</p>
                  <p className="text-xs text-zinc-500">
                    {h.fromStatus && h.fromStatus !== h.toStatus ? `${STATUS_LABELS[h.fromStatus as VehicleStatus]} → ` : ""}
                    {STATUS_LABELS[h.toStatus as VehicleStatus]} · {h.user.name} · {formatDateTime(h.createdAt)}
                  </p>
                  {h.note && <p className="text-xs text-zinc-600">{h.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
