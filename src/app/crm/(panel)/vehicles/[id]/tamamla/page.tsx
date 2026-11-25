import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditDetails, mediaChangeBlock } from "@/lib/permissions";
import { formatDateTime, formatKm, formatPrice, mediaUrl } from "@/lib/format";
import { storageDriver } from "@/lib/storage";
import { toPartMap } from "@/lib/body-parts";
import { parseReview, reviewBlockers } from "@/lib/doc-review";
import { formInitial, vehicleChecklist } from "@/lib/vehicle-crm";
import { DAMAGE_RECORD_LABELS, LIEN_LABELS, autoListingNo, warrantyText } from "@/lib/listing-rules";
import { groupByState } from "@/lib/body-parts";
import { parseEquipment } from "@/lib/format";
import { aiFieldFilled, checkTarget, fixHref } from "@/lib/fix-targets";
import { WizardSteps } from "@/components/crm/WizardSteps";
import { WizardStepForm } from "@/components/crm/WizardStepForm";
import { BodyPartsEditor } from "@/components/crm/BodyPartsEditor";
import { MediaManager } from "@/components/crm/MediaManager";
import { DocReviewPanel } from "@/components/crm/DocReviewPanel";
import { QuickIdentityEdit } from "@/components/crm/QuickIdentityEdit";
import { PublishChecklist } from "@/components/crm/PublishChecklist";
import { StatusActions } from "@/components/crm/StatusActions";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { FixFocus } from "@/components/crm/FixFocus";
import { PendingSync } from "@/components/crm/PendingSync";

const RUHSAT_FORM_KEYS: Record<string, string> = { plate: "legalPlate", vinLast6: "legalVin", enginePowerHp: "enginePower" };

/**
 * Araç tamamlama sihirbazı (elle ekleme ve belgeden ekleme sonrası): 1 bilgiler · 2 kaporta/hasar/yasal · 3 medya · 4 kontrol ve yayın.
 * Bilgiler otomatik kaydedilir; bölümler arasında serbestçe geçilir. Eksik bilgi geçişi engellemez, yalnızca yayını engeller (sunucuda).
 * 4. adım tek kontrol ekranıdır: eksikler en üstte "Düzelt" bağlantısıyla, belgeden okunan bilgilerin onayı ve yayın aynı yerde.
 * Yalnızca Taslak / Kontrol Bekliyor araçlar içindir; yayımlanan araç kendi sayfasında düzenlenir.
 */
