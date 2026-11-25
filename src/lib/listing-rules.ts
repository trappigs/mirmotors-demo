// İlan yayımlama kuralları: mevzuattaki zorunlu ilan bilgileri + Mir Motors'un kendi yayın kuralları.
// Veritabanı içe aktarmaz; durum makinesi, CRM ekranları ve testler birlikte kullanır.
import { BODY_PART_KEYS, BODY_PART_LABELS, partConflicts, type PartMap } from "./body-parts";

/** İşletme düzeyindeki bilgiler (CRM > Ayarlar; yoksa ortam değişkeni). Hiçbiri uydurulmaz. */
export type CompanyInfo = { title: string | null; authorizationNo: string | null; mersis: string | null; address: string | null };

/** Ortam değişkenindeki işletme bilgileri (ayarlar tablosu boşsa yedek). */
export function envCompanyInfo(): CompanyInfo {
  const v = (k: string) => process.env[k]?.trim() || null;
  return { title: v("COMPANY_TITLE"), authorizationNo: v("COMPANY_AUTHORIZATION_NO"), mersis: v("COMPANY_MERSIS"), address: v("COMPANY_ADDRESS") };
}

type N<T> = T | null | undefined;
type VehicleCore = {
  brand?: N<string>; model?: N<string>; year?: N<number>; km?: N<number>; price?: N<number>;
  fuel?: N<string>; transmission?: N<string>; bodyType?: N<string>;
};

/** Vitrin ve filtreleme için her zaman zorunlu araç bilgileri (eksik olanların etiketleri). */
export function missingVehicleFields(v: VehicleCore): string[] {
  const req: [unknown, string][] = [
    [v.brand, "Marka"], [v.model, "Model"], [v.year, "Model yılı"], [v.km, "Kilometre"], [v.price && v.price > 0 ? v.price : null, "Fiyat"],
    [v.fuel, "Yakıt"], [v.transmission, "Vites"], [v.bodyType, "Kasa tipi"],
  ];
  return req.filter(([val]) => empty(val)).map(([, l]) => l);
}

const empty = (val: unknown) => val === null || val === undefined || val === "";

/**
 * Durum değerleri. Doğrulanmamış bilgi boş bırakılır ("Bilgi girilmedi" = null) ve hiçbir zaman "Yok" sayılmaz.
 * Eski kayıtlardaki "sorgulanmadı / doğrulanamadı / bilinmiyor" değerleri (NOT_QUERIED, UNVERIFIED, UNKNOWN) artık seçilemez;
 * okunduklarında "Bilgi girilmedi" gibi davranır (yayını engeller).
 */
export const DAMAGE_RECORDS = ["NONE", "MINOR", "HEAVY"] as const;
export const DAMAGE_EXISTS = ["MINOR", "HEAVY"];
export const LIEN_STATES = ["NONE", "EXISTS"] as const;
export const WARRANTY_STATES = ["NONE", "ACTIVE"] as const;
/** Geçerli değer değilse null (eski değerler dahil): form ve ekranlar "Bilgi girilmedi" gösterir. */
export const knownState = (list: readonly string[], v: N<string>) => (v && list.includes(v) ? v : null);

export type ChecklistVehicle = VehicleCore & {
  vehicleClass?: N<string>; vehicleType?: N<string>; packageName?: N<string>; equipment?: N<string>;
  legalPlate?: N<string>; legalVin?: N<string>; legalLien?: N<string>; legalRegisteredToCompany?: N<boolean>; legalOwnerConsent?: N<boolean>;
  damageRecord?: N<string>; damageNote?: N<string>; tramerAmount?: N<number>; warrantyStatus?: N<string>; warrantyUntil?: N<string>; warrantyKm?: N<number>;
};

/**
 * Kontrol listesi maddesi. Eksik her madde yayını engeller (kontrol sunucuda, durum makinesinde de yapılır).
 * - LEGAL: Motorlu Kara Taşıtlarının Ticareti Hakkında Yönetmelik (RG 27.08.2024) m.20/2 ve m.21/1-a ilan bilgileri.
 * - RULE: Mir Motors yayın kuralı (mevzuatta ayrı ilan alanı olarak sayılmaz).
 * `step`: eksik bilginin girildiği sihirbaz adımı (1 bilgiler · 2 kaporta/hasar/yasal · 3 medya).
 * `reason`: eksikse kullanıcıya gösterilen neden ("İlan yayımlanamıyor: …").
 */
export type CheckItem = { key: string; label: string; ok: boolean; group: "LEGAL" | "RULE"; step: 1 | 2 | 3; detail?: string; reason: string };

