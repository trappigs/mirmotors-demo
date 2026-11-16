"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Story } from "@/lib/home-stories";

const SLIDE_MS = 5000;

/** Instagram story benzeri tam ekran görüntüleyici. */
export function StoryViewer({ stories, startIndex, onClose, onSeen }: {
  stories: Story[];
  startIndex: number;
  onClose: () => void;
  onSeen: (id: string) => void;
}) {
  const [storyIdx, setStoryIdx] = useState(startIndex);
  const [slideIdx, setSlideIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const story = stories[storyIdx];
  const slide = story.slides[slideIdx];

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  useEffect(() => onSeen(story.id), [story.id, onSeen]);

  const next = useCallback(() => {
    if (slideIdx < story.slides.length - 1) setSlideIdx((i) => i + 1);
    else if (storyIdx < stories.length - 1) { setStoryIdx((i) => i + 1); setSlideIdx(0); }
    else onClose();
  }, [slideIdx, story.slides.length, storyIdx, stories.length, onClose]);

  const prev = useCallback(() => {
    if (slideIdx > 0) setSlideIdx((i) => i - 1);
    else if (storyIdx > 0) { setStoryIdx((i) => i - 1); setSlideIdx(0); }
  }, [slideIdx, storyIdx]);

  // Klavye, kaydırma kilidi, odak
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prevFocus?.focus();
    };
  }, [next, prev, onClose]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    setPaused(false);
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (dy > 80 && Math.abs(dy) > Math.abs(dx)) return onClose(); // aşağı kaydır: kapat
    if (Math.abs(dx) > 50) return dx < 0 ? next() : prev(); // yatay kaydırma
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${story.label} story`} data-testid="story-viewer">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Kapat" tabIndex={-1} onClick={onClose} />

      <div
        className="relative h-full w-full overflow-hidden bg-ink sm:h-[min(88vh,820px)] sm:w-[min(48vh,460px)] sm:rounded-2xl"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={slide.image + slideIdx} src={slide.image} alt={slide.title} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 to-transparent" />

        {/* İlerleme çubukları */}
        <div className="absolute inset-x-3 top-3 flex gap-1">
          {/* Otomatik ilerleme, çubuk animasyonunun bitişiyle tetiklenir: duraklatma çubuğu da durdurur.
              Azaltılmış hareket tercihinde animasyon ve otomatik ilerleme yoktur. */}
          {story.slides.map((_, i) => (
            <span key={`${storyIdx}-${i}`} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
              <span
                key={`${storyIdx}-${slideIdx}-${i}`}
                className="block h-full bg-white"
                onAnimationEnd={i === slideIdx ? next : undefined}
                style={{
                  width: i < slideIdx || (i === slideIdx && reduced) ? "100%" : i > slideIdx ? "0%" : undefined,
                  animation: i === slideIdx && !reduced ? `story-progress ${SLIDE_MS}ms linear forwards` : undefined,
                  animationPlayState: paused ? "paused" : "running",
                }}
              />
            </span>
          ))}
        </div>

        <div className="absolute inset-x-4 top-7 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={story.cover} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-brand" />
            <span className="text-sm font-semibold">{story.label}</span>
            <span className="text-xs text-white/60">{slideIdx + 1}/{story.slides.length}</span>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Story'yi kapat" className="grid h-9 w-9 place-items-center rounded-full bg-black/30 text-lg hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            ✕
          </button>
        </div>

        {/* Dokunma/tıklama bölgeleri */}
        <button type="button" aria-label="Önceki" onClick={prev} className="absolute bottom-40 left-0 top-20 w-1/3 focus:outline-none" />
        <button type="button" aria-label="Sonraki" onClick={next} className="absolute bottom-40 right-0 top-20 w-2/3 focus:outline-none" />

        <div className="absolute inset-x-5 bottom-6 text-white">
          {slide.subtitle && <span className="mb-2 inline-block rounded-md bg-brand px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">{slide.subtitle}</span>}
          <p className="font-display text-xl font-bold leading-tight" data-testid="story-title">{slide.title}</p>
          {slide.href && (
            <Link href={slide.href} onClick={onClose} className="btn-primary mt-4 w-full rounded-xl py-3 font-bold" data-testid="story-link">
              {slide.hrefLabel ?? "Aracı İncele"} →
            </Link>
          )}
          <p className="mt-3 text-center text-[10px] uppercase tracking-[0.14em] text-white/50">Demo · temsili görseller</p>
        </div>
      </div>

      {/* Masaüstü ok düğmeleri */}
      <button type="button" onClick={prev} aria-label="Önceki story" className="absolute left-[calc(50%-min(24vh,230px)-64px)] top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/30 sm:grid">‹</button>
      <button type="button" onClick={next} aria-label="Sonraki story" className="absolute right-[calc(50%-min(24vh,230px)-64px)] top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/30 sm:grid">›</button>
    </div>
  );
}
