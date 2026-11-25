// Belge okumasının saf (veritabanı / ağ içermeyen) kısmı: AI'nın belge belge okuduğu ham değerleri
// güvenli ve tutarlı bir araç taslağına çevirir, aynı araç kontrolünü yapar. Birim testleri doğrudan kullanır.
import { BODY_PART_KEYS, type BodyPartKey, type PartState } from "../body-parts";
import { CONFLICT_FIELDS, type ConflictField, type DocKind, type Identity } from "../doc-review";
import { sanitizeForm, type FormRaw, type FormRead } from "./form-sanitize";

export type QualityIssue = "BLURRY" | "DARK" | "CROPPED" | "GLARE" | "LOW_RES";

/** AI'nın ruhsattan okuduğu ham değerler (kişisel veri içermez). */
export type RuhsatRaw = {
  brand: string | null; model: string | null; packageName: string | null; year: number | null; firstRegistrationDate: string | null;
  vehicleClass: string | null; color: string | null; engineCc: number | null; enginePowerKw: number | null; enginePowerHp: number | null;
  fuelText: string | null; seats: number | null; plate: string | null; vin: string | null; vinLabel: string | null; vinLast6Visible: string | null;
  ownerType: "COMPANY" | "PERSON" | "UNKNOWN";
  vehicleType?: string | null; // D.2 Tipi (eski okumalarda yok)
  tradeName?: string | null; // D.3 Ticari adı
  inspectionUntil?: string | null; // Z.2 muayene geçerlilik (GG/AA/YYYY)
};
/** AI'nın ekspertiz raporundan okuduğu ham değerler (alıcı adı / TC hariç). */
export type EkspertizRaw = {
  brand: string | null; model: string | null; year: number | null; plate: string | null; vin: string | null; vinLabel: string | null;
  vinLast6Visible: string | null; km: number | null; fuelText: string | null; transmissionText: string | null; reportDate: string | null;
  company: string | null; legend: { text: string; state: PartState }[]; parts: Record<BodyPartKey, PartState>; damageNote: string | null;
  engineFindings: string | null; mechanicalNotes: string | null; electricalNotes: string | null; tramerAmountTl: number | null;
  importantWarnings: string[];
  /** Kaporta şeması geometrisi: AI etiketin hangi görünüşte, aracın neresinde olduğunu söyler; sağ/sol kararını kod verir. */
  diagram?: Diagram | null;
};

export type DiagramView = { id: string; kind: "SIDE" | "TOP"; frontAt: "LEFT" | "RIGHT" | "UNKNOWN"; upsideDown: boolean };
export type DiagramSlot =
  | "FRONT_END" | "FENDER_FRONT" | "DOOR_FRONT" | "DOOR_REAR" | "FENDER_REAR" | "REAR_END"
  | "HOOD" | "ROOF" | "TRUNK" | "SILL" | "UNSURE";
/** order: yan görünüşte gövde üzerindeki kutunun önden sırası (1 = en önde); marşpiyel (SILL) ve emin olunmayanlar 0. */
export type Diagram = { views: DiagramView[]; labels: { viewId: string; slot: DiagramSlot; order?: number; text: string; state: PartState }[] };

/** Gövde kutusu sayısına göre sıra → konum: 4 kutu çamurluk-kapı-kapı-çamurluk, 6 kutu tamponlarla birlikte. Diğer sayılarda AI'nın konum tahmini kullanılır. */
const ORDER_SLOTS: Record<number, DiagramSlot[]> = {
  4: ["FENDER_FRONT", "DOOR_FRONT", "DOOR_REAR", "FENDER_REAR"],
  6: ["FRONT_END", "FENDER_FRONT", "DOOR_FRONT", "DOOR_REAR", "FENDER_REAR", "REAR_END"],
};
function slotsByOrder(d: Diagram): Diagram["labels"] {
  return d.labels.map((l) => {
    const view = d.views.find((v) => v.id === l.viewId);
    if (view?.kind !== "SIDE" || !l.order || l.slot === "SILL") return l;
    const body = d.labels.filter((x) => x.viewId === l.viewId && x.order && x.slot !== "SILL").sort((a, b) => a.order! - b.order!);
    const map = ORDER_SLOTS[body.length];
    const idx = body.indexOf(l);
    return map && idx >= 0 ? { ...l, slot: map[idx] } : l;
  });
}

