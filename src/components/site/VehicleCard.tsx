import Link from "next/link";
import { formatKm, formatPrice, mediaUrl } from "@/lib/format";

type Props = {
  vehicle: {
    id: string; brand: string; model: string; packageName: string | null; year: number; km: number; price: number;
    fuel: string; transmission: string; status: string; photos: { path: string }[];
  };
};

export function VehicleCard({ vehicle: v }: Props) {
  const cover = mediaUrl(v.photos[0]?.path);
  const optioned = v.status === "OPTIONED";
  return (
    <Link
      href={`/araclar/${v.id}`}
      className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-zinc-200">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={`${v.brand} ${v.model}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        )}
        {optioned && (
          <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink shadow">
            Opsiyonlu
          </span>
        )}
      </div>
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">{v.brand}</p>
        <h3 className="mt-1 font-display text-lg font-semibold text-ink">
          {v.model} <span className="font-normal text-zinc-500">{v.packageName}</span>
        </h3>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
          <span>{v.year}</span>
          <span>{formatKm(v.km)}</span>
          <span>{v.fuel}</span>
          <span>{v.transmission}</span>
        </div>
        <p className="mt-4 font-display text-xl font-bold text-ink">{formatPrice(v.price)}</p>
      </div>
    </Link>
  );
}
