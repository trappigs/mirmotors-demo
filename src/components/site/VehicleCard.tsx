import Link from "next/link";
import { formatKm, formatPrice, mediaUrl } from "@/lib/format";
import { IconArrowRight } from "./Icons";

type Vehicle = {
  id: string; brand: string; model: string; packageName: string | null; year: number; km: number; price: number;
  fuel: string; transmission: string; status: string; photos: { path: string }[];
};

export function OptionedBadge() {
  return (
    <span className="badge-optioned">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      Opsiyonlu
    </span>
  );
}

/** Kart fotoğrafı: CRM'den yüklenen kapak fotoğrafı otomatik kullanılır; yoksa nötr yer tutucu. */
function Photo({ v, className }: { v: Vehicle; className: string }) {
  const cover = mediaUrl(v.photos[0]?.path);
  return (
    <div className={`relative overflow-hidden bg-zinc-200 ${className}`}>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt={`${v.year} ${v.brand} ${v.model}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
      ) : (
        <div className="grid h-full place-items-center text-xs text-zinc-400">Fotoğraf yok</div>
      )}
      {v.status === "OPTIONED" && <div className="absolute left-3 top-3"><OptionedBadge /></div>}
      <span className="absolute right-3 top-3 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-sm">{formatKm(v.km)}</span>
    </div>
  );
}

function Specs({ v, className = "" }: { v: Vehicle; className?: string }) {
  const rows: [string, string][] = [
    ["Vites", v.transmission],
    ["KM", new Intl.NumberFormat("tr-TR").format(v.km)],
    ["Yakıt", v.fuel],
    ["Yıl", String(v.year)],
  ];
  return (
    <dl className={`grid grid-cols-2 gap-x-3 gap-y-1 text-[13px] ${className}`}>
      {rows.map(([k, val]) => (
        <div key={k} className="flex min-w-0 gap-1">
          <dt className="shrink-0 text-zinc-500">{k}:</dt>
          <dd className="truncate font-medium text-ink">{val}</dd>
        </div>
      ))}
      {v.packageName && (
        <div className="col-span-2 flex min-w-0 gap-1">
          <dt className="shrink-0 text-zinc-500">Paket:</dt>
          <dd className="truncate font-medium text-ink">{v.packageName}</dd>
        </div>
      )}
    </dl>
  );
}

const title = (v: Vehicle) => `${v.year} ${v.brand} ${v.model} ${v.packageName ?? ""}`.trim();

/** Katalog kartı (ızgara): büyük fotoğraf → başlık → temel özellikler → dolu fiyat alanı. */
export function VehicleCard({ vehicle: v }: { vehicle: Vehicle }) {
  return (
    <Link
      href={`/araclar/${v.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-16px_rgba(16,24,40,0.35)]"
    >
      <Photo v={v} className="aspect-[4/3]" />
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 min-h-[2.6em] text-center text-[13px] font-bold uppercase leading-[1.3] tracking-wide text-ink">{title(v)}</h3>
        <Specs v={v} className="mt-3 border-t border-zinc-100 pt-3" />
        <div className="mt-auto pt-4">
          <span className="flex w-full items-center justify-center rounded-xl bg-ink py-3 font-display text-lg font-bold tracking-tight text-white transition group-hover:bg-accent group-hover:text-ink">
            {formatPrice(v.price)}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Liste görünümü: yatay kart. */
export function VehicleRow({ vehicle: v }: { vehicle: Vehicle }) {
  return (
    <Link
      href={`/araclar/${v.id}`}
      className="group grid overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)] transition hover:shadow-[0_16px_32px_-16px_rgba(16,24,40,0.35)] sm:grid-cols-[280px_1fr_220px]"
    >
      <Photo v={v} className="aspect-[4/3] sm:aspect-auto sm:h-full sm:min-h-[180px]" />
      <div className="flex min-w-0 flex-col justify-center p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-dark">{v.brand}</p>
        <h3 className="mt-1 text-base font-bold uppercase tracking-wide text-ink">{title(v)}</h3>
        <Specs v={v} className="mt-3 max-w-md" />
      </div>
      <div className="flex flex-col justify-center gap-2 border-t border-zinc-100 p-5 sm:border-l sm:border-t-0">
        <span className="flex items-center justify-center rounded-xl bg-ink py-3 font-display text-lg font-bold text-white transition group-hover:bg-accent group-hover:text-ink">
          {formatPrice(v.price)}
        </span>
        <span className="flex items-center justify-center gap-1 text-sm font-semibold text-zinc-500 group-hover:text-ink">
          İncele <IconArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
