"use client";
import { useEffect, useRef, useState } from "react";
import type { DocPage } from "@/lib/client-docs";
import { DOC_KIND_LABELS, type DocKind } from "@/lib/doc-review";
import { maskApplyBlock, maskConfirmation } from "@/lib/mask-rules";

type Rect = { x: number; y: number; w: number; h: number };
/** Perde: sayfanın bir tarafını kenara kadar kapatır; kenar parmakla sürüklenir (ruhsatın sağ sayfası için). */
type Side = "right" | "left" | "top" | "bottom";
type Curtain = { side: Side; pos: number };
const SIDES: [Side, string][] = [["right", "Sağ tarafı"], ["bottom", "Alt tarafı"], ["left", "Sol tarafı"], ["top", "Üst tarafı"]];
/** Perdeyi dikdörtgene çevirir (pos: perdenin başladığı kenar, 0–1). */
const curtainRect = (c: Curtain): Rect =>
  c.side === "right" ? { x: c.pos, y: 0, w: 1 - c.pos, h: 1 }
  : c.side === "left" ? { x: 0, y: 0, w: c.pos, h: 1 }
  : c.side === "bottom" ? { x: 0, y: c.pos, w: 1, h: 1 - c.pos }
  : { x: 0, y: 0, w: 1, h: c.pos };

/**
 * Kişisel veri maskeleme: personel belge görselinde T.C. kimlik no, ad-soyad, adres, telefon gibi alanları sürükleyerek
 * siyahla kapatır. Maskelenmiş görsel üretilir; maskelenmemiş hâl sunucuya ve AI'a gönderilmez.
 */
type Kind = Exclude<DocKind, "EKSPERTIZ">; // dış ekspertiz raporu artık yüklenmez

