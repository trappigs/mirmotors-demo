import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/site/Gallery";
import { findPublicVehicle } from "@/lib/public-vehicles";
import { formatKm, formatPrice, mediaUrl, parseEquipment } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await findPublicVehicle((await params).id);
  return { title: v ? `${v.brand} ${v.model} ${v.year}` : "İlan yayında değil" };
}

export default async function VehicleDetailPage({ params }: Props) {
  const { id } = await params;
  const v = await findPublicVehicle(id);

  // Satılan / satış bekleyen / taslak araçların bağlantısı aktif ilan göstermez (404 + bilgilendirme).
  if (!v) notFound();

  const photos = v.photos.map((p) => mediaUrl(p.path)!);
  const equipment = parseEquipment(v.equipment);
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  const waText = encodeURIComponent(`Merhaba, ${v.year} ${v.brand} ${v.model} ${v.packageName ?? ""} ilanı hakkında bilgi almak istiyorum. (İlan: ${v.id.slice(-6).toUpperCase()})`);

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="text-sm text-zinc-500">
        <Link href="/araclar" className="hover:text-ink">Araçlarımız</Link> / {v.brand} / {v.model}
      </nav>
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <Gallery photos={photos} alt={`${v.brand} ${v.model}`} />

          {v.videoPath && (
            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold">Video</h2>
              <video src={mediaUrl(v.videoPath)!} controls preload="metadata" playsInline className="mt-4 w-full rounded-xl bg-black" data-testid="vehicle-video" />
            </section>
          )}

          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">Teknik özellikler</h2>
            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-3">
              {specs.filter(([, val]) => val !== null && val !== "").map(([k, val]) => (
                <div key={k} className="bg-white p-4">
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">{k}</dt>
                  <dd className="mt-1 font-semibold">{val}</dd>
                </div>
              ))}
            </dl>
          </section>

          {equipment.length > 0 && (
            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold">Donanım</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {equipment.map((e) => (
                  <li key={e} className="flex items-center gap-2 text-zinc-700"><span className="text-accent-dark">✓</span>{e}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">Boya, değişen ve hasar</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Info title="Boyalı parçalar" text={v.paintedParts} />
              <Info title="Değişen parçalar" text={v.changedParts} />
              <Info title="Hasar açıklaması" text={v.damageNote} />
            </div>
            {v.tramerAmount !== null && (
              <p className="mt-3 text-sm text-zinc-600">Tramer kaydı: {v.tramerAmount === 0 ? "Yok" : formatPrice(v.tramerAmount)}</p>
            )}
          </section>

          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">Ekspertiz özeti</h2>
            <p className="card mt-4 p-5 text-zinc-700">{v.expertiseSummary || "Ekspertiz özeti için danışmanınızla iletişime geçin."}</p>
            <p className="mt-2 text-xs text-zinc-500">Ekspertiz raporunun tamamı galeride incelenebilir.</p>
          </section>

          {v.description && (
            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold">Açıklama</h2>
              <p className="mt-4 whitespace-pre-line text-zinc-700">{v.description}</p>
            </section>
          )}
        </div>

        <aside className="order-first lg:order-none lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            {v.status === "OPTIONED" ? (
              <span className="inline-block rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink" data-testid="status-badge">Opsiyonlu</span>
            ) : (
              <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800" data-testid="status-badge">Satışta</span>
            )}
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">{v.brand}</p>
            <h1 className="mt-1 font-display text-2xl font-bold">{v.model} <span className="font-normal text-zinc-500">{v.packageName}</span></h1>
            <p className="mt-2 text-sm text-zinc-600">{v.year} · {formatKm(v.km)} · {v.fuel} · {v.transmission}</p>
            <p className="mt-6 font-display text-3xl font-bold">{formatPrice(v.price)}</p>
            {v.status === "OPTIONED" && (
              <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Bu araç şu anda başka bir müşteri için opsiyonludur. Benzer araçlar için bize ulaşın.</p>
            )}
            {wa && (
              <a href={`https://wa.me/${wa}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="btn mt-6 w-full bg-[#25D366] py-3 text-white hover:bg-[#1da851]">
                WhatsApp ile bilgi al
              </a>
            )}
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">
              Demo ilan. Site üzerinden ödeme, kapora veya sözleşme işlemi yapılmaz. İlan no: {v.id.slice(-6).toUpperCase()}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Info({ title, text }: { title: string; text: string | null }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{title}</p>
      <p className="mt-1 text-sm font-medium">{text || "Belirtilmedi"}</p>
    </div>
  );
}
