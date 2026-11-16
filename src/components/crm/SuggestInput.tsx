"use client";
import { useId, useMemo, useState } from "react";

const fold = (s: string) => s.toLocaleLowerCase("tr").replace(/[\s-]+/g, "");

/**
 * Yazdıkça öneri gösteren metin kutusu (iPhone'da datalist güvenilir çalışmadığı için). Listede olmayan değer de yazılabilir.
 * "520" gibi sayısal aramada "5 Serisi" de önerilir (BMW/Mercedes adlandırması).
 */
export function SuggestInput({ id, value, onChange, options, placeholder, disabled, className, upper }: {
  id: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; disabled?: boolean; className?: string; upper?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const matches = useMemo(() => {
    const q = fold(value);
    if (!q) return options.slice(0, 12);
    const series = /^\d{3}/.test(q) ? `${q[0]}serisi` : null;
    const hits = options.filter((o) => fold(o).includes(q) || (series && fold(o).startsWith(series)));
    // Tam eşleşme varsa (seçilmiş) liste gösterilmez
    return hits.length === 1 && fold(hits[0]) === q ? [] : hits.slice(0, 12);
  }, [value, options]);

  return (
    <div className="relative">
      <input
        id={id}
        name={id}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          onChange(upper ? e.target.value.toUpperCase() : e.target.value);
          setOpen(true);
        }}
        className={className}
      />
      {open && !disabled && matches.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg" data-testid={`suggest-${id}`}>
          {matches.map((m) => (
            <li key={m} role="option" aria-selected={m === value}>
              <button
                type="button"
                className="block w-full px-3 py-2.5 text-left text-base hover:bg-zinc-100 sm:text-sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(m);
                  setOpen(false);
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
