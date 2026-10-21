import Link from "next/link";
import { VehicleCard } from "@/components/site/VehicleCard";
import { IconArrowRight, IconCamera, IconChat, IconDoc, IconShield } from "@/components/site/Icons";
import { findPublicVehicles, parseFilters, publicBrandModels } from "@/lib/public-vehicles";

export const dynamic = "force-dynamic";

const REASONS = [
  { icon: IconDoc, title: "Şeffaf ekspertiz", text: "Her ilanda boya, değişen, hasar ve tramer bilgisi açıkça yer alır. Sürpriz yok." },
  { icon: IconCamera, title: "Gerçek fotoğraflar", text: "İlan görselleri galeri ekibimiz tarafından araç üzerinde çekilir ve yüklenir." },
  { icon: IconShield, title: "Kontrollü stok", text: "Opsiyon ve satış süreçleri tek sistemden yönetilir; yayındaki her araç güncel durumdadır." },
  { icon: IconChat, title: "Kişisel danışman", text: "Sorularınız için doğrudan danışmanınıza WhatsApp üzerinden ulaşırsınız." },
];

const STEPS = [
  { no: "01", title: "Keşfedin", text: "Stoğu marka, fiyat, yıl ve kilometreye göre filtreleyin; ilan detaylarını inceleyin." },
  { no: "02", title: "Danışın", text: "Ekspertiz özetini ve aracın geçmişini danışmanınızla birlikte değerlendirin." },
  { no: "03", title: "Showroom'da tamamlayın", text: "Aracı yerinde görün; satış ve noter devri galeride güvenle tamamlanır." },
];

export default async function HomePage() {
  const [vehicles, brandModels] = await Promise.all([findPublicVehicles(parseFilters({})), publicBrandModels()]);
  const featured = vehicles.slice(0, 6);
  const brands = Object.keys(brandModels);

  const stats = [
    { value: String(vehicles.length), label: "Stoktaki araç" },
    { value: String(brands.length), label: "Premium marka" },
    { value: "Her ilanda", label: "Şeffaf ekspertiz özeti" },
    { value: "Birebir", label: "Premium müşteri deneyimi" },
  ];

  return (
    <>
      {/* HERO — soyut, ışık hüzmeli koyu showroom zemini */}
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_75%_10%,rgba(201,165,107,0.22),transparent_60%),radial-gradient(ellipse_70%_70%_at_10%_100%,rgba(30,52,96,0.55),transparent_65%),linear-gradient(180deg,#0e1015_0%,#111a2b_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <div className="absolute -right-40 top-1/2 -z-10 h-px w-[900px] -rotate-[18deg] bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
        <div className="absolute -right-24 top-[62%] -z-10 h-px w-[700px] -rotate-[18deg] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="absolute bottom-0 left-1/2 -z-10 h-40 w-[120%] -translate-x-1/2 rounded-[100%] bg-accent/10 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 pb-36 pt-20 sm:px-6 md:pb-44 md:pt-28">
          <div className="max-w-3xl">
            <p className="eyebrow-light flex items-center gap-3">
              <span className="h-px w-8 bg-accent" /> Premium ikinci el showroom
            </p>
            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-7xl">
              Seçkin otomobiller.
              <span className="block bg-gradient-to-r from-accent-light via-accent to-accent-dark bg-clip-text text-transparent">Şeffaf geçmiş.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-zinc-300 md:text-lg">
              Her aracı ekspertiz özeti, boya-değişen bilgisi ve gerçek fotoğraflarıyla inceleyin. Karar vermeden önce
              danışmanınızla birebir konuşun.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/araclar" className="btn-accent px-6 py-3.5 text-[15px]">
                Araçları Gör <IconArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/iletisim" className="btn-ghost-light px-6 py-3.5 text-[15px]">Bizimle İletişime Geç</Link>
            </div>
          </div>

          <form action="/araclar" className="mt-14 grid max-w-3xl gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-2 backdrop-blur-md sm:grid-cols-[1fr_1fr_auto]">
            <label className="sr-only" htmlFor="hero-marka">Marka</label>
            <select id="hero-marka" name="marka" className="rounded-xl border-0 bg-white px-4 py-3.5 text-sm text-ink outline-none focus:ring-4 focus:ring-accent/30" defaultValue="">
              <option value="">Tüm markalar</option>
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="hero-fiyat">Maksimum fiyat</label>
            <input id="hero-fiyat" name="maxFiyat" inputMode="numeric" placeholder="Maks. fiyat (TL)" className="rounded-xl border-0 bg-white px-4 py-3.5 text-sm text-ink outline-none placeholder:text-zinc-400 focus:ring-4 focus:ring-accent/30" />
            <button className="btn-primary rounded-xl bg-ink-3 px-6 py-3.5 hover:bg-black">Hızlı Ara</button>
          </form>
        </div>
      </section>

      {/* İSTATİSTİK ŞERİDİ */}
      <section className="relative z-10 mx-auto -mt-20 max-w-6xl px-4 sm:px-6">
        <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_30px_60px_-30px_rgba(14,16,21,0.35)] md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={`flex flex-col p-6 md:p-8 ${i % 2 ? "border-l" : ""} ${i > 1 ? "border-t md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""} border-zinc-100`}>
              <dt className="order-2 mt-1 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{s.label}</dt>
              <dd className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ÖNE ÇIKAN ARAÇLAR */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Stoktan seçmeler</p>
            <h2 className="section-title mt-3">Öne çıkan araçlar</h2>
          </div>
          <Link href="/araclar" className="btn-outline">
            Tüm stok ({vehicles.length}) <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((v) => (
            <VehicleCard key={v.id} vehicle={v} />
          ))}
        </div>
      </section>

      {/* NEDEN MIR MOTORS */}
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_100%_0%,rgba(201,165,107,0.15),transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="max-w-2xl">
            <p className="eyebrow-light">Neden Mir Motors?</p>
            <h2 className="section-title mt-3">Güven, bilgiyle başlar.</h2>
            <p className="mt-4 text-zinc-400">Araç alımını tahmine değil, açık bilgiye dayandırıyoruz. Stok sistemimiz her ilanın güncel ve doğru kalmasını sağlar.</p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {REASONS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-accent/40 hover:bg-white/[0.06]">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-accent/40 bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SÜREÇ */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="eyebrow">Satın alma süreci</p>
            <h2 className="section-title mt-3">Üç adımda yeni aracınız</h2>
            <p className="mt-4 text-zinc-600">Online ödeme veya kapora yok. Tüm satış işlemleri showroomda, noter devriyle tamamlanır.</p>
          </div>
          <ol className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.no} className="card p-6">
                <span className="font-display text-3xl font-bold text-accent">{s.no}</span>
                <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-8 py-14 text-white md:px-14">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_120%_at_100%_50%,rgba(201,165,107,0.25),transparent_60%)]" />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <h2 className="font-display text-2xl font-bold md:text-3xl">Aradığınız aracı birlikte bulalım.</h2>
              <p className="mt-2 text-zinc-400">Stokta olmayan bir model için de danışmanlarımıza yazabilirsiniz.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/iletisim" className="btn-accent px-6 py-3">Bizimle İletişime Geç</Link>
              <Link href="/araclar" className="btn-ghost-light px-6 py-3">Araçları Gör</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
