"use client";
import { useId, useState } from "react";
import { BODY_PART_LABELS, PART_STATE_INFO, PART_STATES, type BodyPartKey, type PartMap, type PartState } from "@/lib/body-parts";

/**
 * Kaporta durum şeması (üstten açılmış görünüm). Gerçek araç görseli değildir; yalnızca parçaların
 * boya/değişen durumunu gösteren teknik çizimdir. Ortada tampon-kaput-tavan-bagaj, yanlarda çamurluk ve kapılar.
 */
type Shape = { key: BodyPartKey; d: string; lx: number; ly: number };

const rect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r} V${y + r} Q${x},${y} ${x + r},${y} Z`;

// viewBox 0 0 420 520 — sol taraf aracın sol yanı, üst taraf ön.
const SIDE = (left: boolean): Shape[] => {
  const x = left ? 38 : 308;
  const p = left ? "LEFT" : "RIGHT";
  return [
    { key: `${p}_FRONT_FENDER` as BodyPartKey, d: rect(x, 40, 74, 100, 16), lx: x + 37, ly: 82 },
    { key: `${p}_FRONT_DOOR` as BodyPartKey, d: rect(x, 148, 74, 112, 6), lx: x + 37, ly: 206 },
    { key: `${p}_REAR_DOOR` as BodyPartKey, d: rect(x, 266, 74, 104, 6), lx: x + 37, ly: 320 },
    { key: `${p}_REAR_FENDER` as BodyPartKey, d: rect(x, 376, 74, 100, 16), lx: x + 37, ly: 436 },
  ];
};

/** Görünmez geniş dokunma alanları (yalnızca boşluğa taşar, komşu parçayla çakışmaz). */
const HIT_AREAS: Partial<Record<string, { x: number; y: number; width: number; height: number }>> = {
  FRONT_BUMPER: { x: 120, y: 0, width: 180, height: 50 },
  REAR_BUMPER: { x: 120, y: 466, width: 180, height: 54 },
};

const SHAPES: Shape[] = [
  { key: "FRONT_BUMPER", d: rect(140, 10, 140, 34, 12), lx: 210, ly: 29 },
  { key: "HOOD", d: "M152,56 Q210,48 268,56 L282,150 Q210,160 138,150 Z", lx: 210, ly: 106 },
  { key: "ROOF", d: rect(152, 222, 116, 112, 14), lx: 210, ly: 280 },
  { key: "TRUNK", d: "M140,396 Q210,404 280,396 L270,456 Q210,464 150,456 Z", lx: 210, ly: 430 },
  { key: "REAR_BUMPER", d: rect(140, 474, 140, 34, 12), lx: 210, ly: 493 },
  ...SIDE(true),
  ...SIDE(false),
];

/** Camlar ve tekerlekler: yalnızca yön göstermek için, parça değildir. */
function Decor() {
  return (
    <g pointerEvents="none" fill="#eef0f3" stroke="#d5d9df" strokeWidth="2">
      <path d="M140,162 Q210,152 280,162 L268,214 Q210,206 152,214 Z" />
      <path d="M152,342 Q210,348 268,342 L280,386 Q210,394 140,386 Z" />
      {[[38, 144], [38, 372], [382, 144], [382, 372]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="24" fill="#e2e5e9" stroke="#ffffff" strokeWidth="5" />
      ))}
    </g>
  );
}

type Props = {
  parts: PartMap;
  /** Düzenleme: parçaya tıklanınca seçili durum (fırça) uygulanır. */
  onPartClick?: (part: BodyPartKey) => void;
  /** Çelişki işareti gösterilecek parçalar (CRM). */
  flagged?: BodyPartKey[];
  className?: string;
};

export function BodyDiagram({ parts, onPartClick, flagged = [], className = "" }: Props) {
  const uid = useId().replace(/:/g, "");
  const [focus, setFocus] = useState<BodyPartKey | null>(null);
  const editable = Boolean(onPartClick);
  const info = focus ? `${BODY_PART_LABELS[focus]}: ${PART_STATE_INFO[parts[focus]].label}` : null;

  return (
    <div className={className}>
      <svg viewBox="0 0 420 520" className="mx-auto h-auto w-full max-w-[340px] select-none" role="group" aria-label="Kaporta boya ve değişen şeması">
        <defs>
          <pattern id={`bilinmiyor-${uid}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="#f3f4f6" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="#cfd4da" strokeWidth="3" />
          </pattern>
        </defs>
        <path d="M120,70 Q130,40 150,30 M300,70 Q290,40 270,30 M120,450 Q130,480 150,490 M300,450 Q290,480 270,490" fill="none" stroke="#e5e7eb" strokeWidth="2" />
        {SHAPES.map((s) => {
          const state = parts[s.key];
          const st = PART_STATE_INFO[state];
          const fill = state === "UNKNOWN" ? `url(#bilinmiyor-${uid})` : st.fill;
          const label = `${BODY_PART_LABELS[s.key]}: ${st.label}`;
          const isFlagged = flagged.includes(s.key);
          return (
            <g
              key={s.key}
              role={editable ? "button" : "img"}
              tabIndex={0}
              aria-label={label}
              data-part={s.key}
              data-state={state}
              className={`cursor-pointer outline-none transition-opacity hover:opacity-85 focus-visible:opacity-85`}
              onClick={() => (editable ? onPartClick!(s.key) : setFocus(s.key))}
              // Yalnızca fare ile üzerine gelme odak değiştirir; dokunmatikte dokunuş (click) parça adını sabit gösterir.
              onPointerEnter={(e) => e.pointerType === "mouse" && setFocus(s.key)}
              onPointerLeave={(e) => e.pointerType === "mouse" && setFocus((f) => (f === s.key ? null : f))}
              onFocus={() => setFocus(s.key)}
              onBlur={() => setFocus((f) => (f === s.key ? null : f))}
              onKeyDown={(e) => {
                if (editable && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onPartClick!(s.key);
                }
              }}
            >
              <title>{label}</title>
              {/* Tamponlar ince: telefonda kolay dokunulsun diye çevresindeki boş alan da (görünmez) dokunma alanına katılır */}
              {HIT_AREAS[s.key] && <rect {...HIT_AREAS[s.key]} fill="transparent" />}
              <path d={s.d} fill={fill} stroke={focus === s.key ? "#111827" : isFlagged ? "#dc2626" : "#ffffff"} strokeWidth={focus === s.key || isFlagged ? 3 : 2.5} />
              {st.short && (
                <text x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="central" fontSize="17" fontWeight="700" fill={st.text} pointerEvents="none">
                  {st.short}
                </text>
              )}
              {isFlagged && <circle cx={s.lx + 26} cy={s.ly - 22} r="7" fill="#dc2626" pointerEvents="none" />}
            </g>
          );
        })}
        <Decor />
      </svg>
      <p className="mt-2 min-h-5 text-center text-sm font-semibold text-ink" aria-live="polite" data-testid="body-part-info">
        {info ?? <span className="font-normal text-muted">{editable ? "Parçaya tıklayarak seçili durumu uygulayın" : "Parça adını görmek için üzerine gelin veya dokunun"}</span>}
      </p>
    </div>
  );
}

/** Renk açıklaması (referans şemadaki sıra). */
export function BodyLegend({ active, onSelect }: { active?: PartState; onSelect?: (s: PartState) => void }) {
  const order: PartState[] = ["ORIGINAL", "LOCAL_PAINT", "PAINTED", "CHANGED", "UNKNOWN"];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-ink">
      {order.filter((s) => PART_STATES.includes(s)).map((s) => {
        const st = PART_STATE_INFO[s];
        const swatch = (
          <span
            className="inline-block h-4 w-4 shrink-0 rounded-[4px]"
            style={s === "UNKNOWN" ? { background: "repeating-linear-gradient(45deg,#f3f4f6 0 3px,#cfd4da 3px 5px)" } : { background: st.fill }}
          />
        );
        return (
          <li key={s}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(s)}
                aria-pressed={active === s}
                data-testid={`brush-${s}`}
                className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition ${active === s ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-zinc-400"}`}
              >
                {swatch}{st.label}
              </button>
            ) : (
              <span className="inline-flex items-center gap-2">{swatch}{st.label}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
