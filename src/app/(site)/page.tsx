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
  const heroImage = mediaUrl(vehicles[0]?.photos[0]?.path);

  return (
    <>
      {/* Kompakt hero + arama */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-ink text-white">
          {heroImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImage} alt="" className="absolute inset-y-0 right-0 hidden h-full w-[58%] object-cover md:block" />
          )}
          <div className="absolute inset-0 hidden bg-gradient-to-r from-ink via-ink/95 to-ink/10 md:block" />
          <div className="relative px-6 pb-28 pt-10 md:max-w-[55%] md:px-12 md:pb-32 md:pt-14">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {vehicles.length} araç stokta
            </p>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-5xl">
              Seçkin ikinci el, <span className="text-accent">şeffaf geçmiş.</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-zinc-300">
              Ekspertiz özetli, gerçek fotoğraflı premium araçlar. Beğendiğiniz aracı danışmanınızla birlikte inceleyin.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/araclar" className="btn-accent rounded-xl px-5 py-3">Araçları Gör <IconArrowRight className="h-4 w-4" /></Link>
              <Link href="/iletisim" className="btn-ghost-light rounded-xl px-5 py-3">Bizimle İletişime Geç</Link>
            </div>
          </div>
        </div>

        <form action="/araclar" className="relative z-10 mx-auto -mt-16 grid max-w-5xl gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_20px_50px_-20px_rgba(16,24,40,0.35)] sm:grid-cols-2 md:-mt-14 md:grid-cols-[1.3fr_1fr_1fr_auto] md:p-5">
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
          <button className="btn-primary h-11 self-end rounded-xl px-7">Araç Ara</button>
        </form>
      </section>

      {/* Süreç şeridi */}
      <section className="mx-auto mt-10 max-w-7xl px-4 sm:px-6">
        <ol className="grid divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white md:grid-cols-3 md:divide-x md:divide-y-0">
          {STEPS.map((s) => (
            <li key={s.no} className="flex gap-4 p-6">
              <span className="font-display text-3xl font-bold italic text-accent">{s.no}</span>
              <div>
                <h2 className="font-display font-semibold text-ink">{s.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Stoktaki araçlar — sayfanın merkezi */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Stoktaki araçlar</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">{vehicles.length} araç stokta, satışa hazır.</h2>
            <p className="mt-1 text-zinc-500">Fiyat aralığını seçin, size uygun aracı hemen görün.</p>
          </div>
          <Link href="/araclar" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-accent-dark">
            Tüm araçlar <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/araclar" className="rounded-full border border-ink bg-ink px-4 py-2 text-[13px] font-semibold text-white">Tümü</Link>
          {PRICE_PRESETS.map((p) => {
            const qs = new URLSearchParams();
            if (p.min) qs.set("minFiyat", String(p.min));
            if (p.max) qs.set("maxFiyat", String(p.max));
            return (
              <Link key={p.label} href={`/araclar?${qs}`} className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-ink transition hover:border-zinc-400">
                {p.label}
              </Link>
            );
          })}
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {featured.map((v) => (
            <VehicleCard key={v.id} vehicle={v} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/araclar" className="btn-outline rounded-xl px-6 py-3">Tüm stoğu görüntüle ({vehicles.length}) <IconArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      {/* Güven bölümü */}
      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <div className="grid gap-10 rounded-3xl bg-white p-8 ring-1 ring-zinc-200 md:p-12 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="eyebrow">Neden Mir Motors?</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">Güven, açık bilgiyle başlar.</h2>
            <p className="mt-3 text-zinc-500">Araç alımını tahmine değil, doğrulanmış bilgiye dayandırıyoruz. Online ödeme veya kapora yok; satış showroomda tamamlanır.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {REASONS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3.5 rounded-2xl bg-paper p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-accent-dark ring-1 ring-zinc-200"><Icon className="h-5 w-5" /></span>
                <div>
                  <h3 className="font-semibold text-ink">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-500">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
