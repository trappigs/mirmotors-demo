import Link from "next/link";
import { VehicleCard } from "@/components/site/VehicleCard";
import { IconArrowRight, IconCamera, IconChat, IconDoc, IconShield } from "@/components/site/Icons";
import { mediaUrl } from "@/lib/format";
import { PRICE_PRESETS, findPublicVehicles, parseFilters, publicBrandModels } from "@/lib/public-vehicles";

export const dynamic = "force-dynamic";

const STEPS = [
  { no: "01", title: "Aracı seçin", text: "Stoğu marka, fiyat ve kasa tipine göre filtreleyin; ilan detaylarını inceleyin." },
  { no: "02", title: "Danışmanla konuşun", text: "Ekspertiz özetini ve aracın geçmişini danışmanınızla değerlendirin." },
  { no: "03", title: "Showroom'da tamamlayın", text: "Aracı yerinde görün; satış ve noter devri galeride tamamlanır." },
];

const REASONS = [
  { icon: IconDoc, title: "Şeffaf ekspertiz", text: "Boya, değişen, hasar ve tramer bilgisi her ilanda." },
  { icon: IconCamera, title: "Gerçek fotoğraflar", text: "İlan fotoğrafları galeri ekibince araç üzerinde çekilir." },
  { icon: IconShield, title: "Güncel stok", text: "Satılan araç anında yayından kalkar; listede gördüğünüz araç satıştadır." },
  { icon: IconChat, title: "Kişisel danışman", text: "Sorularınız için doğrudan danışmanınıza ulaşın." },
];

export default async function HomePage() {
  const [vehicles, brandModels] = await Promise.all([findPublicVehicles(parseFilters({})), publicBrandModels()]);
  const featured = vehicles.slice(0, 8);
  // Hero: stoktaki en yeni aracın kapak fotoğrafı; yoksa temsili showroom fotoğrafı.
  const stockHero = mediaUrl(vehicles[0]?.photos[0]?.path);
  const heroImage = stockHero ?? "/demo-cars/hero-showroom.jpg";

  return (
    <>
      {/* Kompakt, açık zeminli hero */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div className="grid overflow-hidden rounded-2xl bg-white shadow-[0_6px_24px_-12px_rgba(16,24,40,0.2)] ring-1 ring-black/[0.04] md:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col justify-center px-6 py-8 md:px-10 md:py-10">
            <p className="inline-flex w-fit items-center gap-2 rounded-md bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" /> {vehicles.length} araç stokta · satışa hazır
            </p>
            <h1 className="mt-4 font-display text-3xl font-extrabold leading-[1.1] tracking-tight text-ink md:text-[42px]">
              Aradığınız ikinci el aracı <span className="text-brand">güvenle bulun.</span>
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
              Ekspertiz özetli, gerçek fotoğraflı araçlar. Beğendiğiniz aracı danışmanınızla birlikte inceleyin.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/araclar" className="btn-primary rounded-xl px-6 py-3 text-[15px] font-bold">Araçları Gör <IconArrowRight className="h-4 w-4" /></Link>
              <Link href="/iletisim" className="btn-outline rounded-xl px-6 py-3 text-[15px]">Bizimle İletişime Geç</Link>
            </div>
          </div>
          <div className="relative hidden min-h-[300px] bg-ink md:block">
            {heroImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            {stockHero && (
              <span className="absolute bottom-4 left-4 rounded-md bg-brand px-2.5 py-1 text-xs font-bold text-white">Stoktan · {vehicles[0]?.brand} {vehicles[0]?.model}</span>
            )}
          </div>
        </div>

        {/* Stok arama */}
        <form action="/araclar" className="mt-4 grid gap-3 rounded-2xl bg-white p-4 shadow-[0_6px_24px_-12px_rgba(16,24,40,0.2)] ring-1 ring-black/[0.04] sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_auto] md:p-5">
          <div>
            <label className="label" htmlFor="hero-q">Arama</label>
            <input id="hero-q" name="q" placeholder="Marka, model veya paket" className="input h-11 rounded-xl" />
          </div>
          <div>
            <label className="label" htmlFor="hero-marka">Marka</label>
            <select id="hero-marka" name="marka" defaultValue="" className="input h-11 rounded-xl">
              <option value="">Tüm markalar</option>
              {Object.keys(brandModels).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="hero-fiyat">Maksimum fiyat</label>
            <input id="hero-fiyat" name="maxFiyat" inputMode="numeric" placeholder="TL" className="input h-11 rounded-xl" />
          </div>
          <button className="btn-primary h-11 self-end rounded-xl px-8 font-bold">Araç Ara</button>
        </form>
      </section>

      {/* Stoktaki araçlar — sayfanın merkezi */}
      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Stoktaki araçlar</p>
            <h2 className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-ink md:text-[34px]">{vehicles.length} araç stokta, satışa hazır.</h2>
          </div>
          <Link href="/araclar" className="inline-flex items-center gap-1.5 text-sm font-bold text-ink hover:text-brand">
            Tüm araçlar <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/araclar" className="rounded-full border border-brand bg-brand px-3.5 py-1.5 text-[12.5px] font-bold text-white">Tümü</Link>
          {PRICE_PRESETS.map((p) => {
            const qs = new URLSearchParams();
            if (p.min) qs.set("minFiyat", String(p.min));
            if (p.max) qs.set("maxFiyat", String(p.max));
            return (
              <Link key={p.label} href={`/araclar?${qs}`} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[12.5px] font-bold text-ink transition hover:border-brand hover:text-brand">
                {p.label}
              </Link>
            );
          })}
        </div>
        <div className="mt-6 grid gap-3.5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {featured.map((v) => (
            <VehicleCard key={v.id} vehicle={v} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/araclar" className="btn-primary rounded-xl px-7 py-3 font-bold">Tüm stoğu görüntüle ({vehicles.length}) <IconArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      {/* Süreç şeridi */}
      <section className="mx-auto mt-14 max-w-7xl px-4 sm:px-6">
        <ol className="grid divide-y divide-line rounded-2xl bg-white ring-1 ring-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {STEPS.map((s) => (
            <li key={s.no} className="flex gap-4 p-6">
              <span className="font-display text-3xl font-extrabold italic text-brand">{s.no}</span>
              <div>
                <h2 className="font-display font-bold text-ink">{s.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Güven bölümü */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div className="grid gap-8 rounded-2xl bg-white p-8 ring-1 ring-line md:p-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="eyebrow">Neden Mir Motors?</p>
            <h2 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Güven, açık bilgiyle başlar.</h2>
            <p className="mt-3 text-muted">Online ödeme veya kapora yok; satış showroomda, noter devriyle tamamlanır.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {REASONS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3.5 rounded-xl bg-paper p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand text-white"><Icon className="h-5 w-5" /></span>
                <div>
                  <h3 className="font-bold text-ink">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
