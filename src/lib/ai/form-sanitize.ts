// Mir Motors "Araç Kontrol ve İlan Bilgi Formu" okumasının saf (veritabanı / ağ içermeyen) kısmı.
// AI yalnızca formda yazanı ve işaretli kutuları ham hâliyle verir; doğrulama, enum dönüşümü ve belirsizlik kararı burada (sunucuda) yapılır.
// Şablon: belgeler/arac-kontrol-formu.html (2 sayfa). Birim testleri doğrudan kullanır.
import { BODY_PART_KEYS, BODY_PART_LABELS, type BodyPartKey, type PartState } from "../body-parts";
import { BODY_TYPES, DRIVETRAINS, EQUIPMENT_OPTIONS, FUEL_TYPES, TRANSMISSIONS } from "../constants";
import { VIN_LAST6 } from "../listing-rules";

/** Formdaki seçenek kodları (AI şemasında enum; formdaki yazıyla birebir). */
export const FORM_OPTIONS = {
  fuel: ["Benzin", "Dizel", "Hibrit", "Elektrik", "LPG"],
  transmission: ["Otomatik", "Yarı otomatik", "Manuel"],
  bodyType: ["Sedan", "Hatchback", "SUV", "Coupe", "Cabrio", "Station Wagon", "MPV", "Pick-up", "Panelvan", "Kamyonet", "Minibüs"],
  drivetrain: ["Önden çekiş", "Arkadan itiş", "4x4"],
  partColumn: ["ORIGINAL", "LOCAL_PAINT", "PAINTED", "CHANGED", "NOT_CHECKED"],
  damageRecord: ["NONE", "MINOR", "HEAVY"],
  lien: ["NONE", "EXISTS"],
  warranty: ["ACTIVE", "NONE"],
  expertiseReport: ["VAR", "YOK"],
  authority: ["COMPANY", "OWNER_CONSENT"],
  edevlet: ["NOT_NEEDED", "GRANTED", "NOT_YET"],
} as const;

/** AI'nın kontrol formundan okuduğu ham değerler: yazılar olduğu gibi (metin), kutular işaretli seçenek listesi olarak. */
export type FormRaw = {
  /** Yüklenen her form görselinin formun kaçıncı sayfası olduğu (içerikten; sıra karışık yüklenmiş olabilir). */
  pages: { image: number; formPage: 1 | 2 | null }[];
  brand: string | null; model: string | null; packageName: string | null; vehicleClass: string | null; vehicleType: string | null;
  year: string | null; km: string | null; price: string | null; color: string | null; plate: string | null; vinLast6: string | null;
  engineCc: string | null; enginePowerHp: string | null; stockCode: string | null;
  fuel: string[]; transmission: string[]; bodyType: string[]; drivetrain: string[];
  /** Her parça satırında işaretli sütunlar (0, 1 veya birden fazla). */
  parts: Record<BodyPartKey, string[]>;
  damageRecord: string[]; damageNote: string | null; tramerAmount: string | null;
  lien: string[]; warranty: string[]; warrantyUntil: string | null; warrantyKm: string | null; expertiseReport: string[];
  equipment: string[]; otherEquipment: string | null;
  authority: string[]; edevlet: string[]; edevletUntil: string | null;
  notes: string | null;
  /** AI'nın okuyamadığı / emin olamadığı alanlar (el yazısı, silik işaret…). */
  unclear: { field: string; reason: string }[];
};

/** Okuma sonucu alan durumu: personelin kontrol etmesi gereken her şey ayrı listelenir. */
export type FieldStatus = "READ" | "UNREADABLE" | "AMBIGUOUS" | "BLANK";