export default async function CompleteVehicleWizard({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ adim?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const step = Math.min(4, Math.max(1, Number((await searchParams).adim) || 1));
  const v = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { sortOrder: "asc" } },
      parts: { include: { updatedBy: { select: { name: true } } }, orderBy: { updatedAt: "desc" } },
      optionedBy: true,
      sales: { select: { id: true } },
    },
  });
  if (!v) notFound();
  const actor = { id: user.id, role: user.role };
  if ((v.status !== "DRAFT" && v.status !== "REVIEW") || !canEditDetails(v, actor)) redirect(`/crm/vehicles/${id}`);

  const { items } = await vehicleChecklist(v);
  // Belge kontrolü son adımda yapılır; 1–3. adımların tamamlanma işareti yalnızca kendi alanlarına bakar
  const stepDone = (n: number) => items.filter((i) => i.step === n && i.key !== "review").every((i) => i.ok);
  const done = [1, 2, 3].filter(stepDone);
  const review = parseReview(v.docReview);
  // Ruhsattan okunan alanlar (belge alan adı → form alanı): formda tek tek kutu yerine özet kartında gösterilir.
  const ruhsatFields = review?.aiFields.filter((f) => f.document === "RUHSAT").map((f) => RUHSAT_FORM_KEYS[f.field] ?? f.field) ?? [];
  const title = [v.brand, v.model, v.packageName].filter(Boolean).join(" ") || "Yeni araç";
  const next = (n: number) => `/crm/vehicles/:id/tamamla?adim=${n}`;
  const lastPart = v.parts[0];
  const missing = items.filter((i) => !i.ok);
  const staffParts = toPartMap(v.parts);
  const openReview = reviewBlockers(review);
  const cover = v.photos.find((p) => p.isCover) ?? v.photos[0];
  const groups = groupByState(staffParts);
  const equipment = parseEquipment(v.equipment);
  const allInfo: [string, string | null][] = [
    ["Marka", v.brand], ["Seri", v.model], ["Model", v.packageName], ["Araç cinsi", v.vehicleClass],
    ["Araç tipi (ruhsat)", v.vehicleType], ["Ticari adı (ruhsat)", v.tradeName && v.tradeName !== v.vehicleType ? v.tradeName : null],
    ["Model yılı", v.year ? String(v.year) : null], ["Kilometre", v.km != null ? formatKm(v.km) : null], ["Fiyat", v.price ? formatPrice(v.price) : null],
    ["Yakıt", v.fuel], ["Vites", v.transmission], ["Kasa tipi", v.bodyType], ["Renk", v.color], ["Plaka", v.legalPlate],
    ["Şasi (son 6)", v.legalVin], ["Motor", [v.engineCc && `${v.engineCc} cc`, v.enginePower && `${v.enginePower} hp`].filter(Boolean).join(" · ") || null],
    ["Çekiş", v.drivetrain], ["Muayene geçerlilik", v.inspectionUntil], ["Takas", v.tradeIn == null ? null : v.tradeIn ? "Takasa uygun" : "Takas yapılmıyor"],
    ["Donanım", equipment.length ? `${equipment.length} donanım` : null],
    ["Kaporta", groups.UNKNOWN.length === 13 ? null : [groups.CHANGED.length && `${groups.CHANGED.length} değişen`, groups.PAINTED.length && `${groups.PAINTED.length} boyalı`, groups.LOCAL_PAINT.length && `${groups.LOCAL_PAINT.length} lokal boyalı`, groups.UNKNOWN.length && `${groups.UNKNOWN.length} bilinmiyor`].filter(Boolean).join(" · ") || "Tüm parçalar orijinal"],
    ["Hasar kaydı", v.damageRecord ? DAMAGE_RECORD_LABELS[v.damageRecord] ?? null : null], ["Tramer", v.tramerAmount != null ? formatPrice(v.tramerAmount) : null],
    ["Rehin / haciz", v.legalLien ? LIEN_LABELS[v.legalLien] ?? null : null], ["Garanti", v.warrantyStatus ? warrantyText(v) : null],
    ["Tescil / satış yetkisi", v.legalRegisteredToCompany ? "İşletme adına tescilli" : v.legalOwnerConsent ? "Araç sahibinden izin alındı" : null],
  ];
  const unreadOpen = review ? review.missing.filter((m) => !aiFieldFilled(m.field, v as unknown as Record<string, unknown>, staffParts)) : [];

  return (
    <div className="space-y-6">
      <FixFocus />
      <div>
        <Link href={`/crm/vehicles/${id}`} className="text-sm text-zinc-500 hover:text-ink">← Araç sayfası</Link>
        <h1 className="mt-2 font-display text-2xl font-bold">{title} <span className="text-base font-normal text-zinc-500">· İlan no {v.legalListingNo ?? autoListingNo(id)}</span></h1>
        <p className="text-sm text-zinc-500">Bilgiler otomatik kaydedilir; bölümler arasında istediğiniz gibi geçebilirsiniz. Yayımlayana kadar araç {v.status === "REVIEW" ? "Kontrol Bekliyor" : "Taslak"} olarak kalır ve müşteriye görünmez.</p>
      </div>
      <WizardSteps current={step} vehicleId={id} done={done} />

      {step === 1 && (
        <>
          {review && (openReview.length > 0 || unreadOpen.length > 0) && (
            <p className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900" data-testid="review-later">
              Belgeden okunan bilgiler forma yerleştirildi.
              {unreadOpen.length > 0 && <> {unreadOpen.length} bilgi okunamadı (aşağıda boş).</>}
              {openReview.length > 0 && <> Çelişki ve onay gibi kontroller <Link href={`/crm/vehicles/${id}/tamamla?adim=4#belge-kontrolu`} className="font-semibold underline">son kontrol ekranında</Link> topluca yapılır.</>}
            </p>
          )}
          <WizardStepForm vehicleId={id} version={v.updatedAt.toISOString()} tradeName={v.tradeName} initial={formInitial(v)} sections={["basic", "identity", "equipment"]} next={next(2)} submitLabel="Devam et → Kaporta" ruhsatFields={ruhsatFields} />
        </>
      )}

      {step === 2 && (
        <>
          <BodyPartsEditor
            vehicleId={id}
            staff={staffParts}
            report={toPartMap(v.parts, "reportState")}
            readOnly={false}
            autosave
            lastUpdate={lastPart ? `${lastPart.updatedBy?.name ?? "—"} · ${formatDateTime(lastPart.updatedAt)}` : null}
          />
          <p className="text-xs text-zinc-500">Şemada önce durumu seçin, sonra parçalara dokunun; her dokunuş otomatik kaydedilir. Hepsi orijinalse &quot;Tamamı orijinal&quot; düğmesine basın; bilmediğiniz parçayı &quot;Bilinmiyor&quot; bırakın.</p>
          <WizardStepForm vehicleId={id} version={v.updatedAt.toISOString()} initial={formInitial(v)} sections={["damage", "legal"]} next={next(3)} submitLabel="Devam et → Fotoğraf" />
        </>
      )}

      {step === 3 && (
        <>
          <PendingSync vehicleId={id} version={v.updatedAt.toISOString()} />
          <div id="fotograflar" className="rounded-xl">
            <MediaManager
              direct={storageDriver() === "blob"}
              vehicleId={id}
              photos={v.photos.map((p) => ({ id: p.id, url: mediaUrl(p.path)!, isCover: p.isCover }))}
              videoUrl={mediaUrl(v.videoPath)}
              videoPublic={v.videoPublic}
              videoFromAi={Boolean(v.aiDraftMode)}
              pdfUrl={v.expertisePdfPath ? `/api/crm/files/${v.expertisePdfPath}` : null}
              locked={mediaChangeBlock(v, actor) !== null}
            />
          </div>
          <div className="flex justify-end">
            <Link href={`/crm/vehicles/${id}/tamamla?adim=4`} className="btn-primary px-6 py-3" data-testid="wizard-next">Devam et → Kontrol ve yayın</Link>
          </div>
        </>
      )}

      {step === 4 && (
        <div className="space-y-6" data-testid="final-check">
          <PendingSync vehicleId={id} version={v.updatedAt.toISOString()} />
          {/* Araç özeti */}
          <section className="card flex flex-wrap gap-4 p-4" data-testid="final-summary">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(cover.path)!} alt="" className="h-24 w-32 rounded-lg object-cover" />
            ) : (
              <Link href={`/crm/vehicles/${id}/tamamla?adim=3#fotograflar`} className="flex h-24 w-32 items-center justify-center rounded-lg border border-dashed border-red-300 text-center text-xs text-red-700">Fotoğraf yok</Link>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-lg font-semibold">{title}{v.year ? ` · ${v.year}` : ""}</p>
                <StatusBadge status={v.status} />
              </div>
              {/* Marka / seri / model burada doğrudan düzeltilebilir (1. adıma dönmeden) */}
              <QuickIdentityEdit vehicleId={id} version={v.updatedAt.toISOString()} initial={{ brand: v.brand ?? "", model: v.model ?? "", packageName: v.packageName ?? "" }} />
              <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                <div><dt className="text-xs text-zinc-500">Fiyat</dt><dd className="font-semibold">{v.price ? formatPrice(v.price) : <span className="text-red-700">girilmedi</span>}</dd></div>
                <div><dt className="text-xs text-zinc-500">Kilometre</dt><dd className="font-semibold">{v.km != null ? formatKm(v.km) : <span className="text-red-700">girilmedi</span>}</dd></div>
                <div><dt className="text-xs text-zinc-500">Plaka</dt><dd className="font-semibold">{v.legalPlate ?? <span className="text-red-700">girilmedi</span>}</dd></div>
                <div><dt className="text-xs text-zinc-500">Fotoğraf</dt><dd className="font-semibold">{v.photos.length ? `${v.photos.length} adet` : <span className="text-red-700">yok</span>}</dd></div>
              </dl>
            </div>
            <p className={`w-full rounded-lg px-3 py-2 text-sm font-semibold ${missing.length ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`} data-testid="final-ready" data-ready={missing.length ? "0" : "1"}>
              {missing.length ? `Yayına hazır değil: ${missing.length} madde eksik. Taslak olarak kaydedildi; eksikleri istediğiniz zaman tamamlayabilirsiniz.` : "✓ Yayına hazır: tüm zorunlu bilgiler tamam."}
            </p>
          </section>

          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              {/* Düzeltilmesi gerekenler: en üstte, her biri ilgili alana götürür */}
              {missing.length > 0 && (
                <section className="card p-5" data-testid="final-issues">
                  <h2 className="font-semibold">Düzeltilmesi gerekenler ({missing.length})</h2>
                  <ul className="mt-3 divide-y divide-zinc-100">
                    {missing.map((i) => {
                      const t = checkTarget(i.key);
                      const settings = Boolean(t.href);
                      return (
                        <li key={i.key} className="flex flex-wrap items-center justify-between gap-3 py-2.5" data-issue={i.key}>
                          <span className="min-w-0 text-sm">
                            <span className="font-medium text-red-700">{i.label}</span>
                            <span className="block text-xs text-zinc-600">{i.reason}</span>
                          </span>
                          {settings && user.role !== "ADMIN" ? (
                            <span className="text-xs text-zinc-500">Yönetici Ayarlar&apos;dan girer</span>
                          ) : (
                            <Link href={fixHref(id, t)} className="btn-outline px-4 py-2 text-sm" data-testid={`fix-${i.key}`}>Düzelt</Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {review && <DocReviewPanel vehicleId={id} review={review} status={v.status} readOnly={false} fixLinks filled={review.missing.filter((m) => aiFieldFilled(m.field, v as unknown as Record<string, unknown>, staffParts)).map((m) => m.field)} />}

              {/* Tüm araç bilgileri: personel isterse hepsini tek yerde kontrol eder (eksik değer "Bilgi girilmedi" görünür, "Yok" sayılmaz) */}
              <details className="card p-5" data-testid="final-all-info">
                <summary className="cursor-pointer font-semibold">Tüm araç bilgileri</summary>
                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {allInfo.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 border-b border-zinc-100 pb-1.5">
                      <dt className="text-zinc-500">{label}</dt>
                      <dd className={`text-right font-medium ${value ? "" : "text-zinc-400"}`}>{value || "Bilgi girilmedi"}</dd>
                    </div>
                  ))}
                </dl>
              </details>

              <details className="card p-5" data-testid="final-all-checks">
                <summary className="cursor-pointer font-semibold">Tüm kontrol maddeleri ({items.length - missing.length}/{items.length} tamam)</summary>
                <div className="mt-3">
                  <PublishChecklist items={items} vehicleId={id} />
                </div>
              </details>
            </div>

            <div className="space-y-4">
              <StatusActions
                vehicleId={id}
                status={v.status}
                photoCount={v.photos.length}
                user={actor}
                optionedBy={v.optionedBy ? { id: v.optionedBy.id, name: v.optionedBy.name } : null}
                price={v.price}
                canArchive={user.role === "ADMIN" || v.createdById === user.id}
              />
              <Link href="/crm/vehicles?status=DRAFT" className="btn-outline w-full">Taslakta bırak</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