/**
 * Yan görünüşte görülen taraf: aracın önü solda ve düz çizimde sol taraf, önü sağda ise sağ taraf görünür;
 * ters (tekerlekler üstte, açılmış şablon) çizimde tersi. Yön belirsizse null (parçalar Bilinmiyor kalır).
 */
export function visibleSide(v: DiagramView): "LEFT" | "RIGHT" | null {
  if (v.kind !== "SIDE" || v.frontAt === "UNKNOWN") return null;
  const left = v.frontAt === "LEFT" ? !v.upsideDown : v.upsideDown;
  return left ? "LEFT" : "RIGHT";
}

const SIDE_SLOT: Partial<Record<DiagramSlot, string>> = { FENDER_FRONT: "FRONT_FENDER", DOOR_FRONT: "FRONT_DOOR", DOOR_REAR: "REAR_DOOR", FENDER_REAR: "REAR_FENDER" };

/** Şema etiketlerini parçalara çevirir. Aynı parçaya çelişen iki değer gelirse parça Bilinmiyor kalır. */
export function partsFromDiagram(d: Diagram): { parts: Partial<Record<BodyPartKey, PartState>>; notes: string[] } {
  const out: Partial<Record<BodyPartKey, PartState>> = {};
  const clash = new Set<BodyPartKey>();
  const notes: string[] = [];
  for (const l of slotsByOrder(d)) {
    const view = d.views.find((v) => v.id === l.viewId);
    if (!view) continue;
    let key: string | null = null;
    if (l.slot === "HOOD" || l.slot === "ROOF" || l.slot === "TRUNK") key = l.slot;
    else if (l.slot === "FRONT_END") key = "FRONT_BUMPER";
    else if (l.slot === "REAR_END") key = "REAR_BUMPER";
    else if (SIDE_SLOT[l.slot]) {
      const side = visibleSide(view);
      if (!side) { notes.push(`Şemada aracın yönü anlaşılamadı; "${l.text}" etiketi bir parçaya atanmadı.`); continue; }
      key = `${side}_${SIDE_SLOT[l.slot]}`;
    }
    if (!key || !(BODY_PART_KEYS as string[]).includes(key)) continue;
    const k = key as BodyPartKey;
    if (out[k] && out[k] !== l.state) clash.add(k);
    else out[k] = l.state;
  }
  for (const k of clash) {
    out[k] = "UNKNOWN";
    notes.push(`Şemada ${k} için iki farklı değer okundu; personel kontrol etmeli.`);
  }
  return { parts: out, notes };
}

export type RawRead = {
  ruhsat: RuhsatRaw | null;
  ekspertiz: EkspertizRaw | null;
  /** Mir Motors Araç Kontrol Formu (yoksa null / eski okumalarda tanımsız). */
  form?: FormRaw | null;
  sources: { field: string; document: DocKind; page: number | null; location: string | null; text: string }[];
  unreadable: { field: string; document: DocKind; reason: string }[];
  /** Okunan ama AI'nın emin olmadığı alanlar (değer yazılır, personel belgeyle karşılaştırır). Eski okumalarda yok. */
  uncertain?: { field: string; document: DocKind; reason: string }[];
  quality: { document: DocKind; page: number; issues: QualityIssue[] }[];
  warnings: string[];
};

/** Ekrana, inceleme paneline ve araç kaydına giden birleştirilmiş taslak. */
export type DocumentRead = {
  vehicle: {
    brand: string | null; model: string | null; packageName: string | null; year: number | null; km: number | null;
    fuel: string | null; transmission: string | null; color: string | null; engineCc: number | null; enginePowerHp: number | null;
    plate: string | null; vinLast6: string | null; vinPartial: boolean; ownerIsCompany: boolean | null;
    firstRegistration: string | null; vehicleClass: string | null; seats: number | null; tramerAmount: number | null;
    bodyType: string | null; vehicleType?: string | null; tradeName?: string | null; inspectionUntil?: string | null;
  };
  parts: Record<BodyPartKey, PartState>;
  legend: { text: string; state: PartState }[];
  damageNote: string | null;
  expertiseSummary: string | null;
  reportDate: string | null;
  findings: { engine: string | null; mechanical: string | null; electrical: string | null; important: string[] };
  identity: Identity;
  identityNote: string;
  sources: RawRead["sources"];
  conflicts: { field: ConflictField; label: string; ruhsat: string; ekspertiz: string; labels?: [string, string] }[];
  missing: { field: string; label: string; reason: string }[];
  /** Değeri okunan ama AI'nın emin olmadığı alanlar (araç alan adıyla). Eski okumalarda yok. */
  uncertain?: { field: string; label: string; reason: string }[];
  quality: RawRead["quality"];
  warnings: string[];
  /** Kontrol formu okuması (personel beyanı): kaporta, hasar/yasal, donanım, satış yetkisi. Ekspertizin `parts`ından ayrı tutulur. */
  form?: FormRead | null;
  /** Araç alanının hangi belgeden geldiği (yalnızca ruhsat/ekspertiz dışı kaynaklar için). */
  origin?: Record<string, DocKind>;
};