export function MaskEditor({ page, hint, onDone, onCancel, kind, onKind, progress, suggestion }: {
  page: DocPage; hint: string; onDone: (rects: Rect[]) => void; onCancel: () => void;
  /** Sayfanın belge türü: personel tek dokunuşla seçer (maskelenmemiş görsel AI'a gönderilemeyeceği için tür tarayıcıda belirlenir). */
  kind: Kind | null; onKind: (k: Kind) => void; progress?: string;
  /** Sabit şablonlu belgede (kontrol formu) hassas bölge önerisi: kendiliğinden uygulanmaz, personel ekler ve görür. */
  suggestion?: { label: string; rects: Rect[] };
}) {
  const [rects, setRects] = useState<Rect[]>([]);
  const [draft, setDraft] = useState<Rect | null>(null);
  const [curtain, setCurtain] = useState<Curtain | null>(null);
  const dragging = useRef(false);
  const all = [...rects, ...(curtain ? [curtainRect(curtain)] : [])];
  const box = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  // Hiçbir şey kapatılmadıysa ya da ruhsatta sağ sayfa perdeyle kapatılmadıysa açık onay istenir.
  const [confirmed, setConfirmed] = useState(false);
  const maskState = { kind, rectCount: rects.length, hasCurtain: !!curtain, confirmed };
  const confirmText = maskConfirmation(maskState);
  const block = maskApplyBlock(maskState);
  // Onay, verildiği belge türüne aittir; tür değişince yeniden istenir.
  useEffect(() => setConfirmed(false), [kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const rel = (e: React.PointerEvent) => {
    const b = box.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) };
  };
  const norm = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85 p-3 sm:p-6" role="dialog" aria-label="Kişisel veri maskeleme">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 text-white">
        <div className="min-w-0">
          <p className="font-semibold">{progress && <span className="text-white/60">{progress} · </span>}Kişisel verileri kapatın</p>
          <p className="text-xs text-white/70">{kind ? hint : "Önce bu sayfanın hangi belge olduğunu seçin."} Kapatmak için parmağınızla kutu çizin ya da aşağıdan bir tarafı tek dokunuşla kapatın.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-white/70">Bu sayfa:</span>
          {(["RUHSAT", "FORM"] as const).map((k) => (
            <button key={k} type="button" onClick={() => onKind(k)} aria-pressed={kind === k} data-testid={`mask-kind-${k}`}
              className={`rounded-md border px-3 py-2 text-xs font-semibold ${kind === k ? "border-accent bg-accent text-white" : "border-white/40 text-white hover:border-white"}`}>
              {DOC_KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-2 flex w-full max-w-5xl flex-wrap justify-end gap-2">
        {suggestion && (
          <button type="button" onClick={() => setRects((r) => [...r, ...suggestion.rects])} className="btn-outline py-2 text-xs" data-testid="mask-suggest">{suggestion.label}</button>
        )}
        <span className="flex flex-wrap items-center gap-1.5" data-testid="mask-curtains">
          <span className="text-xs text-white/70">Hızlı kapat:</span>
          {SIDES.map(([side, label]) => (
            <button key={side} type="button" onClick={() => setCurtain(curtain?.side === side ? null : { side, pos: side === "right" || side === "bottom" ? 0.55 : 0.45 })}
              aria-pressed={curtain?.side === side} data-testid={`mask-curtain-${side}`}
              className={`rounded-md border px-3 py-2 text-xs font-semibold ${curtain?.side === side ? "border-accent bg-accent text-white" : "border-white/40 text-white hover:border-white"}`}>
              {label}
            </button>
          ))}
        </span>
        <button type="button" onClick={() => (rects.length ? setRects((r) => r.slice(0, -1)) : setCurtain(null))} disabled={!all.length} className="btn-outline py-2 text-xs">Geri al</button>
        <button type="button" onClick={onCancel} className="btn-outline py-2 text-xs">Sonra</button>
        <button type="button" disabled={!!block} title={block ?? undefined} onClick={() => onDone(all)} className="btn-accent py-2" data-testid="mask-apply">
          {all.length > 0 ? `Maskeyi uygula (${all.length}) →` : "Bu sayfada kişisel veri yok →"}
        </button>
      </div>
      {confirmText && (
        <label className="mx-auto mt-2 flex w-full max-w-5xl cursor-pointer items-start gap-2 rounded-md border border-amber-400 bg-amber-100/95 p-2.5 text-sm text-amber-950" data-testid="mask-confirm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} data-testid="mask-confirm-input" />
          <span>{confirmText}</span>
        </label>
      )}
      <div className="mx-auto mt-3 flex min-h-0 w-full max-w-5xl flex-1 items-center justify-center">
        <div
          ref={box}
          className="relative max-h-full touch-none select-none"
          style={{ aspectRatio: `${page.width} / ${page.height}`, width: `min(100%, calc((100dvh - 230px) * ${page.width / page.height}))` }}
          onPointerDown={(e) => {
            if (dragging.current) return;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            start.current = rel(e);
            setDraft({ ...start.current, w: 0, h: 0 });
          }}
          onPointerMove={(e) => start.current && setDraft(norm(start.current, rel(e)))}
          onPointerUp={(e) => {
            if (start.current) {
              const r = norm(start.current, rel(e));
              if (r.w > 0.01 && r.h > 0.01) setRects((x) => [...x, r]);
            }
            start.current = null;
            setDraft(null);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={page.url} alt="" className="h-full w-full rounded object-contain" draggable={false} />
          {[...rects, ...(draft ? [draft] : [])].map((r, i) => (
            <span key={i} className="absolute bg-black/90 ring-1 ring-red-500" style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }} />
          ))}
          {curtain && (() => {
            const r = curtainRect(curtain);
            const vertical = curtain.side === "right" || curtain.side === "left";
            const edge = curtain.pos * 100;
            return (
              <>
                <span className="pointer-events-none absolute bg-black" style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }} data-testid="mask-curtain" />
                {/* Perdenin kenarı: parmakla sürüklenir (çizim başlatmaz) */}
                <span
                  role="slider" aria-label="Kapatılan alanın kenarı" aria-valuenow={Math.round(edge)} aria-valuemin={0} aria-valuemax={100} tabIndex={0}
                  className={`absolute z-10 flex items-center justify-center ${vertical ? "top-0 h-full w-10 -translate-x-1/2 cursor-ew-resize" : "left-0 h-10 w-full -translate-y-1/2 cursor-ns-resize"}`}
                  style={vertical ? { left: `${edge}%` } : { top: `${edge}%` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    dragging.current = true;
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!dragging.current) return;
                    e.stopPropagation();
                    const p = rel(e);
                    setCurtain((c) => (c ? { ...c, pos: Math.min(0.95, Math.max(0.05, vertical ? p.x : p.y)) } : c));
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    dragging.current = false;
                  }}
                  onKeyDown={(e) => {
                    const d = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -0.02 : e.key === "ArrowRight" || e.key === "ArrowDown" ? 0.02 : 0;
                    if (d) { e.preventDefault(); setCurtain((c) => (c ? { ...c, pos: Math.min(0.95, Math.max(0.05, c.pos + d)) } : c)); }
                  }}
                >
                  <span className={`rounded-full bg-accent shadow ring-2 ring-white ${vertical ? "h-16 w-2" : "h-2 w-16"}`} />
                </span>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
