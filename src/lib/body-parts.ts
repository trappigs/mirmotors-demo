// Kaporta parçaları ve durumları. Her parça veritabanında ayrı satırdır (VehiclePart); kaydı olmayan parça "Bilinmiyor".
// Bu dosya hem sunucuda hem istemcide (şema bileşeni) kullanılır; veritabanı içe aktarmaz.

export const BODY_PARTS = [
  { key: "FRONT_BUMPER", label: "Ön tampon" },
  { key: "HOOD", label: "Ön kaput" },
  { key: "ROOF", label: "Tavan" },
  { key: "TRUNK", label: "Bagaj kapağı" },
  { key: "REAR_BUMPER", label: "Arka tampon" },
  { key: "LEFT_FRONT_FENDER", label: "Sol ön çamurluk" },
  { key: "LEFT_FRONT_DOOR", label: "Sol ön kapı" },
  { key: "LEFT_REAR_DOOR", label: "Sol arka kapı" },
  { key: "LEFT_REAR_FENDER", label: "Sol arka çamurluk" },
  { key: "RIGHT_FRONT_FENDER", label: "Sağ ön çamurluk" },
  { key: "RIGHT_FRONT_DOOR", label: "Sağ ön kapı" },
  { key: "RIGHT_REAR_DOOR", label: "Sağ arka kapı" },
  { key: "RIGHT_REAR_FENDER", label: "Sağ arka çamurluk" },
] as const;

export type BodyPartKey = (typeof BODY_PARTS)[number]["key"];
export const BODY_PART_KEYS = BODY_PARTS.map((p) => p.key) as BodyPartKey[];
export const BODY_PART_LABELS = Object.fromEntries(BODY_PARTS.map((p) => [p.key, p.label])) as Record<BodyPartKey, string>;

export const PART_STATES = ["ORIGINAL", "LOCAL_PAINT", "PAINTED", "CHANGED", "UNKNOWN"] as const;
export type PartState = (typeof PART_STATES)[number];

/** Renkler referans kaporta şemasıyla aynı: gri orijinal, turuncu lokal boyalı, mavi boyalı, kırmızı değişen. */
export const PART_STATE_INFO: Record<PartState, { label: string; short: string; fill: string; text: string }> = {
  ORIGINAL: { label: "Orijinal", short: "", fill: "#c9cdd3", text: "#ffffff" },
  LOCAL_PAINT: { label: "Lokal boyalı", short: "LB", fill: "#f59e42", text: "#ffffff" },
  PAINTED: { label: "Boyalı", short: "B", fill: "#3b82c4", text: "#ffffff" },
  CHANGED: { label: "Değişen", short: "D", fill: "#f25c3c", text: "#ffffff" },
  UNKNOWN: { label: "Bilinmiyor", short: "?", fill: "url(#bilinmiyor)", text: "#6b7280" },
};

export const isBodyPartKey = (k: string): k is BodyPartKey => (BODY_PART_KEYS as string[]).includes(k);
export const isPartState = (s: string): s is PartState => (PART_STATES as readonly string[]).includes(s);

export type PartMap = Record<BodyPartKey, PartState>;

/** Veritabanı satırlarından tüm parçaların durum haritası (eksik parça = Bilinmiyor). */
export function toPartMap(rows: { part: string; state: string }[], field: "state" | "reportState" = "state"): PartMap {
  const map = Object.fromEntries(BODY_PART_KEYS.map((k) => [k, "UNKNOWN"])) as PartMap;
  for (const r of rows as { part: string; state: string; reportState?: string }[]) {
    const s = field === "state" ? r.state : r.reportState ?? "UNKNOWN";
    if (isBodyPartKey(r.part) && isPartState(s)) map[r.part] = s;
  }
  return map;
}

/** Filtreler için türetilmiş özet. "Tüm parçalar orijinal" yalnızca bütün parçalar doğrulandıysa doğrudur. */
export function summarizeParts(map: PartMap) {
  const states = BODY_PART_KEYS.map((k) => map[k]);
  const count = (s: PartState) => states.filter((x) => x === s).length;
  const unknown = count("UNKNOWN");
  return {
    bodyVerified: unknown === 0,
    paintedCount: count("PAINTED"),
    localPaintCount: count("LOCAL_PAINT"),
    changedCount: count("CHANGED"),
    unknownCount: unknown,
    allOriginal: unknown === 0 && count("ORIGINAL") === states.length,
  };
}

/** Parça adlarını duruma göre gruplar (müşteri ve CRM özet metni). */
export function groupByState(map: PartMap): Record<PartState, string[]> {
  const out = Object.fromEntries(PART_STATES.map((s) => [s, [] as string[]])) as Record<PartState, string[]>;
  for (const k of BODY_PART_KEYS) out[map[k]].push(BODY_PART_LABELS[k]);
  return out;
}

/** Personel beyanı ile ekspertiz raporu arasında, ikisi de bilinen ve farklı olan parçalar. */
export function partConflicts(staff: PartMap, report: PartMap): BodyPartKey[] {
  return BODY_PART_KEYS.filter((k) => staff[k] !== "UNKNOWN" && report[k] !== "UNKNOWN" && staff[k] !== report[k]);
}
