import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PUBLIC_STATUSES, STATUS_LABELS, type VehicleStatus } from "@/lib/constants";
import { formatDateTime, formatPrice, mediaUrl } from "@/lib/format";
import { ACTION_LABELS } from "@/lib/vehicle-status";
import { canEditDetails, mediaChangeBlock } from "@/lib/permissions";
import { MediaManager } from "@/components/crm/MediaManager";
import { storageDriver } from "@/lib/storage";
import { StatusActions } from "@/components/crm/StatusActions";
import { VehicleForm } from "@/components/crm/VehicleForm";
import { PublishChecklist } from "@/components/crm/PublishChecklist";
import { BodyPartsEditor } from "@/components/crm/BodyPartsEditor";
import { DocReviewPanel } from "@/components/crm/DocReviewPanel";
import { VehicleDocuments } from "@/components/crm/VehicleDocuments";
import { parseReview } from "@/lib/doc-review";
import { toPartMap } from "@/lib/body-parts";
import { formInitial, vehicleChecklist } from "@/lib/vehicle-crm";
import { autoListingNo } from "@/lib/listing-rules";

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
      parts: { include: { updatedBy: { select: { name: true } } }, orderBy: { updatedAt: "desc" } },
      documents: { orderBy: [{ kind: "desc" }, { page: "asc" }], include: { createdBy: { select: { name: true } } } },
    },
  });
  if (!v) notFound();

  const actor = { id: user.id, role: user.role };
  const locked = !canEditDetails(v, actor);
  const mediaLocked = mediaChangeBlock(v, actor) !== null;
  const isPublic = PUBLIC_STATUSES.includes(v.status as VehicleStatus);
  const initial = formInitial(v);
  const checklist = await vehicleChecklist(v);
  const lastPart = v.parts[0];
  const review = parseReview(v.docReview);
  // "Satıldı" formundaki satan personel seçimi için (yalnızca satılabilir durumdaki araçta).
  const staff = v.status === "AVAILABLE" || v.status === "OPTIONED" ? await prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  const archiveRow = v.status === "ARCHIVED" ? v.history.find((h) => h.action === "archive") : undefined;
  const archivedInfo = v.status === "ARCHIVED"
    ? `${archiveRow?.user.name ?? "—"} · ${v.archivedAt ? formatDateTime(v.archivedAt) : "—"}${v.archivedFromStatus ? ` · önceki durum: ${STATUS_LABELS[v.archivedFromStatus as VehicleStatus] ?? v.archivedFromStatus}` : ""}`
    : null;
  const oldBodyText = [v.paintedParts && `Boyalı: ${v.paintedParts}`, v.changedParts && `Değişen: ${v.changedParts}`].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/crm/vehicles" className="text-sm text-zinc-500 hover:text-ink">← Araçlar</Link>
          <h1 className="mt-2 font-display text-2xl font-bold">{v.brand ?? "Marka girilmedi"} {v.model} <span className="font-normal text-zinc-500">{v.packageName}</span></h1>
          <p className="text-sm text-zinc-500">
            İlan no {v.legalListingNo ?? autoListingNo(v.id)} · {v.year ?? "Yıl girilmedi"} · {formatPrice(v.price)} · Oluşturan: {v.createdBy.name} · {formatDateTime(v.createdAt)}
            {v.aiDraftMode && <span className="ml-2 rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-800">AI taslağı ({v.aiDraftMode === "LIVE" ? "canlı" : "simülasyon"})</span>}
          </p>
        </div>
        {isPublic ? (
          <a href={`/araclar/${v.id}`} target="_blank" className="btn-outline">Sitede görüntüle ↗</a>
        ) : (
          <span className="text-sm text-zinc-500">Müşteri sitesinde görünmüyor ({STATUS_LABELS[v.status as VehicleStatus]})</span>
        )}
      </div>

      {(v.status === "DRAFT" || v.status === "REVIEW") && !locked && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent/40 bg-accent/5 p-4 text-sm" data-testid="wizard-cta">
          <p>{created ? "Taslak kaydedildi. " : ""}Eksikleri adım adım tamamlamak için: bilgiler → kaporta ve hasar → fotoğraf → yayın.</p>
          <Link href={`/crm/vehicles/${v.id}/tamamla`} className="btn-primary">Adım adım tamamla</Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {review && <DocReviewPanel vehicleId={v.id} review={review} status={v.status} readOnly={locked} />}
          <MediaManager
            direct={storageDriver() === "blob"}
            vehicleId={v.id}
            photos={[...v.photos].sort((a, b) => a.sortOrder - b.sortOrder).map((p) => ({ id: p.id, url: mediaUrl(p.path)!, isCover: p.isCover }))}
            videoUrl={mediaUrl(v.videoPath)}
            videoPublic={v.videoPublic}
            videoFromAi={Boolean(v.aiDraftMode)}
            pdfUrl={v.expertisePdfPath ? `/api/crm/files/${v.expertisePdfPath}` : null}
            locked={mediaLocked}
          />
          <VehicleDocuments
            vehicleId={v.id}
            readOnly={locked}
            docs={v.documents.map((d) => ({ id: d.id, path: d.path, kind: d.kind, page: d.page, by: d.createdBy.name, quality: JSON.parse(d.quality ?? "[]") as string[] }))}
          />
          <BodyPartsEditor
            vehicleId={v.id}
            staff={toPartMap(v.parts)}
            report={toPartMap(v.parts, "reportState")}
            readOnly={locked}
            lastUpdate={lastPart ? `${lastPart.updatedBy?.name ?? "—"} · ${formatDateTime(lastPart.updatedAt)}` : null}
          />
          {oldBodyText && <p className="text-xs text-zinc-500">Eski serbest metin kaydı (şemaya aktarılmadı): {oldBodyText}</p>}
          <div>
            <h2 className="mb-3 font-display text-lg font-semibold">Araç bilgileri {locked && <span className="text-sm font-normal text-zinc-500">(bu durumda düzenleme yetkiniz yok)</span>}</h2>
            <VehicleForm mode="edit" vehicleId={v.id} initial={initial} readOnly={locked} published={v.status !== "DRAFT"} version={v.updatedAt.toISOString()} />
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
            canArchive={user.role === "ADMIN" ? ["REVIEW", "DRAFT", "AVAILABLE"].includes(v.status) : (v.status === "REVIEW" || v.status === "DRAFT") && v.createdById === user.id}
            archivedInfo={archivedInfo}
            staff={staff}
          />

          {v.status !== "SOLD" && v.status !== "ARCHIVED" && <PublishChecklist items={checklist.items} vehicleId={v.id} compact={v.status !== "DRAFT" && v.status !== "REVIEW"} />}

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