export type FormRead = {
  pages: { page1: boolean; page2: boolean; reversed: boolean };
  vehicle: {
    brand: string | null; model: string | null; packageName: string | null; vehicleClass: string | null; vehicleType: string | null;
    year: number | null; km: number | null; price: number | null; color: string | null; plate: string | null; vinLast6: string | null;
    engineCc: number | null; enginePowerHp: number | null; stockCode: string | null;
    fuel: string | null; transmission: string | null; bodyType: string | null; drivetrain: string | null;
  };
  /** Personel beyanı (formdaki işaret); okunamayan / boş / çift işaretli parça "UNKNOWN". 1. sayfa yoksa null. */
  parts: Record<BodyPartKey, PartState> | null;
  legal: {
    damageRecord: string | null; damageNote: string | null; tramerAmount: number | null;
    legalLien: string | null; warrantyStatus: string | null; warrantyUntil: string | null; warrantyKm: number | null;
    registeredToCompany: boolean | null; ownerConsent: boolean | null;
  };
  /** CRM listesindeki karşılıklar + listede olmayanlar (kaybolmaz, personel kontrol eder). 2. sayfa yoksa null. */
  equipment: string[] | null;
  unmatchedEquipment: string[];
  status: { field: string; label: string; status: FieldStatus; note: string }[];
  warnings: string[];
  notes: string | null;
};

const LABELS: Record<string, string> = {
  brand: "Marka", model: "Model / ticari ad", packageName: "Seri / paket", vehicleClass: "Araç cinsi", vehicleType: "Araç tipi",
  year: "Model yılı", km: "Kilometre", price: "Satış fiyatı", color: "Renk", plate: "Plaka", vinLast6: "Şasi no (son 6)",
  engineCc: "Motor hacmi", enginePowerHp: "Motor gücü", stockCode: "Stok kodu", fuel: "Yakıt", transmission: "Vites", bodyType: "Kasa tipi",
  drivetrain: "Çekiş", damageRecord: "Hasar kaydı", damageNote: "Hasarın niteliği", tramerAmount: "Tramer tutarı", lien: "Rehin / haciz",
  warranty: "Garanti", warrantyUntil: "Garanti bitiş tarihi", warrantyKm: "Garanti bitiş km", authority: "Satış yetkisi", equipment: "Donanım",
};
/** Formda yıldızlı (yayın için gerekli) alanlar; diğerleri boş bırakılabilir. */
const NEEDED = new Set(["brand", "model", "vehicleClass", "vehicleType", "year", "km", "price", "plate", "vinLast6", "fuel", "transmission", "bodyType",
  "damageRecord", "damageNote", "lien", "warranty", "warrantyUntil", "warrantyKm", "authority", "equipment"]);
export const formFieldLabel =(f: string) => LABELS[f] ?? (f.startsWith("part:") ? `Kaporta: ${BODY_PART_LABELS[f.slice(5) as BodyPartKey] ?? f.slice(5)}` : f);

const scrub = (s: string) => s.replace(/\b[A-HJ-NPR-Z0-9]{11}([A-HJ-NPR-Z0-9]{6})\b/gi, "•••••••••••$1").replace(/\b\d{10,11}\b/g, "•••••••••••");
const text = (s: string | null | undefined, n: number) => {
  const t = s?.replace(/\s+/g, " ").trim();
  return t ? scrub(t).slice(0, n) : null;
};
const fold = (s: string) => s.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();

/**
 * Formdaki el yazısı sayıyı doğrular: binlik ayraç (nokta, boşluk, virgül) ve "km"/"TL" atılır; harf veya geçersiz aralık → okunamadı.
 * Hiçbir zaman tahminle düzeltme yapılmaz.
 */
