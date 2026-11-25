"use client";
import { useId, useMemo, useRef, useState } from "react";

// Karşılaştırma: büyük/küçük harf, boşluk, tire ve Türkçe harf farkı yok sayılır ("tofas" = "Tofaş", "mercedes benz" = "Mercedes-Benz").
const TR: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", ë: "e", é: "e" };
const fold = (s: string) => s.toLocaleLowerCase("tr").replace(/[çğıöşüëé]/g, (c) => TR[c]).replace(/[\s.\-_/]+/g, "");
/** Yaygın kısaltmalar ve yazımlar → listedeki adın karşılaştırma biçimi. */
const ALIASES: Record<string, string> = {
  vw: "volkswagen", wv: "volkswagen", mercedes: "mercedesbenz", merso: "mercedesbenz", mb: "mercedesbenz", benz: "mercedesbenz",
  bmv: "bmw", alfa: "alfaromeo", range: "landrover", rangerover: "landrover",
};
/** İki metin arasındaki harf farkı (yazım hatası toleransı için). */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/**
 * Yazdıkça öneri gösteren metin kutusu (iPhone'da datalist güvenilir çalışmadığı için). Listede olmayan değer de yazılabilir.
 * "520" gibi sayısal aramada "5 Serisi" de önerilir (BMW/Mercedes adlandırması).
 */
export function SuggestInput({ id, value, onChange, options, placeholder, disabled, className, upper }: {
  id: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; disabled?: boolean; className?: string; upper?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Ok düğmesine basılınca açılır liste gibi: yazılan değere bakmadan bütün seçenekler gösterilir.
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const matches = useMemo(() => {
    if (showAll) return options.slice(0, 300);
    const raw = fold(value);
    // Boşken listenin tamamı (kaydırılabilir); sık kullanılanlar listenin başında gelir.
    if (!raw) return options.slice(0, 300);
    const q = ALIASES[raw] ?? raw;
    const series = /^\d{3}/.test(q) ? `${q[0]}serisi` : null;
    const starts = options.filter((o) => fold(o).startsWith(q) || (series && fold(o).startsWith(series)));
    const contains = options.filter((o) => !starts.includes(o) && fold(o).includes(q));
    let hits = [...starts, ...contains];
    // Yazım hatası: hiç eşleşme yoksa harf farkı az olanlar ("Wolksvagen" → Volkswagen, "Renalt" → Renault)
    if (!hits.length && q.length >= 3) {
      const tol = q.length >= 7 ? 2 : 1;
      hits = options
        .map((o) => ({ o, d: Math.min(distance(q, fold(o).slice(0, q.length)), distance(q, fold(o))) }))
        .filter((x) => x.d <= tol)
        .sort((a, b) => a.d - b.d)
        .map((x) => x.o);
    }
    // Tam eşleşme varsa (seçilmiş) liste gösterilmez
    return hits.length === 1 && fold(hits[0]) === q ? [] : hits.slice(0, 50);
  }, [value, options, showAll]);
  // Listede olmayan değer yazıldıysa: serbestçe kullanılabilir, listede "yeni eklenecek" diye gösterilir.
  const isNew = !showAll && value.trim().length > 0 && !options.some((o) => fold(o) === fold(value));
  const listVisible = open && !disabled && (matches.length > 0 || isNew);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        name={id}
        role="combobox"
        aria-expanded={listVisible}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => { setOpen(false); setShowAll(false); }, 150)}
        onChange={(e) => {
          setShowAll(false);
          onChange(upper ? e.target.value.toUpperCase() : e.target.value);
          setOpen(true);
        }}
        className={`${className ?? ""} pr-10`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Seçenekleri göster"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const next = !(open && showAll);
          setShowAll(next);
          setOpen(next);
          inputRef.current?.focus();
        }}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-500 disabled:opacity-40"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </button>
      {listVisible && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg" data-testid={`suggest-${id}`}>
          {isNew && (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                data-testid={`suggest-new-${id}`}
                className="block w-full border-b border-zinc-100 px-3 py-2.5 text-left text-base hover:bg-zinc-100 sm:text-sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOpen(false)}
              >
                <span className="font-semibold">“{value.trim()}”</span>
                <span className="text-zinc-500"> · listede yok, yeni olarak eklenecek</span>
              </button>
            </li>
          )}
          {matches.map((m) => (
            <li key={m} role="option" aria-selected={m === value}>
              <button
                type="button"
                className="block w-full px-3 py-2.5 text-left text-base hover:bg-zinc-100 sm:text-sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                  setShowAll(false);
                }}
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
