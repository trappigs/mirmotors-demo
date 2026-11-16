"use client";
// Araç fotoğrafları ızgarası: ‹ › oklarıyla veya ⠿ tutamacından sürükleyerek sıralama.
// Sürükleme Pointer Events ile yapılır (iPhone Safari'de HTML5 sürükle-bırak çalışmaz); tutamakta touch-action:none
// olduğu için sayfa kaymaz. Sıra sürükleme sırasında yerelde değişir, bırakınca tek istekle kaydedilir.
import { useEffect, useRef, useState } from "react";
import { moveItem } from "@/lib/photo-prepare";

export type GridPhoto = { id: string; url: string; isCover: boolean };

type Props = {
  photos: GridPhoto[];
  locked: boolean;
  /** Başka bir işlem sürerken (silme, kapak vb.) tüm düğmeler kapalı. */
  disabled: boolean;
  /** Fotoğraf yüklenirken yalnızca sıralama kapalı (sunucudaki liste değişmekte). */
  sortPaused?: boolean;
  /** Yeni sırayı kaydeder; hata durumunda reddeder (ızgara eski sıraya döner). */
  onReorder: (order: string[]) => Promise<void>;
  onCover: (id: string) => void;
  onDelete: (id: string) => void;
};

export function PhotoGrid({ photos, locked, disabled, sortPaused = false, onReorder, onCover, onDelete }: Props) {
  const serverKey = photos.map((p) => p.id).join(",");
  // Yerel sıra yalnızca sunucudaki sıra değişmediği sürece geçerlidir; yenilemeden sonra kendiliğinden düşer.
  const [override, setOverride] = useState<{ key: string; ids: string[] } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; pointerId: number; start: string[]; current: string[] } | null>(null);
  const latest = useRef({ serverKey, onReorder });
  useEffect(() => {
    latest.current = { serverKey, onReorder };
  });

  const byId = new Map(photos.map((p) => [p.id, p]));
  const ids = override && override.key === serverKey && override.ids.every((id) => byId.has(id)) ? override.ids : photos.map((p) => p.id);
  const list = ids.map((id) => byId.get(id)!).filter(Boolean);
  const canSort = !locked && list.length > 1;
  const sortOff = disabled || sortPaused || saving || !!dragId;

  async function save(next: string[]) {
    setOverride({ key: latest.current.serverKey, ids: next });
    setSaving(true);
    try {
      await latest.current.onReorder(next);
    } catch {
      setOverride(null); // eski sıraya dön; hata mesajını üst bileşen gösterir
    } finally {
      setSaving(false);
    }
  }

  const move = (index: number, delta: number) => {
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    save(moveItem(ids, index, j));
  };

  function startDrag(e: React.PointerEvent, id: string) {
    if (!canSort || sortOff) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    dragRef.current = { id, pointerId: e.pointerId, start: ids, current: ids };
    setOverride({ key: serverKey, ids });
    setDragId(id);
  }

  useEffect(() => {
    if (!dragId) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      e.preventDefault();
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-photo-id]");
      const overId = el && gridRef.current?.contains(el) ? el.dataset.photoId : undefined;
      if (overId && overId !== d.id) {
        d.current = moveItem(d.current, d.current.indexOf(d.id), d.current.indexOf(overId));
        setOverride({ key: latest.current.serverKey, ids: d.current });
      }
      // Ekranın üst/alt kenarına yaklaşınca sayfayı kaydır (uzun listede telefonla taşıma).
      const edge = 70;
      if (e.clientY < edge) window.scrollBy(0, -14);
      else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 14);
    };
    const onEnd = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      setDragId(null);
      if (e.type === "pointercancel" || d.current.join(",") === d.start.join(",")) {
        setOverride(null);
        return;
      }
      void save(d.current);
    };
    // Telefonda sürüklerken sayfanın kaymasını engelle (eski iOS sürümleri için yedek).
    const blockTouch = (e: TouchEvent) => e.preventDefault();
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    window.addEventListener("touchmove", blockTouch, { passive: false });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      window.removeEventListener("touchmove", blockTouch);
    };
    // save yalnızca ref'lerden okur; dinleyiciler sürükleme başına bir kez bağlanır.
  }, [dragId]);

  if (list.length === 0) {
    return <p className="mt-4 rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">Fotoğraf eklenmedi.</p>;
  }

  return (
    <>
      {canSort && (
        <p className="mt-3 text-xs text-zinc-500">
          Sıralamak için <span className="font-semibold">⠿</span> tutamacından sürükleyin veya ‹ › oklarını kullanın. İlk fotoğraf kapak olur.
          {saving && <span className="ml-1 font-medium text-zinc-700">Sıra kaydediliyor…</span>}
          {sortPaused && <span className="ml-1 font-medium text-zinc-700">Yükleme bitince sıralayabilirsiniz.</span>}
        </p>
      )}
      <div ref={gridRef} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((p, i) => (
          <div
            key={p.id}
            data-photo-id={p.id}
            data-testid="crm-photo"
            className={`select-none overflow-hidden rounded-lg border-2 transition-shadow ${p.isCover ? "border-accent" : "border-transparent"} ${
              dragId === p.id ? "scale-[0.97] opacity-70 shadow-lg ring-2 ring-accent" : ""
            }`}
          >
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" loading="lazy" draggable={false} className="pointer-events-none aspect-[3/2] w-full object-cover" />
              <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">{i + 1}</span>
              {canSort && (
                <>
                  <button
                    type="button"
                    aria-label="Sürükleyerek taşı"
                    title="Sürükleyerek taşı"
                    disabled={sortOff && dragId !== p.id}
                    onPointerDown={(e) => startDrag(e, p.id)}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{ touchAction: "none", WebkitTouchCallout: "none" }}
                    className="absolute right-1.5 top-1.5 grid h-10 w-10 cursor-grab place-items-center rounded-md bg-white/90 text-lg font-bold shadow active:cursor-grabbing disabled:opacity-40"
                  >
                    ⠿
                  </button>
                  <span className="absolute bottom-1.5 right-1.5 flex gap-1.5">
                    <button type="button" disabled={sortOff || i === 0} onClick={() => move(i, -1)} aria-label="Sola taşı" className="grid h-9 w-9 place-items-center rounded-md bg-white/90 text-base font-bold shadow disabled:opacity-40">‹</button>
                    <button type="button" disabled={sortOff || i === list.length - 1} onClick={() => move(i, 1)} aria-label="Sağa taşı" className="grid h-9 w-9 place-items-center rounded-md bg-white/90 text-base font-bold shadow disabled:opacity-40">›</button>
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center justify-between gap-1 bg-zinc-50 px-1 text-xs">
              {p.isCover ? (
                <span className="px-1.5 py-2.5 font-semibold text-accent-dark">★ Kapak</span>
              ) : (
                !locked && (
                  <button type="button" disabled={disabled || saving} onClick={() => onCover(p.id)} className="px-1.5 py-2.5 hover:underline disabled:opacity-40">
                    Kapak yap
                  </button>
                )
              )}
              {!locked && (
                <button type="button" disabled={disabled || saving} onClick={() => onDelete(p.id)} className="px-1.5 py-2.5 text-red-600 hover:underline disabled:opacity-40">
                  Sil
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
