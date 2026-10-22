"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type HeroSlide = {
  eyebrow: string;
  title: string;
  text: string;
  cta: string;
  href: string;
  desktopImage: string; // geniş kadraj
  mobileImage: string; // 4:3 kadraj
  alt: string;
};

const INTERVAL_MS = 5000;

/**
 * Ana sayfa hero carousel'i. ~5 sn'de otomatik geçer; fare üzerindeyken veya klavye odağı içerideyken durur.
 * Azaltılmış hareket tercihinde otomatik geçiş ve geçiş animasyonu kullanılmaz.
 */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const count = slides.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const go = useCallback((d: number) => setIndex((i) => (i + d + count) % count), [count]);

  useEffect(() => {
    if (hovered || focused || reduced || count < 2) return;
    const t = setTimeout(() => go(1), INTERVAL_MS);
    return () => clearTimeout(t);
  }, [index, hovered, focused, reduced, count, go]);

  return (
    <section
      ref={rootRef}
      className="relative overflow-hidden bg-ink text-white"
      aria-roledescription="carousel"
      aria-label="Öne çıkan içerikler"
      data-testid="hero-slider"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!rootRef.current?.contains(e.relatedTarget as Node)) setFocused(false); }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
    >
      <div className="relative md:h-[460px]">
        {slides.map((s, i) => {
          const active = i === index;
          return (
            <div
              key={s.title}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
              aria-hidden={!active}
              inert={!active}
              data-active={active}
              className={`motion-fade flex flex-col transition-opacity duration-700 ease-out md:block md:absolute md:inset-0 ${active ? "relative opacity-100" : "absolute inset-0 opacity-0"}`}
            >
              {/* Görsel: masaüstünde sağ tarafta geniş kadraj, mobilde metnin altında 4:3 */}
              <picture className="order-2 block px-4 sm:px-6 md:absolute md:inset-y-0 md:right-0 md:w-[74%] md:px-0">
                <source media="(min-width: 768px)" srcSet={s.desktopImage} />
                <img
                  src={s.mobileImage}
                  alt={s.alt}
                  fetchPriority={i === 0 ? "high" : "low"}
                  decoding="async"
                  className="aspect-[4/3] w-full rounded-xl object-cover md:aspect-auto md:h-full md:rounded-none"
                />
              </picture>
              <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-ink via-ink/90 via-[34%] to-transparent to-[62%] md:block" />

              <div className="relative order-1 mx-auto w-full max-w-7xl px-4 pb-6 pt-7 sm:px-6 md:flex md:h-full md:flex-col md:justify-center md:pb-16 md:pt-6">
                <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" /> {s.eyebrow}
                </p>
                {(() => {
                  // Sayfada tek h1: ilk slayt başlığı; diğerleri h2
                  const Heading = i === 0 ? "h1" : "h2";
                  return <Heading className="mt-4 max-w-xl font-display text-[32px] font-extrabold leading-[1.05] tracking-tight md:text-[56px]">{s.title}</Heading>;
                })()}
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/80 md:text-lg">{s.text}</p>
                <Link href={s.href} className="btn-primary mt-6 w-fit rounded-xl px-7 py-3.5 text-[15px] font-bold" data-testid={`hero-cta-${i}`}>
                  {s.cta} →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Kontroller: masaüstünde sol altta, mobilde görselin altında ortada */}
      <div className="relative mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 pb-5 pt-4 sm:px-6 md:absolute md:inset-x-0 md:bottom-16 md:justify-start md:pb-0 md:pt-0">
        <button type="button" onClick={() => go(-1)} aria-label="Önceki slayt" className="grid h-10 w-10 place-items-center rounded-full border border-white/40 text-xl text-white transition hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" data-testid="hero-prev">‹</button>
        <div className="flex items-center gap-2" role="tablist" aria-label="Slayt seç">
          {slides.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`${i + 1}. slayt: ${s.eyebrow}`}
              onClick={() => setIndex(i)}
              className="group py-2 focus-visible:outline-none"
              data-testid={`hero-dot-${i}`}
            >
              <span className={`block h-[3px] rounded-full transition-all duration-300 ${i === index ? "w-11 bg-brand" : "w-7 bg-white/35 group-hover:bg-white/70"} group-focus-visible:ring-2 group-focus-visible:ring-white`} />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => go(1)} aria-label="Sonraki slayt" className="grid h-10 w-10 place-items-center rounded-full border border-white/40 text-xl text-white transition hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" data-testid="hero-next">›</button>
      </div>
      <p className="sr-only" aria-live={hovered || focused || reduced ? "polite" : "off"}>{slides[index].title}</p>
    </section>
  );
}
