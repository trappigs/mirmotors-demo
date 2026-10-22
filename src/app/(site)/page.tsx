import Link from "next/link";
import { VehicleCard } from "@/components/site/VehicleCard";
import { IconArrowRight, IconCamera, IconChat, IconDoc, IconShield } from "@/components/site/Icons";
import { HeroSearch } from "@/components/site/HeroSearch";
import { HeroSlider, type HeroSlide } from "@/components/site/HeroSlider";
import { StoryBar } from "@/components/site/StoryBar";
import { buildStories } from "@/lib/home-stories";
import { PRICE_PRESETS, findPublicVehicles, parseFilters, publicBrandModels } from "@/lib/public-vehicles";

export const dynamic = "force-dynamic";

const STEPS = [
  { no: "01", title: "Aracı seçin", text: "Stoğu marka, fiyat ve kasa tipine göre filtreleyin; ilan detaylarını inceleyin." },
  { no: "02", title: "Danışmanla konuşun", text: "Ekspertiz özetini ve aracın geçmişini danışmanınızla değerlendirin." },
  { no: "03", title: "Showroom'da tamamlayın", text: "Aracı yerinde görün; satış ve noter devri galeride tamamlanır." },
];

const HERO_SLIDES: HeroSlide[] = [
  {
    eyebrow: "Araç koleksiyonumuz",
    title: "Aradığınız otomobil burada.",
    text: "Mir Motors araç koleksiyonunu keşfedin.",
    cta: "Tüm Araçları Gör",
    href: "/araclar",
    desktopImage: "/demo-cars/hero-slide-1.jpg",
    mobileImage: "/demo-cars/volvo-xc60-1.jpg",
    alt: "Mavi Volvo XC60 (temsili görsel)",
  },
  {
    eyebrow: "Yeni gelen araçlar",
    title: "Yeni gelenleri keşfedin.",
    text: "Güncel stoktaki otomobilleri inceleyin.",
    cta: "Araçları İncele",
    href: "/araclar?sirala=new",
    desktopImage: "/demo-cars/hero-slide-2.jpg",
    mobileImage: "/demo-cars/vw-golf-1.jpg",
    alt: "Kırmızı Volkswagen Golf GTI (temsili görsel)",
  },
  {
    eyebrow: "Mir Motors deneyimi",
    title: "Aracınızı güvenle seçin.",
    text: "Araç özelliklerini inceleyin, danışmanımızla görüşün.",
    cta: "Bizimle İletişime Geç",
    href: "/iletisim",
    desktopImage: "/demo-cars/hero-slide-3.jpg",
    mobileImage: "/demo-cars/hero-showroom.jpg",
    alt: "Otomobil showroomu (temsili görsel)",
  },
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
  const stories = buildStories(vehicles);
  const years = [...new Set(vehicles.map((v) => v.year))].sort((a, b) => b - a);

  return (
    <>
      <StoryBar stories={stories} instagramUrl={process.env.NEXT_PUBLIC_INSTAGRAM_URL || undefined} />

      <HeroSlider slides={HERO_SLIDES} />

      {/* Arama kartı: masaüstünde slider'ın alt kenarına taşar, mobilde altında durur */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative z-10 mt-4 md:-mt-14 md:ml-auto md:max-w-[900px]">
          <HeroSearch brandModels={brandModels} years={years} />
        </div>
      </section>

      {/* Stoktaki araçlar — sayfanın merkezi */}
      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
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