export function parseFormInt(raw: string | null | undefined, min: number, max: number): { value: number | null; status: FieldStatus } {
  const t = raw?.trim();
  if (!t) return { value: null, status: "BLANK" };
  const cleaned = t.replace(/\s*(km|tl|₺|cc|hp|ps)\s*$/i, "").replace(/[.\s,']/g, "");
  if (!/^\d+$/.test(cleaned)) return { value: null, status: "UNREADABLE" };
  const n = Number(cleaned);
  return n >= min && n <= max ? { value: n, status: "READ" } : { value: null, status: "UNREADABLE" };
}

/** GG.AA.YYYY, GG/AA/YYYY veya YYYY-AA-GG → YYYY-AA-GG; geçersiz tarih okunamadı sayılır. */
export function parseFormDate(raw: string | null | undefined): { value: string | null; status: FieldStatus } {
  const t = raw?.trim();
  if (!t) return { value: null, status: "BLANK" };
  const m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/) ?? null;
  const iso = m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
  if (!iso) return { value: null, status: "UNREADABLE" };
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? { value: iso, status: "READ" } : { value: null, status: "UNREADABLE" };
}

/** Tek seçimli kutu grubu: hiç işaret yok → boş, birden fazla → belirsiz (otomatik tek seçeneğe indirilmez). */
function single<T extends string>(checked: string[], allowed: readonly T[]): { value: T | null; status: FieldStatus; note: string } {
  const valid = [...new Set(checked.filter((c): c is T => (allowed as readonly string[]).includes(c)))];
  if (valid.length === 0) return { value: null, status: checked.length ? "UNREADABLE" : "BLANK", note: checked.length ? "İşaret tanınamadı" : "Formda işaretlenmemiş" };
  if (valid.length > 1) return { value: null, status: "AMBIGUOUS", note: `Birden fazla seçenek işaretli: ${valid.join(", ")} — doğru olanı personel seçmeli` };
  return { value: valid[0], status: "READ", note: "" };
}

/** Formdaki yazımı CRM sabitlerine çevirir (ör. "Yarı otomatik" → "Yarı Otomatik", "4x4" → "4x4 / xDrive / quattro"). */
const toCrm = (value: string | null, list: string[]) => (value ? list.find((x) => fold(x) === fold(value) || fold(x).startsWith(fold(value))) ?? null : null);

const PART_FROM_COLUMN: Record<string, PartState> = { ORIGINAL: "ORIGINAL", LOCAL_PAINT: "LOCAL_PAINT", PAINTED: "PAINTED", CHANGED: "CHANGED", NOT_CHECKED: "UNKNOWN" };

export function sanitizeForm(f: FormRaw, now = new Date()): FormRead {
  const status: FormRead["status"] = [];
  const warnings: string[] = [];
  // Boş bırakılan isteğe bağlı alan (renk, paket…) listelenmez; yayın için gerekli alanlar ve okunamayan/belirsiz her alan listelenir.
  const mark = (field: string, s: FieldStatus, note = "") => {
    if (s === "READ" || (s === "BLANK" && !NEEDED.has(field) && !field.startsWith("part:"))) return;
    status.push({ field, label: formFieldLabel(field), status: s, note });
  };

  // Sayfalar: içerikten belirlenir; eksik sayfa bildirilir (eksik sayfanın alanları "okunmadı" sayılır, "yok" değil)
  const seen = f.pages.map((p) => p.formPage);
  const page1 = seen.includes(1), page2 = seen.includes(2);
  const reversed = f.pages.length === 2 && f.pages[0].formPage === 2 && f.pages[1].formPage === 1;
  if (!page1) warnings.push("Kontrol formunun 1. sayfası (temel bilgiler, kaporta, hasar ve yasal bilgiler) yüklenmedi veya tanınmadı; bu bilgiler okunmadı.");
  if (!page2) warnings.push("Kontrol formunun 2. sayfası (donanım ve satış yetkisi) yüklenmedi veya tanınmadı; bu bilgiler okunmadı.");
  if (reversed) warnings.push("Kontrol formu sayfaları ters sırada yüklenmiş; sayfalar içeriğe göre eşleştirildi.");
  if (f.pages.some((p) => p.formPage === null)) warnings.push("Kontrol formu olarak işaretlenen bir görsel formun sayfası olarak tanınamadı.");

  const unclear = new Map(f.unclear.map((u) => [u.field, scrub(u.reason).slice(0, 120)]));
  const str = (field: keyof FormRaw, n: number) => {
    const v = text(f[field] as string | null, n);
    if (page1) mark(field, unclear.has(field) ? "UNREADABLE" : v ? "READ" : "BLANK", unclear.get(field) ?? (v ? "" : "Formda boş"));
    return unclear.has(field) ? null : v;
  };
  const int = (field: keyof FormRaw, min: number, max: number) => {
    const r = parseFormInt(f[field] as string | null, min, max);
    const s = unclear.has(field) ? "UNREADABLE" : r.status;
    if (page1) mark(field, s, unclear.get(field) ?? (s === "UNREADABLE" ? `Geçerli sayı değil: "${text(f[field] as string, 30)}"` : "Formda boş"));
    return s === "READ" ? r.value : null;
  };
  const pick = <T extends string>(field: string, checked: string[], allowed: readonly T[], page: boolean) => {
    const r = single(checked, allowed);
    if (page) mark(field, unclear.has(field) && r.status === "READ" ? "AMBIGUOUS" : r.status, unclear.get(field) ?? r.note);
    return unclear.has(field) ? null : r.value;
  };

  const plateRaw = text(f.plate, 20)?.replace(/[\s-]+/g, "").toUpperCase() ?? null;
  const plate = plateRaw && /^\d{2}[A-ZÇĞİÖŞÜ]{1,3}\d{2,4}$/.test(plateRaw) && !unclear.has("plate") ? plateRaw : null;
  if (page1) mark("plate", plate ? "READ" : plateRaw ? "UNREADABLE" : unclear.has("plate") ? "UNREADABLE" : "BLANK", unclear.get("plate") ?? (plateRaw ? "Plaka biçimi geçersiz" : "Formda boş"));
  const vinRaw = text(f.vinLast6, 12)?.replace(/[\s-]/g, "").toUpperCase() ?? null;
  const vinLast6 = vinRaw && VIN_LAST6.test(vinRaw) && !unclear.has("vinLast6") ? vinRaw : null;
  if (page1) mark("vinLast6", vinLast6 ? "READ" : vinRaw || unclear.has("vinLast6") ? "UNREADABLE" : "BLANK", unclear.get("vinLast6") ?? (vinRaw ? "6 karakterlik geçerli şasi biçiminde değil (I, O, Q kullanılmaz)" : "Formda boş"));

  const vehicle: FormRead["vehicle"] = {
    brand: str("brand", 60), model: str("model", 60), packageName: str("packageName", 120), vehicleClass: str("vehicleClass", 60),
    vehicleType: str("vehicleType", 120)?.toUpperCase() ?? null,
    year: int("year", 1950, now.getFullYear() + 1), km: int("km", 0, 2_000_000), price: int("price", 1, 1_000_000_000),
    color: str("color", 60), plate, vinLast6, engineCc: int("engineCc", 1, 10_000), enginePowerHp: int("enginePowerHp", 1, 2000), stockCode: str("stockCode", 40),
    fuel: toCrm(pick("fuel", f.fuel, FORM_OPTIONS.fuel, page1), FUEL_TYPES),
    transmission: toCrm(pick("transmission", f.transmission, FORM_OPTIONS.transmission, page1), TRANSMISSIONS),
    bodyType: toCrm(pick("bodyType", f.bodyType, FORM_OPTIONS.bodyType, page1), BODY_TYPES),
    drivetrain: toCrm(pick("drivetrain", f.drivetrain, FORM_OPTIONS.drivetrain, page1), DRIVETRAINS),
  };

  // Kaporta: her satırda tek işaret; boş, çift işaretli veya okunamayan parça "Bilinmiyor" kalır (asla "Orijinal" sayılmaz)
  let parts: FormRead["parts"] = null;
  if (page1) {
    parts = Object.fromEntries(BODY_PART_KEYS.map((k) => [k, "UNKNOWN"])) as Record<BodyPartKey, PartState>;
    for (const k of BODY_PART_KEYS) {
      const r = single(f.parts?.[k] ?? [], FORM_OPTIONS.partColumn);
      const field = `part:${k}`;
      if (unclear.has(field)) { mark(field, "UNREADABLE", unclear.get(field)!); continue; }
      if (r.value) {
        parts[k] = PART_FROM_COLUMN[r.value];
        if (r.value === "NOT_CHECKED") mark(field, "BLANK", "Formda \"Kontrol edilemedi\" işaretli");
      } else mark(field, r.status, r.note);
    }
  }

  // Hasar ve yasal bilgiler (okunamayan hiçbir değer "Yok" sayılmaz)
  const damageRecord = pick("damageRecord", f.damageRecord, FORM_OPTIONS.damageRecord, page1);
  const damageNote = text(f.damageNote, 1500);
  if (page1 && (damageRecord === "MINOR" || damageRecord === "HEAVY") && !damageNote) mark("damageNote", "BLANK", "Hasar kaydı var ama niteliği yazılmamış");
  const tramer = parseFormInt(f.tramerAmount, 0, 100_000_000);
  if (page1 && tramer.status === "UNREADABLE") mark("tramerAmount", "UNREADABLE", `Geçerli tutar değil: "${text(f.tramerAmount, 30)}"`);
  const legalLien = pick("lien", f.lien, FORM_OPTIONS.lien, page1);
  const warrantyStatus = pick("warranty", f.warranty, FORM_OPTIONS.warranty, page1);
  const until = parseFormDate(f.warrantyUntil);
  const wkm = parseFormInt(f.warrantyKm, 0, 2_000_000);
  if (page1 && warrantyStatus === "ACTIVE") {
    if (until.status !== "READ") mark("warrantyUntil", until.status, until.status === "BLANK" ? "Garanti devam ediyor ama bitiş tarihi yazılmamış" : "Tarih okunamadı");
    if (wkm.status !== "READ") mark("warrantyKm", wkm.status, wkm.status === "BLANK" ? "Garanti devam ediyor ama bitiş km yazılmamış" : "Kilometre okunamadı");
  }
  const report = single(f.expertiseReport, FORM_OPTIONS.expertiseReport);
  if (report.value === "VAR") warnings.push("Formda \"resmî ekspertiz raporu var\" işaretli; raporu araca ayrıca ekleyin.");

  // 2. sayfa: satış yetkisi (personel beyanı) ve donanım
  const authority = page2 ? f.authority.filter((a) => (FORM_OPTIONS.authority as readonly string[]).includes(a)) : [];
  if (page2 && !authority.length) mark("authority", "BLANK", "Satış yetkisi kutularından hiçbiri işaretlenmemiş");
  const edevlet = single(f.edevlet, FORM_OPTIONS.edevlet);
  if (page2 && edevlet.value) {
    const d = parseFormDate(f.edevletUntil).value;
    const txt = edevlet.value === "GRANTED" ? `verildi${d ? ` (bitiş ${d})` : ""}` : edevlet.value === "NOT_NEEDED" ? "gerekmiyor (işletme adına)" : "henüz verilmedi";
    warnings.push(`Formda e-Devlet ilan yetkisi: ${txt}. Bu personel beyanıdır; EİDS doğrulaması değildir.`);
  } else if (page2 && edevlet.status === "AMBIGUOUS") warnings.push(`e-Devlet ilan yetkisi: ${edevlet.note}.`);

  let equipment: string[] | null = null;
  const unmatchedEquipment: string[] = [];
  if (page2) {
    equipment = [];
    for (const e of f.equipment) {
      const crm = EQUIPMENT_OPTIONS.find((x) => fold(x) === fold(e));
      if (crm) { if (!equipment.includes(crm)) equipment.push(crm); } else if (text(e, 80)) unmatchedEquipment.push(text(e, 80)!);
    }
    for (const e of (f.otherEquipment ?? "").split(/[,;\n]+/)) {
      const t = text(e, 80);
      if (!t) continue;
      const crm = EQUIPMENT_OPTIONS.find((x) => fold(x) === fold(t));
      if (crm) { if (!equipment.includes(crm)) equipment.push(crm); } else unmatchedEquipment.push(t);
    }
    // Listede olmayanlar kaybolmaz: araca eklenir (CRM'de "Diğer" grubunda), personel ayrıca kontrol eder
    for (const u of unmatchedEquipment) if (!equipment.includes(u)) equipment.push(u);
    if (unmatchedEquipment.length) warnings.push(`CRM listesinde karşılığı olmayan donanım: ${unmatchedEquipment.join(", ")} — "Diğer" olarak eklendi, kontrol edin.`);
    if (!equipment.length) mark("equipment", "BLANK", "Hiç donanım işaretlenmemiş (bu, araçta donanım olmadığı anlamına gelmez)");
  }

  return {
    pages: { page1, page2, reversed },
    vehicle,
    parts,
    legal: {
      damageRecord, damageNote: page1 ? damageNote : null, tramerAmount: page1 && tramer.status === "READ" ? tramer.value : null,
      legalLien, warrantyStatus,
      warrantyUntil: warrantyStatus === "ACTIVE" && until.status === "READ" ? until.value : null,
      warrantyKm: warrantyStatus === "ACTIVE" && wkm.status === "READ" ? wkm.value : null,
      registeredToCompany: authority.includes("COMPANY") ? true : null,
      ownerConsent: authority.includes("OWNER_CONSENT") ? true : null,
    },
    equipment,
    unmatchedEquipment,
    status,
    warnings,
    notes: page2 ? text(f.notes, 1500) : null,
  };
}
