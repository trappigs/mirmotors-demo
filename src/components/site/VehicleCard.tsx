import Link from "next/link";
import { formatKm, formatPrice, mediaUrl } from "@/lib/format";
import { IconArrowRight, IconCalendar, IconFuel, IconGauge, IconGear } from "./Icons";

type Props = {
  vehicle: {
    id: string; brand: string; model: string; packageName: string | null; year: number; km: number; price: number;
    fuel: string; transmission: string; status: string; photos: { path: string }[];
  };
};

export function OptionedBadge() {
  return (
    <span className="badge-optioned">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      Opsiyonlu
    </span>
  );
}

export function VehicleCard({ vehicle: v }: Props) {
  const cover = mediaUrl(v.photos[0]?.path);
  const optioned = v.status === "OPTIONED";
  const specs = [
    { icon: IconCalendar, value: String(v.year) },
    { icon: IconGauge, value: formatKm(v.km) },
    { icon: IconFuel, value: v.fuel },
    { icon: IconGear, value: v.transmission },
  ];
  return (
    <Link
      href={`/araclar/${v.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition duration-300 hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_24px_48px_-20px_rgba(14,16,21,0.35)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ink-2">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={`${v.brand} ${v.model}`} className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
        {optioned && <div className="absolute left-3 top-3"><OptionedBadge /></div>}
        <span className="absolute bottom-3 right-3 rounded-md bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur">
          {v.year}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-dark">{v.brand}</p>
        <h3 className="mt-1.5 truncate font-display text-lg font-semibold leading-snug text-ink">
          {v.model} <span className="font-normal text-zinc-500">{v.packageName}</span>
        </h3>
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] text-zinc-600">
          {specs.map(({ icon: Icon, value }, i) => (
            <li key={i} className="flex items-center gap-2 truncate">
              <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
              {value}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-end justify-between border-t border-zinc-100 pt-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">Fiyat</p>
            <p className="font-display text-xl font-bold tracking-tight text-ink">{formatPrice(v.price)}</p>
          </div>
          <span className="flex items-center gap-1 text-sm font-semibold text-zinc-400 transition group-hover:text-accent-dark">
            İncele <IconArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