/** T.C. kimlik / vergi no benzeri diziler ve tam şasi numarası (yalnızca son 6 hane kalır) kayıtlara yazılmaz. */
export const scrub = (s: string) => s.replace(/\b[A-HJ-NPR-Z0-9]{11}([A-HJ-NPR-Z0-9]{6})\b/gi, "•••••••••••$1").replace(/\b\d{10,11}\b/g, "•••••••••••");
const clip = (s: string | null | undefined, n: number) => (s ? scrub(s).slice(0, n) : null);
const cleanPlate = (p: string | null | undefined) => {
  const x = p?.replace(/[\s-]+/g, "").toUpperCase() ?? null;
  return x && /^\d{2}[A-ZÇĞİÖŞÜ]{1,3}\d{2,4}$/.test(x) ? x : null;
};
const VIN17 = /^[A-HJ-NPR-Z0-9]{17}$/;
/** Şasinin okunduğu etiket ruhsattaki "(E) Şase No" / ekspertizdeki şasi alanı olmalı; motor no, belge no vb. kabul edilmez. */
export const vinLabelOk = (label: string | null | undefined) =>
  !!label && /(\(E\)|ŞASE|ŞASİ|SASE|SASI|ŞASI|VIN|CHASSIS)/i.test(label) && !/MOTOR|BELGE|SER[İI]|TESC[İI]L SIRA/i.test(label);

/**
 * Şasi: yalnızca doğru etiketten okunmuş 17 karakterlik geçerli numaranın son 6 hanesi (tam numara saklanmaz).
 * Tam numara okunamadı ama son 6 hane doğru etiketle görülebildiyse "kısmi" olarak döner.
 */
export function resolveVin(vin: string | null | undefined, label: string | null | undefined, last6: string | null | undefined) {
  const labelOk = vinLabelOk(label);
  const full = vin?.replace(/[\s-]/g, "").toUpperCase() ?? "";
  if (labelOk && VIN17.test(full)) return { last6: full.slice(-6), partial: false, problem: null };
  const part = last6?.replace(/[\s-]/g, "").toUpperCase() ?? "";
  if (labelOk && /^[A-HJ-NPR-Z0-9]{6}$/.test(part)) return { last6: part, partial: true, problem: "Tam şasi okunamadı; yalnızca son 6 hane görülebildi." };
  if (!vin && !last6) return { last6: null, partial: false, problem: null };
  return {
    last6: null,
    partial: false,
    problem: labelOk ? "Şasi numarası 17 karakterlik geçerli biçimde okunamadı." : "Şasi numarası doğru alandan (Şase No) okunduğu doğrulanamadı; motor no vb. ile karışmış olabilir.",
  };
}

/** BÜYÜK HARFLİ belge metnini okunur hâle getirir ("FIAT" → "Fiat", "GRİ (MİSTİK)" → "Gri (Mistik)"). */
const title = (s: string | null | undefined) => {
  if (!s) return null;
  const loc = /[İŞĞÜÖÇışğüöç]/.test(s) ? "tr" : "en";
  return s.trim().toLocaleLowerCase(loc).replace(/(^|[\s\-(/])(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase(loc));
};
/** Marka / model / paket adı: kısaltmalar (BMW, TDI, LT) ve rakamlı kelimeler (16V, 520i değil 520I) büyük harf kalır, diğerleri baş harf büyük. */
const titleName = (s: string | null | undefined) => {
  const t = title(s);
  if (!t || !s) return t;
  const src = s.trim().split(/\s+/);
  return t.split(/\s+/).map((w, i) => {
    const o = src[i] ?? "";
    return o === o.toLocaleUpperCase("tr") && (/^\p{L}{2,3}$/u.test(o) || (/\d/.test(o) && /\p{L}/u.test(o))) ? o : w;
  }).join(" ");
};
const norm = (s: string | null | undefined) => (s ?? "").toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]/g, "");

