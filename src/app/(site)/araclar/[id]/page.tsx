import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/site/Gallery";
import { OptionedBadge } from "@/components/site/VehicleCard";
import {
  IconBolt, IconCalendar, IconCar, IconCheck, IconDoc, IconFuel, IconGauge, IconGear, IconPalette, IconShield, IconWhatsApp,
} from "@/components/site/Icons";
import { findPublicVehicle } from "@/lib/public-vehicles";
import { formatKm, formatPrice, mediaUrl, parseEquipment } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await findPublicVehicle((await params).id);
  return { title: v ? `${v.brand} ${v.model} ${v.year}` : "İlan yayında değil" };
}

/** "Yok" gibi temiz kayıtları görsel olarak olumlu, diğerlerini dikkat çeken bloklarda gösterir. */
const isClean = (t: string | null) => !!t && /^(yok|hayır|orijinal|hasar kaydı yok)/i.test(t.trim());

export default async function VehicleDetailPage({ params }: Props) {
  const { id } = await params;
  const v = await findPublicVehicle(id);

  // Satılan / satış bekleyen / taslak araçların bağlantısı aktif ilan göstermez (404 + bilgilendirme).
  if (!v) notFound();

  const photos = v.photos.map((p) => mediaUrl(p.path)!);
  const equipment = parseEquipment(v.equipment);
  const listingNo = v.id.slice(-6).toUpperCase();
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  const waText = encodeURIComponent(`Merhaba, ${v.year} ${v.brand} ${v.model} ${v.packageName ?? ""} ilanı hakkında bilgi almak istiyorum. (İlan: ${listingNo})`);
  const optioned = v.status === "OPTIONED";

  const highlights = [
    { icon: IconCalendar, label: "Model yılı", value: String(v.year) },
    { icon: IconGauge, label: "Kilometre", value: formatKm(v.km) },
    { icon: IconFuel, label: "Yakıt", value: v.fuel },
    { icon: IconGear, label: "Vites", value: v.transmission },
    { icon: IconCar, label: "Kasa tipi", value: v.bodyType },
    { icon: IconBolt, label: "Motor gücü", value: v.enginePower ? `${v.enginePower} hp` : null },
  ].filter((h) => h.value);

  const specs: [string, string | number | null][] = [
    ["Marka", v.brand],
    ["Model", v.model],
    ["Paket", v.packageName],
    ["Model yılı", v.year],
    ["Kilometre", formatKm(v.km)],
    ["Yakıt", v.fuel],
    ["Vites", v.transmission],
    ["Kasa tipi", v.bodyType],
    ["Renk", v.color],
    ["Motor gücü", v.enginePower ? `${v.enginePower} hp` : null],
    ["Motor hacmi", v.engineCc ? `${v.engineCc} cc` : null],
    ["Çekiş", v.drivetrain],
  ];

  const condition = [
    { title: "Boyalı parçalar", text: v.paintedParts },
    { title: "Değişen parçalar", text: v.changedParts },
    { title: "Hasar açıklaması", text: v.damageNote },
  ];

  const statusBadge = optioned ? (
    <span data-testid="status-badge"><OptionedBadge /></span>
  ) : (
    <span className="badge-available" data-testid="status-badge"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Satışta</span>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link href="/araclar" className="transition hover:text-brand">Araçlarımız</Link>
        <span className="text-zinc-300">/</span>
        <Link href={`/araclar?marka=${encodeURIComponent(v.brand)}`} className="transition hover:text-brand">{v.brand}</Link>
        <span className="text-zinc-300">/</span>
        <span className="font-semibold text-ink">{v.model}</span>
      </nav>

      {/* Başlık */}
      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            {statusBadge}
            <span className="text-xs text-muted">İlan no: {listingNo}</span>
          </div>
          <p className="eyebrow mt-4">{v.brand}</p>
          <h1 className="mt-1.5 font-display text-3xl font-extrabold tracking-tight md:text-[42px]">
            {v.model} <span className="font-semibold text-muted">{v.packageName}</span>
          </h1>
        </div>
        <p className="rounded-lg bg-brand px-4 py-2 font-display text-2xl font-extrabold tracking-tight text-white lg:hidden">{formatPrice(v.price)}</p>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <Gallery photos={photos} alt={`${v.brand} ${v.model}`} />

          {/* Öne çıkan bilgiler */}
          <section className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {highlights.map(({ icon: Icon, label, value }) => (
              <div key={label} className="card flex items-center gap-3.5 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
                  <p className="truncate font-bold">{value}</p>
                </div>
              </div>
            ))}
          </section>

          {v.videoPath && (
            <section className="mt-12">
              <h2 className="section-mark font-display text-2xl font-extrabold tracking-tight">Tanıtım videosu</h2>
              <video src={mediaUrl(v.videoPath)!} controls preload="metadata" playsInline className="mt-5 aspect-video w-full rounded-2xl bg-black shadow-xl" data-testid="vehicle-video" />
            </section>
          )}

          <section className="mt-12">
            <h2 className="section-mark font-display text-2xl font-extrabold tracking-tight">Teknik özellikler</h2>
            <dl className="card mt-5 grid overflow-hidden sm:grid-cols-2">
              {specs.filter(([, val]) => val !== null && val !== "").map(([k, val]) => (
                <div key={k} className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 text-sm sm:odd:border-r">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-semibold">{val}</dd>
                </div>
              ))}
            </dl>
          </section>

          {equipment.length > 0 && (
            <section className="mt-12">
              <h2 className="section-mark font-display text-2xl font-extrabold tracking-tight">Donanım</h2>
              <ul className="mt-5 flex flex-wrap gap-2">
                {equipment.map((e) => (
                  <li key={e} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink">
                    <IconCheck className="h-4 w-4 text-brand" />{e}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="section-mark font-display text-2xl font-extrabold tracking-tight">Boya, değişen ve hasar</h2>
              {v.tramerAmount !== null && (
                <span className="rounded-md bg-ink px-3 py-1.5 text-xs font-bold text-white">
                  Tramer: {v.tramerAmount === 0 ? "Kayıt yok" : formatPrice(v.tramerAmount)}
                </span>
              )}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {condition.map((c) => {
                const clean = isClean(c.text);
                return (
                  <div key={c.title} className={`card border-l-4 p-5 ${clean ? "border-l-emerald-500" : c.text ? "border-l-brand" : "border-l-zinc-300"}`}>
                    <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                      <IconPalette className="h-4 w-4" />{c.title}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-ink">{c.text || "Belirtilmedi"}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-12">
            <h2 className="section-mark font-display text-2xl font-extrabold tracking-tight">Ekspertiz özeti</h2>
            <div className="card mt-5 flex gap-4 p-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700">
                <IconShield className="h-5 w-5" />
              </span>
              <div>
                <p className="leading-relaxed text-ink">{v.expertiseSummary || "Ekspertiz özeti için danışmanınızla iletişime geçin."}</p>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                  <IconDoc className="h-4 w-4" /> Ekspertiz raporunun tamamı showroomda incelenebilir.
                </p>
              </div>
            </div>
          </section>

          {v.description && (
            <section className="mt-12">
              <h2 className="section-mark font-display text-2xl font-extrabold tracking-tight">Açıklama</h2>
              <p className="mt-5 whitespace-pre-line leading-relaxed text-ink">{v.description}</p>
            </section>
          )}
        </div>

        {/* Fiyat ve iletişim kartı */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-line">
            <div className="bg-brand px-6 py-5 text-white">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/85">Satış fiyatı</p>
                {optioned ? <OptionedBadge /> : <span className="badge bg-white text-emerald-700">Satışta</span>}
              </div>
              <p className="mt-1.5 font-display text-[34px] font-extrabold tracking-tight">{formatPrice(v.price)}</p>
            </div>
            <div className="p-6">
              <p className="text-sm font-bold uppercase tracking-wide text-ink">{v.year} {v.brand} {v.model} {v.packageName}</p>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {[["Yıl", v.year], ["Km", formatKm(v.km)], ["Yakıt", v.fuel], ["Vites", v.transmission]].map(([k, val]) => (
                  <div key={String(k)} className="rounded-lg bg-paper px-3.5 py-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{k}</dt>
                    <dd className="mt-0.5 font-bold text-ink">{val}</dd>
                  </div>
                ))}
              </dl>

              {optioned && (
                <p className="mt-4 flex gap-2 rounded-lg border border-ink/10 bg-ink px-3.5 py-3 text-sm font-medium text-white">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg> Bu araç şu anda başka bir müşteri için opsiyonludur. Benzer araçlar için bize ulaşın.
                </p>
              )}

              {wa && (
                <a href={`https://wa.me/${wa}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="btn-primary mt-5 w-full rounded-xl py-3.5 text-[15px] font-bold">
                  <IconWhatsApp /> WhatsApp ile bilgi al
                </a>
              )}
              <Link href="/iletisim" className="btn-outline mt-2.5 w-full rounded-xl py-3">Showroom ziyareti planla</Link>

              <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-muted">
                Demo ilan. Site üzerinden ödeme, kapora veya sözleşme işlemi yapılmaz. Satış ve noter devri showroomda tamamlanır.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
