"use client";
import { useState } from "react";

export function Gallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [i, setI] = useState(0);
  if (photos.length === 0) return <div className="aspect-[16/10] rounded-2xl bg-zinc-200" />;
  const go = (d: number) => setI((x) => (x + d + photos.length) % photos.length);
  const arrow = "absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-xl text-white backdrop-blur transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
  return (
    <div>
      <div
        className="group relative aspect-[16/10] overflow-hidden rounded-2xl bg-ink-2 shadow-[0_30px_60px_-30px_rgba(14,16,21,0.5)]"
        tabIndex={photos.length > 1 ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
        aria-label="Fotoğraf galerisi"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[i]} alt={`${alt} — fotoğraf ${i + 1}`} className="h-full w-full object-cover" />
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Önceki fotoğraf" className={`${arrow} left-4`}>‹</button>
            <button type="button" onClick={() => go(1)} aria-label="Sonraki fotoğraf" className={`${arrow} right-4`}>›</button>
            <span className="absolute bottom-4 right-4 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              {i + 1} / {photos.length}
            </span>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
          {photos.map((p, idx) => (
            <button
              key={p}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Fotoğraf ${idx + 1}`}
              className={`aspect-[16/10] overflow-hidden rounded-lg transition ${idx === i ? "ring-2 ring-accent ring-offset-2 ring-offset-paper" : "opacity-60 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