export function mapFuel(t: string | null | undefined): string | null {
  const s = norm(t);
  if (!s) return null;
  if (s.includes("lpg")) return "LPG";
  if (s.includes("dizel") || s.includes("motorin") || s.includes("diesel")) return "Dizel";
  if (s.includes("elektrik")) return "Elektrik";
  if (s.includes("hibrit") || s.includes("hybrid")) return "Hibrit";
  if (s.includes("benzin")) return "Benzin";
  return null;
}
/**
 * Ruhsattaki araç cinsi / kasa kodundan kasa tipi: AB kasa kodları (AA Sedan, AB Hatchback, AC Station, AD Coupe, AE Cabrio, AF MPV;
 * ticari: BA Kamyonet, BB Panelvan)
 * veya açık kasa adı. Tanınmayan metin null (personel seçer).
 */
const isVan = (s: string) => s.includes("PANELVAN") || s.includes("PANEL VAN") || s.includes("P.VAN") || /\bVAN\b/.test(s);

/** Ruhsattaki tip (D.2) yalnızca açıkça panelvan yazıyorsa kasa tipi verir (ör. "LT35 P.VAN H/R LWB"); başka tahmin yapılmaz. */
export function bodyTypeFromVehicleType(t: string | null | undefined): string | null {
  return isVan((t ?? "").toLocaleUpperCase("tr")) ? "Panelvan" : null;
}

