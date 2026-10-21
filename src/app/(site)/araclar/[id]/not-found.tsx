import Link from "next/link";

export default function ListingNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6" data-testid="listing-unavailable">
      <h1 className="font-display text-3xl font-bold">Bu ilan artık yayında değil</h1>
      <p className="mt-4 text-zinc-600">Aradığınız araç satılmış veya yayından kaldırılmış olabilir.</p>
      <Link href="/araclar" className="btn-primary mt-8">Güncel araçlara göz atın</Link>
    </div>
  );
}
