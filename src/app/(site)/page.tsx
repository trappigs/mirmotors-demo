import Link from "next/link";
import { VehicleCard } from "@/components/site/VehicleCard";
import { findPublicVehicles, parseFilters, publicBrandModels } from "@/lib/public-vehicles";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [vehicles, brandModels] = await Promise.all([findPublicVehicles(parseFilters({})), publicBrandModels()]);
  const featured = vehicles.slice(0, 6);
  const hero = vehicles[0]?.photos[0]?.path;

  return (
    <>
      <section className="relative overflow-hidden bg-ink text-white">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/media/${hero}`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 md:py-36">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Premium ikinci el</p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold leading-tight md:text-6xl">
            Seçkin araçlar, şeffaf geçmiş.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-zinc-300">
            Her aracı ekspertiz özeti, boya-değişen bilgisi ve gerçek fotoğraflarıyla inceleyin. Karar vermeden önce
            danışmanınızla konuşun.
          </p>
          <form action="/araclar" className="mt-10 grid max-w-2xl gap-3 rounded-xl bg-white/10 p-3 backdrop-blur sm:grid-cols-[1fr_1fr_auto]">
            <select name="marka" className="rounded-md bg-white px-3 py-3 text-sm text-ink" defaultValue="">
              <option value="">Tüm markalar</option>
              {Object.keys(brandModels).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <input name="maxFiyat" inputMode="numeric" placeholder="Maks. fiyat (TL)" className="rounded-md bg-white px-3 py-3 text-sm text-ink" />
            <button className="btn-accent py-3">Araçları Gör</button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-dark">Stoktan</p>
            <h2 className="mt-2 font-display text-3xl font-bold">Öne çıkan araçlar</h2>
          </div>
          <Link href="/araclar" className="text-sm font-semibold underline-offset-4 hover:underline">
            Tümünü gör ({vehicles.length}) →
          </Link>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((v) => (
            <VehicleCard key={v.id} vehicle={v} />
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-3">
          {[
            ["Ekspertiz özeti", "Her ilanda boya, değişen ve hasar bilgisi açıkça yer alır."],
            ["Gerçek fotoğraflar", "İlan fotoğrafları galeri ekibimiz tarafından araçtan çekilir."],
            ["Kişisel danışman", "WhatsApp üzerinden doğrudan danışmanınıza ulaşın."],
          ].map(([t, d]) => (
            <div key={t}>
              <div className="h-1 w-10 bg-accent" />
              <h3 className="mt-5 font-display text-xl font-semibold">{t}</h3>
              <p className="mt-2 text-zinc-600">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