/** "GG/AA/YYYY" → "YYYY-AA-GG"; geçersiz tarih null (tahmin yok). */
function isoDate(t: string | null | undefined): string | null {
  const m = (t ?? "").match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return d.getUTCDate() === +m[1] && d.getUTCMonth() === +m[2] - 1 ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function mapBodyType(t: string | null | undefined): string | null {
  // Boşluklar korunur (kod "AA" ayrı kelime olarak aranır); Türkçe harfler sadeleştirilir
  const s = (t ?? "").toLocaleUpperCase("tr").replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C").replace(/Ğ/g, "G");
  if (!s.trim()) return null;
  const code = s.match(/\bA([A-F])\b/)?.[1];
  const byCode: Record<string, string> = { A: "Sedan", B: "Hatchback", C: "Station Wagon", D: "Coupe", E: "Cabrio", F: "MPV" };
  if (code) return byCode[code];
  const commercial = s.match(/\bB([AB])\b/)?.[1];
  if (commercial) return commercial === "A" ? "Kamyonet" : "Panelvan";
  if (s.includes("SEDAN")) return "Sedan";
  if (s.includes("HATCHBACK") || /\bHB\b/.test(s)) return "Hatchback";
  if (s.includes("STATION") || s.includes("STW") || /\bSW\b/.test(s)) return "Station Wagon";
  if (s.includes("COUPE") || s.includes("KUPE")) return "Coupe";
  if (s.includes("CABRIO") || s.includes("KABRIYO") || s.includes("CONVERTIBLE")) return "Cabrio";
  if (s.includes("MPV") || s.includes("MINIVAN")) return "MPV";
  if (s.includes("PICK") || s.includes("PIKAP")) return "Pick-up";
  if (s.includes("SUV")) return "SUV";
  if (isVan(s)) return "Panelvan";
  if (s.includes("MINIBUS")) return "Minibüs";
  // Cinsi "KAMYONET" kasa tipini belirlemez (panelvanlar da kamyonet cinsindedir): personel seçer.
  return null;
}

export function mapTransmission(t: string | null | undefined): string | null {
  const s = norm(t);
  if (!s) return null;
  if (s.includes("yar")) return "Yarı Otomatik";
  if (s.includes("otomatik") || s.includes("auto")) return "Otomatik";
  if (s.includes("manuel") || s.includes("düz") || s.includes("duz")) return "Manuel";
  return null;
}

const FIELD_LABELS: Record<string, string> = {
  brand: "Marka", model: "Model", year: "Model yılı", km: "Kilometre", fuel: "Yakıt", transmission: "Vites", plate: "Plaka",
  vinLast6: "Şasi no (son 6)", color: "Renk", engineCc: "Motor hacmi", enginePowerHp: "Motor gücü", price: "Fiyat", bodyType: "Kasa tipi",
  tramerAmount: "Tramer tutarı", packageName: "Tip / paket", vehicleClass: "Araç cinsi", vehicleType: "Araç tipi (D.2)",
  firstRegistration: "İlk tescil tarihi", seats: "Koltuk sayısı", inspectionUntil: "Muayene geçerlilik",
};

/** AI'nın ham alan adları → araç alan adı (okunamayan / emin olunamayan listeleri araç alanlarıyla eşlensin). */
const RAW_FIELD: Record<string, string> = {
  firstRegistrationDate: "firstRegistration", enginePowerKw: "enginePowerHp", fuelText: "fuel", transmissionText: "transmission",
  vin: "vinLast6", vinLast6Visible: "vinLast6", vinLabel: "vinLast6", tramerAmountTl: "tramerAmount",
};
const toVehicleField = (f: string) => RAW_FIELD[f] ?? f;

/**
 * Ham okumayı taslağa çevirir ve aynı araç kontrolünü yapar. Öncelik: güvenilir tam şasi → doğrulanmış kısmi şasi → plaka → marka.
 * Şasi uyuşmazsa belgeler farklı araca aittir: ekspertiz bilgileri (km, kaporta, hasar) birleştirilmez.
 * Yalnızca plaka farkı kesin "farklı araç" sayılmaz (plaka değişmiş olabilir); incelemeye gönderilir.
 */
export function mergeReadings(raw: RawRead): DocumentRead {
  const r = raw.ruhsat;
  const e = raw.ekspertiz;
  const warnings = raw.warnings.slice(0, 20).map((w) => scrub(w).slice(0, 300));
  const rv = resolveVin(r?.vin, r?.vinLabel, r?.vinLast6Visible);
  const ev = resolveVin(e?.vin, e?.vinLabel, e?.vinLast6Visible);
  if (rv.problem) warnings.push(`Ruhsat: ${rv.problem}`);
  if (ev.problem) warnings.push(`Ekspertiz: ${ev.problem}`);
  const rPlate = cleanPlate(r?.plate), ePlate = cleanPlate(e?.plate);
  const sameBrand = (a?: string | null, b?: string | null) => !a || !b || norm(a).startsWith(norm(b)) || norm(b).startsWith(norm(a));

  let identity: Identity = "SINGLE";
  let identityNote = r && e ? "" : r ? "Yalnızca ruhsat okundu." : "Yalnızca ekspertiz raporu okundu.";
  if (r && e) {
    if (rv.last6 && ev.last6) {
      if (rv.last6 !== ev.last6) {
        identity = "DIFFERENT";
        identityNote = `Şasi uyuşmuyor (ruhsat …${rv.last6}, ekspertiz …${ev.last6}). Ekspertiz bilgileri birleştirilmedi.`;
      } else if (!rv.partial && !ev.partial) {
        identity = "SAME";
        identityNote = "Tam şasi numarası iki belgede aynı.";
      } else {
        identity = "SAME";
        identityNote = "Şasinin son 6 hanesi iki belgede aynı (en az biri kısmi okuma).";
      }
    } else if (rPlate && ePlate && rPlate === ePlate && sameBrand(r.brand, e.brand)) {
      identity = "SAME";
      identityNote = "Plaka ve marka eşleşti; şasi karşılaştırılamadı.";
    } else if (rPlate && ePlate && rPlate !== ePlate) {
      identity = "REVIEW";
      identityNote = "Plakalar farklı ve şasi karşılaştırılamadı. Plaka değişmiş olabilir; aynı araç olduğunu doğrulayın.";
    } else {
      identity = "REVIEW";
      identityNote = "Belgelerin aynı araca ait olduğu doğrulanamadı (karşılaştırılacak şasi/plaka yok).";
    }
    if (identity === "SAME" && !sameBrand(r.brand, e.brand)) {
      identity = "REVIEW";
      identityNote += " Ancak marka bilgisi farklı; kontrol edin.";
    }
  }
  const useE = e && identity !== "DIFFERENT" ? e : null;
  if (identity === "DIFFERENT") warnings.unshift(identityNote);

  const conflicts: DocumentRead["conflicts"] = [];
  const cmp = (field: ConflictField, a: string | null | undefined, b: string | null | undefined, same = (x: string, y: string) => x === y) => {
    if (a && b && !same(a, b)) conflicts.push({ field, label: CONFLICT_FIELDS[field].label, ruhsat: a, ekspertiz: b });
  };
  if (r && e) {
    cmp("plate", rPlate, ePlate);
    cmp("vinLast6", rv.last6, ev.last6);
    cmp("brand", title(r.brand), title(e.brand), (x, y) => sameBrand(x, y));
    cmp("model", title(r.model), title(e.model), (x, y) => norm(x).includes(norm(y)) || norm(y).includes(norm(x)));
    cmp("year", r.year ? String(r.year) : null, e.year ? String(e.year) : null);
    if (useE) cmp("fuel", mapFuel(r.fuelText), mapFuel(e.fuelText));
  }

  const unknownParts = Object.fromEntries(BODY_PART_KEYS.map((k) => [k, "UNKNOWN"])) as Record<BodyPartKey, PartState>;
  const hp = r?.enginePowerHp ?? (r?.enginePowerKw ? Math.round(r.enginePowerKw * 1.35962) : null);
  const vehicle: DocumentRead["vehicle"] = {
    brand: titleName(r?.brand ?? useE?.brand),
    model: titleName(r?.model ?? useE?.model),
    packageName: titleName(r?.packageName),
    year: r?.year ?? useE?.year ?? null,
    km: useE?.km ?? null,
    fuel: mapFuel(r?.fuelText) ?? mapFuel(useE?.fuelText),
    transmission: mapTransmission(useE?.transmissionText),
    color: title(r?.color),
    engineCc: r?.engineCc ?? null,
    enginePowerHp: hp,
    plate: rPlate ?? (useE ? ePlate : null),
    vinLast6: rv.last6 ?? (useE ? ev.last6 : null),
    vinPartial: rv.last6 ? rv.partial : useE && ev.last6 ? ev.partial : false,
    ownerIsCompany: r ? (r.ownerType === "COMPANY" ? true : r.ownerType === "PERSON" ? false : null) : null,
    firstRegistration: r?.firstRegistrationDate ?? null,
    // Cinsi alanındaki kasa kodu açıklaması ("OTOMOBİL (AA SEDAN)") kasa tipine çevrilir; cinsi yalnızca "Otomobil" olarak kalır
    vehicleClass: title(r?.vehicleClass?.replace(/\(.*?\)/g, "").trim()),
    vehicleType: r?.vehicleType?.trim().slice(0, 120).toUpperCase() || null,
    tradeName: r?.tradeName?.trim().slice(0, 120).toUpperCase() || null,
    inspectionUntil: isoDate(r?.inspectionUntil),
    bodyType: mapBodyType(r?.vehicleClass) ?? bodyTypeFromVehicleType(r?.vehicleType),
    seats: r?.seats ?? null,
    tramerAmount: useE?.tramerAmountTl ?? null,
  };

  // Şema okunduysa parça durumları geometriden (görünüş + konum) kodla çıkarılır; AI'nın doğrudan parça listesi yalnızca şema yoksa kullanılır.
  const fromDiagram = useE?.diagram?.labels.length ? partsFromDiagram(useE.diagram) : null;
  const diagramParts = fromDiagram ? fromDiagram.parts : null;
  if (fromDiagram) warnings.push(...fromDiagram.notes);

  // Eksik alanlar ve nedenleri (AI'nın bildirdiği neden varsa o, yoksa belge türüne göre açıklama)
  const reasonOf = (field: string) => clip(raw.unreadable.find((u) => toVehicleField(u.field) === field)?.reason, 200) ?? undefined;
  const missing: DocumentRead["missing"] = [];
  const need: [string, unknown, string][] = [
    ["brand", vehicle.brand, "Belgelerde okunamadı"],
    ["model", vehicle.model, "Belgelerde okunamadı"],
    ["year", vehicle.year, "Belgelerde okunamadı"],
    ["km", vehicle.km, useE ? "Ekspertiz raporunda okunamadı" : e ? "Ekspertiz başka araca ait göründüğü için alınmadı" : "Kilometre ruhsatta yer almaz; ekspertiz yüklenmedi"],
    ["fuel", vehicle.fuel, "Belgelerde okunamadı"],
    ["transmission", vehicle.transmission, useE ? "Ekspertiz raporunda okunamadı" : "Vites ruhsatta yer almaz"],
    ["plate", vehicle.plate, "Belgelerde okunamadı"],
    ["vinLast6", vehicle.vinLast6, rv.problem ?? ev.problem ?? "Belgelerde okunamadı"],
    ["tramerAmount", vehicle.tramerAmount, useE ? "Ekspertizde tramer bilgisi yok; bu tramer olmadığı anlamına gelmez" : "Tramer bilgisi belgelerde yok (sigorta sorgusundan girilir)"],
    ["price", null, "Fiyat belgelerde yer almaz; personel girer"],
    ["bodyType", vehicle.bodyType, r ? "Ruhsatta kasa tipi kodu okunamadı; personel seçer" : "Kasa tipi ruhsattan okunur; personel seçer"],
  ];
  for (const [field, val, fallback] of need) {
    if (val === null || val === undefined) missing.push({ field, label: FIELD_LABELS[field], reason: reasonOf(field) ?? fallback });
  }
  // Ruhsatta bulunan diğer alanlar: ruhsat okunduysa ve boş kaldıysa nedeniyle listelenir (yayını engellemez; personel tamamlar)
  if (r) {
    const optional: [string, unknown][] = [
      ["packageName", vehicle.packageName], ["vehicleClass", vehicle.vehicleClass], ["vehicleType", vehicle.vehicleType], ["color", vehicle.color],
      ["engineCc", vehicle.engineCc], ["enginePowerHp", vehicle.enginePowerHp], ["firstRegistration", vehicle.firstRegistration], ["seats", vehicle.seats],
    ];
    for (const [field, val] of optional) {
      if (val === null || val === undefined) missing.push({ field, label: FIELD_LABELS[field], reason: reasonOf(field) ?? "Ruhsatta okunamadı" });
    }
  }

  // Okunan ama AI'nın emin olmadığı alanlar: yalnızca değeri dolu olanlar (boş alan zaten "eksik" listesinde)
  const vrec = vehicle as Record<string, unknown>;
  const uncertain: NonNullable<DocumentRead["uncertain"]> = [];
  for (const u of raw.uncertain ?? []) {
    const field = toVehicleField(u.field);
    if (vrec[field] === null || vrec[field] === undefined || uncertain.some((x) => x.field === field)) continue;
    uncertain.push({ field, label: FIELD_LABELS[field] ?? field, reason: clip(u.reason, 200) ?? "AI emin değil" });
  }

  const read: DocumentRead = {
    vehicle,
    parts: useE ? { ...unknownParts, ...(diagramParts ?? useE.parts) } : unknownParts,
    legend: useE?.legend.slice(0, 12) ?? [],
    damageNote: clip(useE?.damageNote, 1500),
    expertiseSummary: useE
      ? clip([useE.reportDate && `${useE.reportDate} tarihli`, useE.company, "ekspertiz raporu."].filter(Boolean).join(" "), 300)
      : null,
    reportDate: useE?.reportDate ?? null,
    findings: {
      engine: clip(useE?.engineFindings, 800),
      mechanical: clip(useE?.mechanicalNotes, 800),
      electrical: clip(useE?.electricalNotes, 800),
      important: (useE?.importantWarnings ?? []).slice(0, 10).map((w) => scrub(w).slice(0, 300)),
    },
    identity,
    identityNote,
    sources: raw.sources.slice(0, 60).map((s) => ({ ...s, text: scrub(s.text).slice(0, 200), location: s.location ? s.location.slice(0, 80) : null })),
    conflicts,
    missing,
    uncertain,
    quality: raw.quality,
    warnings,
  };
  return raw.form ? mergeForm(read, sanitizeForm(raw.form), Boolean(r || e)) : read;
}

/** Ruhsat/ekspertizde de bulunan alanlar: iki kaynak farklıysa çelişki olarak personele sorulur (AI veya kod seçmez). */
const FORM_COMPARE: [ConflictField, keyof FormRead["vehicle"] & keyof DocumentRead["vehicle"]][] = [
  ["plate", "plate"], ["vinLast6", "vinLast6"], ["brand", "brand"], ["model", "model"], ["year", "year"], ["fuel", "fuel"],
  ["km", "km"], ["transmission", "transmission"], ["bodyType", "bodyType"],
];
/** Yalnızca boşsa formdan doldurulan araç alanları (karşılaştırılmaz). */
const FORM_FILL: (keyof FormRead["vehicle"] & keyof DocumentRead["vehicle"])[] = ["packageName", "vehicleClass", "vehicleType", "color", "engineCc", "enginePowerHp"];

/**
 * Kontrol formunu ruhsat/ekspertiz okumasıyla birleştirir. Kaynaklar ayrı kalır:
 * - kimlik/teknik alanlar: ruhsat (ve ekspertiz) önceliklidir; form farklıysa çelişki listesine düşer,
 * - formun kaporta işaretleri personel beyanıdır (`form.parts`); ekspertiz raporu (`parts`) ile karşılaştırma mevcut uyarıyla yapılır,
 * - formun okunamayan / belirsiz / boş alanları "Eksik veya belirsiz" listesine nedeniyle eklenir.
 */
export function mergeForm(read: DocumentRead, form: FormRead, otherDocs: boolean): DocumentRead {
  const v = read.vehicle as Record<string, unknown>;
  const fv = form.vehicle as Record<string, unknown>;
  const origin: Record<string, DocKind> = { ...read.origin };
  const conflicts = [...read.conflicts];
  for (const [field, key] of FORM_COMPARE) {
    const have = v[key], got = fv[key];
    if (got === null || got === undefined) continue;
    if (have === null || have === undefined) { v[key] = got; origin[key] = "FORM"; continue; }
    // Büyük/küçük harf ve I/İ/ı/i farkı çelişki sayılmaz ("I20" = "i20")
    const loose = (s: string) => norm(s.replace(/[Iİ]/g, "i")).replace(/ı/g, "i");
    const same = typeof have === "string" && typeof got === "string" ? loose(have) === loose(got) || (field === "model" && (loose(have).includes(loose(got)) || loose(got).includes(loose(have)))) : String(have) === String(got);
    if (!same) conflicts.push({ field, label: CONFLICT_FIELDS[field].label, ruhsat: String(have), ekspertiz: String(got), labels: ["Ruhsat / ekspertiz", "Kontrol formu"] });
  }
  for (const key of FORM_FILL) {
    if ((v[key] === null || v[key] === undefined) && fv[key] !== null && fv[key] !== undefined) { v[key] = fv[key]; origin[key] = "FORM"; }
  }
  if (v.vinLast6 && origin.vinLast6 === "FORM") read.vehicle.vinPartial = true; // formda yalnızca son 6 hane yazılır

  // Şasi farklıysa belgeler farklı araca ait olabilir: kimlik onayı istenir
  let { identity, identityNote } = read;
  const vinConflict = conflicts.some((c) => c.field === "vinLast6" && !read.conflicts.includes(c));
  const sameVin = !!(read.vehicle.vinLast6 && form.vehicle.vinLast6 && read.vehicle.vinLast6 === form.vehicle.vinLast6);
  const samePlate = !!(read.vehicle.plate && form.vehicle.plate && read.vehicle.plate === form.vehicle.plate);
  if (!otherDocs) { identity = "SINGLE"; identityNote = "Yalnızca kontrol formu okundu."; }
  else if (vinConflict && identity !== "DIFFERENT") { identity = "REVIEW"; identityNote = `${identityNote} Kontrol formundaki şasi son 6 hane belgeyle uyuşmuyor; aynı araç olduğunu doğrulayın.`.trim(); }
  else if (identity === "SINGLE" && sameVin) { identity = "SAME"; identityNote = `Şasinin son 6 hanesi${samePlate ? " ve plaka" : ""} ruhsatta ve kontrol formunda aynı.`; }
  else if (identity === "SINGLE") { identity = "REVIEW"; identityNote = "Ruhsat ve kontrol formunun aynı araca ait olduğu şasi ile doğrulanamadı; kontrol edin."; }

  // Formun doldurduğu alanlar artık "eksik" değildir; formun kendi sorunları nedeniyle eklenir
  const filled = new Set(Object.keys(origin));
  const fromForm = (f: string) => (f === "tramerAmount" && form.legal.tramerAmount !== null) || (f === "price" && form.vehicle.price !== null);
  const missing = read.missing.filter((m) => !filled.has(m.field) && !fromForm(m.field));
  const STATUS_TEXT = { UNREADABLE: "Kontrol formunda okunamadı", AMBIGUOUS: "Kontrol formunda belirsiz", BLANK: "Kontrol formunda boş", READ: "" } as const;
  for (const s of form.status) missing.push({ field: s.field, label: s.label, reason: `${STATUS_TEXT[s.status]}${s.note ? `: ${s.note}` : ""}` });

  return {
    ...read,
    identity,
    identityNote,
    conflicts,
    missing,
    warnings: [...read.warnings, ...form.warnings],
    damageNote: form.legal.damageNote ?? read.damageNote,
    form,
    origin,
  };
}
