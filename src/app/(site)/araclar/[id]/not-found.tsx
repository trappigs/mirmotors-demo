import Link from "next/link";

export default function ListingNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-28 text-center sm:px-6" data-testid="listing-unavailable">
      <p className="eyebrow">İlan durumu</p>
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight md:text-4xl">Bu ilan artık yayında değil</h1>
      <p className="mx-auto mt-4 max-w-md text-zinc-600">Aradığınız araç satılmış veya yayından kaldırılmış olabilir. Benzer araçlar için güncel stoğa göz atın.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/araclar" className="btn-primary px-6 py-3">Güncel araçlara göz atın</Link>
        <Link href="/iletisim" className="btn-outline px-6 py-3">Danışmana ulaşın</Link>
      </div>
    </div>
  );
}
