import Link from "next/link";
import { formatKm, formatPrice, mediaUrl } from "@/lib/format";
import { IconArrowRight } from "./Icons";

type Vehicle = {
  id: string; brand: string; model: string; packageName: string | null; year: number; km: number; price: number;
  fuel: string; transmission: string; status: string; photos: { path: string }[];
};

/** "Opsiyonlu" durumu: metin + kilit ikonu (yalnızca renge bağlı değil). */
export function OptionedBadge() {
  return (
    <span className="badge-optioned">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
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
        <img src={cover} alt={`${v.year} ${v.brand} ${v.model}`} decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
      ) : (
        <div className="grid h-full place-items-center text-xs text-muted">Fotoğraf yok</div>
      )}
      {v.status === "OPTIONED" && <div className="absolute left-2.5 top-2.5"><OptionedBadge /></div>}
      <span className="absolute right-2.5 top-2.5 rounded-md bg-ink/80 px-2 py-0.5 text-[11px] font-semibold text-white">{formatKm(v.km)}</span>
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
    <dl className={`grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12.5px] leading-5 ${className}`}>
      {rows.map(([k, val]) => (
        <div key={k} className="flex min-w-0 gap-1">
          <dt className="shrink-0 text-muted">{k}:</dt>
          <dd className="truncate font-medium text-ink">{val}</dd>
        </div>
      ))}
      {v.packageName && (
        <div className="col-span-2 flex min-w-0 gap-1">
          <dt className="shrink-0 text-muted">Paket:</dt>
          <dd className="truncate font-medium text-ink">{v.packageName}</dd>
        </div>
      )}
    </dl>
  );
}

const title = (v: Vehicle) => `${v.year} ${v.brand} ${v.model} ${v.packageName ?? ""}`.trim();

/** Katalog kartı (ızgara): fotoğraf → başlık → temel özellikler → tam genişlikte kırmızı fiyat bandı. */
export function VehicleCard({ vehicle: v }: { vehicle: Vehicle }) {
  return (
    <Link
      href={`/araclar/${v.id}`}
      className="group flex flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_4px_rgba(16,24,40,0.08)] ring-1 ring-black/[0.04] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-14px_rgba(16,24,40,0.35)]"
    >
      <Photo v={v} className="aspect-[4/3]" />
      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
        <h3 className="line-clamp-2 min-h-[2.5em] text-center text-[13px] font-extrabold uppercase leading-[1.25] tracking-[0.01em] text-ink group-hover:text-brand">
          {title(v)}
        </h3>
        <Specs v={v} className="mt-2.5" />
        <span className="mt-3 flex h-10 w-full items-center justify-center rounded-lg bg-brand font-display text-[17px] font-bold tracking-tight text-white transition group-hover:bg-brand-dark">
          {formatPrice(v.price)}
        </span>
      </div>
    </Link>
  );
}

/** Liste görünümü: yatay kart. */
export function VehicleRow({ vehicle: v }: { vehicle: Vehicle }) {
  return (
    <Link
      href={`/araclar/${v.id}`}
      className="group grid overflow-hidden rounded-xl bg-white shadow-[0_1px_4px_rgba(16,24,40,0.08)] ring-1 ring-black/[0.04] transition hover:shadow-[0_14px_30px_-14px_rgba(16,24,40,0.35)] sm:grid-cols-[260px_1fr_220px]"
    >
      <Photo v={v} className="aspect-[4/3] sm:aspect-auto sm:h-full sm:min-h-[170px]" />
      <div className="flex min-w-0 flex-col justify-center p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand">{v.brand}</p>
        <h3 className="mt-1 text-[15px] font-extrabold uppercase tracking-wide text-ink group-hover:text-brand">{title(v)}</h3>
        <Specs v={v} className="mt-3 max-w-md" />
      </div>
      <div className="flex flex-col justify-center gap-2 border-t border-line p-5 sm:border-l sm:border-t-0">
        <span className="flex items-center justify-center rounded-lg bg-brand py-3 font-display text-lg font-bold text-white transition group-hover:bg-brand-dark">
          {formatPrice(v.price)}
        </span>
        <span className="flex items-center justify-center gap-1 text-sm font-semibold text-muted group-hover:text-brand">
          İncele <IconArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