/** Hasar kaydı maddesi: "Yok" yeterli; "Var" ise niteliği (açıklama) gerekir. Tramer tutarı tek başına nitelik sayılmaz. */
function damageReason(v: ChecklistVehicle): string | null {
  if (v.damageRecord === "NONE") return null;
  if (v.damageRecord && DAMAGE_EXISTS.includes(v.damageRecord)) return empty(v.damageNote?.trim()) ? "Hasar kaydının niteliği belirtilmedi." : null;
  return "Hasar kaydı bilgisi girilmedi.";
}

function lienReason(v: ChecklistVehicle): string | null {
  if (v.legalLien === "NONE" || v.legalLien === "EXISTS") return null;
  return "Rehin/haciz durumu girilmedi.";
}

/** m.20/2-h yalnızca garantisi devam eden araç için kalan süre ve km ister. */
function warrantyReason(v: ChecklistVehicle): string | null {
  if (v.warrantyStatus === "NONE") return null;
  if (v.warrantyStatus === "ACTIVE") {
    const miss = [empty(v.warrantyUntil) && "bitiş tarihi", empty(v.warrantyKm) && "bitiş kilometresi"].filter(Boolean);
    return miss.length ? `Garanti devam ediyor; kalan garantinin ${miss.join(" ve ")} girilmedi.` : null;
  }
  return "Garanti durumu girilmedi.";
}

export function publishChecklist(input: {
  v: ChecklistVehicle; company: CompanyInfo; photoCount: number; staffParts: PartMap; reportParts: PartMap; reviewBlockers: string[];
}): CheckItem[] {
  const { v, company, photoCount, staffParts, reportParts, reviewBlockers } = input;
  const unknownParts = BODY_PART_KEYS.filter((k) => staffParts[k] === "UNKNOWN");
  const conflicts = partConflicts(staffParts, reportParts);
  let equipment: unknown[] = [];
  try { equipment = JSON.parse(v.equipment ?? "[]"); } catch { /* bozuk kayıt = boş */ }
  const damage = damageReason(v), lien = lienReason(v), warranty = warrantyReason(v);
  // Tip: ruhsattaki tip ya da ilandaki model (ör. "320i M Sport"; sahibinden'deki "Model" alanı gibi) yeterli.
  const classTypeMissing = [empty(v.vehicleClass) && "cinsi", empty(v.vehicleType) && empty(v.packageName) && "tipi"].filter(Boolean);
  const L = (key: string, label: string, ok: boolean, step: 1 | 2 | 3, reason: string, detail?: string): CheckItem => ({ key, label, ok, group: "LEGAL", step, reason, detail });
  const R = (key: string, label: string, ok: boolean, step: 1 | 2 | 3, reason: string, detail?: string): CheckItem => ({ key, label, ok, group: "RULE", step, reason, detail });
  return [
    // Mevzuat (m.21/1-a: işletme bilgileri; m.20/2 a–h: araç bilgileri)
    L("companyTitle", "İşletmenin resmî adı / ticaret unvanı", !empty(company.title), 1, "İşletmenin resmî unvanı girilmedi (CRM > Ayarlar).", "CRM > Ayarlar (yönetici bir kez girer)"),
    L("companyAuth", "İkinci el taşıt yetki belgesi no", !empty(company.authorizationNo), 1, "Yetki belgesi numarası girilmedi (CRM > Ayarlar).", "CRM > Ayarlar (yönetici bir kez girer)"),
    L("brandModel", "Marka ve ticari ad", !empty(v.brand) && !empty(v.model), 1, "Marka veya seri eksik."),
    L("classType", "Araç cinsi ve tipi", classTypeMissing.length === 0, 1, `Aracın ${classTypeMissing.join(" ve ")} eksik.`, "Cinsi (ör. Otomobil) ve modeli (ör. 320i M Sport)"),
    L("year", "Model yılı", !empty(v.year), 1, "Model yılı eksik."),
    L("equipment", "Donanım ve aksesuar bilgileri", equipment.length > 0, 1, "Donanım ve aksesuar bilgisi girilmedi."),
    L("vin", "Şasi numarasının son 6 hanesi", !empty(v.legalVin), 1, "Şasi numarasının son 6 hanesi eksik."),
    L("plate", "Plaka", !empty(v.legalPlate), 1, "Plaka eksik."),
    L("fuel", "Yakıt türü", !empty(v.fuel), 1, "Yakıt türü eksik."),
    L("km", "Kilometre", !empty(v.km), 1, "Kilometre eksik."),
    L("price", "Satış fiyatı", !!v.price && v.price > 0, 1, "Satış fiyatı eksik veya geçersiz."),
    L("parts", "Boyalı ve değişen parçalar (13 parçanın tümü)", unknownParts.length === 0, 2,
      `Kaporta durumu bilinmeyen parça var: ${unknownParts.map((k) => BODY_PART_LABELS[k]).join(", ")}.`,
      unknownParts.length ? `Bilinmiyor: ${unknownParts.map((k) => BODY_PART_LABELS[k]).join(", ")}` : undefined),
    L("damage", "Hasar kaydı ve niteliği", !damage, 2, damage ?? "", "\"Bilgi girilmedi\" ≠ \"Yok\"; kayıt varsa niteliği açıklanır (tramer tutarı ayrıca zorunlu değildir)"),
    L("lien", "Rehin, haciz gibi şerhler", !lien, 2, lien ?? "", "\"Bilgi girilmedi\" ≠ \"Yok\""),
    L("warranty", "Kalan üretici/ithalatçı garantisi", !warranty, 2, warranty ?? "", "Devam etmiyorsa \"Devam etmiyor\"; devam ediyorsa bitiş tarihi ve km"),
    // Mir Motors kuralları
    R("photos", "En az 1 gerçek araç fotoğrafı", photoCount > 0, 3, "Araç fotoğrafı yüklenmedi."),
    R("transmission", "Vites", !empty(v.transmission), 1, "Vites bilgisi eksik."),
    R("bodyType", "Kasa tipi", !empty(v.bodyType), 1, "Kasa tipi eksik.", "Sedan, Hatchback, SUV…"),
    R("review", "Belge kontrolü ve AI bilgilerinin personel onayı", reviewBlockers.length === 0, 1,
      `Belge kontrolü tamamlanmadı: ${reviewBlockers.join(" · ")}.`, reviewBlockers.join(" · ") || undefined),
    R("authority", "Tescil sahibi / satış yetkisi", v.legalRegisteredToCompany === true || v.legalOwnerConsent === true, 2,
      "Araç işletme adına tescilli değil ve araç sahibinin satış/ilan izni işaretlenmedi.", "İşletme adına tescilli veya araç sahibinden satış/ilan izni alındı"),
    R("partConflicts", "Kaporta: personel beyanı ile ekspertiz uyumlu", conflicts.length === 0, 2,
      `Kaporta beyanı ekspertiz raporuyla çelişiyor: ${conflicts.map((k) => BODY_PART_LABELS[k]).join(", ")}.`,
      conflicts.length ? `Çelişen: ${conflicts.map((k) => BODY_PART_LABELS[k]).join(", ")}` : undefined),
  ];
}

