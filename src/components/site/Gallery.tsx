"use client";
import { useState } from "react";

export function Gallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [i, setI] = useState(0);
  if (photos.length === 0) return <div className="aspect-[3/2] rounded-xl bg-zinc-200" />;
  const go = (d: number) => setI((x) => (x + d + photos.length) % photos.length);
  return (
    <div>
      <div className="relative aspect-[3/2] overflow-hidden rounded-xl bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[i]} alt={`${alt} — fotoğraf ${i + 1}`} className="h-full w-full object-contain" />
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Önceki fotoğraf" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-white hover:bg-black/70">‹</button>
            <button type="button" onClick={() => go(1)} aria-label="Sonraki fotoğraf" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-white hover:bg-black/70">›</button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">{i + 1} / {photos.length}</span>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, idx) => (
            <button key={p} type="button" onClick={() => setI(idx)} className={`h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 ${idx === i ? "border-accent" : "border-transparent opacity-70"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