/** Yayını engelleyen (eksik) maddeler. */
export const publishBlockers = (items: CheckItem[]) => items.filter((i) => !i.ok);

/** Yayın engeli mesajı: her eksik madde için "İlan yayımlanamıyor: …". */
export const blockerMessage = (blockers: CheckItem[]) => blockers.map((b) => `İlan yayımlanamıyor: ${b.reason}`).join("\n");

/** Yayındaki ilanda düzenlemeyle bozulmaması gereken araç bilgisi maddeleri (işletme, fotoğraf, kaporta ayrı yönetilir). */
export const LISTING_FIELD_KEYS = ["brandModel", "classType", "year", "equipment", "vin", "plate", "fuel", "km", "price", "damage", "lien", "warranty", "transmission", "bodyType", "authority"];

export const DAMAGE_RECORD_LABELS: Record<string, string> = {
  NONE: "Hasar kaydı yok",
  MINOR: "Hasar kaydı var",
  HEAVY: "Ağır hasar kayıtlı",
};
export const LIEN_LABELS: Record<string, string> = { NONE: "Rehin / haciz yok", EXISTS: "Rehin / haciz var" };

/** Garanti metni (müşteri sitesi): yapılandırılmış alan yoksa eski serbest metin, o da yoksa null. */
export function warrantyText(v: { warrantyStatus?: N<string>; warrantyUntil?: N<string>; warrantyKm?: N<number>; legalWarranty?: N<string> }): string | null {
  if (v.warrantyStatus === "NONE") return "Üretici / ithalatçı garantisi devam etmiyor";
  if (v.warrantyStatus === "ACTIVE") {
    const until = v.warrantyUntil ? new Intl.DateTimeFormat("tr-TR").format(new Date(v.warrantyUntil)) : null;
    const km = v.warrantyKm ? `${new Intl.NumberFormat("tr-TR").format(v.warrantyKm)} km` : null;
    return `Garanti devam ediyor${until || km ? `: ${[until && `${until} tarihine`, km && `${km}'ye`].filter(Boolean).join(" veya ")} kadar` : ""}`;
  }
  return v.legalWarranty ?? null;
}

/** Galerinin ilan numarası: araç oluşturulurken kimliğinden otomatik verilir, değişmez (resmî bir numara değildir). */
export const autoListingNo = (vehicleId: string) => `MM-${vehicleId.slice(-6).toUpperCase()}`;

/** Şasi numarasının yalnızca son 6 hanesi saklanır ve gösterilir. */
export const VIN_LAST6 = /^[A-HJ-NPR-Z0-9]{6}$/;
