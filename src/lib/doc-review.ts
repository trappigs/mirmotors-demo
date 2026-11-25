// Belgeden oluşturulan aracın inceleme durumu (Vehicle.docReview JSON). Saf fonksiyonlar: veritabanı içe aktarmaz.
// Personel bu listedeki her konuyu çözmeden araç "Kontrol Bekliyor" durumundan çıkamaz ve yayımlanamaz.

/** FORM: Mir Motors Araç Kontrol ve İlan Bilgi Formu (personel beyanı; resmî ekspertiz değildir). */
export type DocKind = "RUHSAT" | "EKSPERTIZ" | "FORM";
export const DOC_KIND_LABELS: Record<DocKind, string> = { RUHSAT: "Ruhsat", EKSPERTIZ: "Ekspertiz", FORM: "Kontrol formu" };
export type Identity = "SAME" | "REVIEW" | "DIFFERENT" | "SINGLE";

export type DocReview = {
  analysisIds: string[];
  /** SAME: güvenilir şasi eşleşmesi · REVIEW: doğrulanamadı / plaka farklı · DIFFERENT: şasi uyuşmuyor · SINGLE: tek belge türü */
  identity: Identity;
  identityNote: string;
  identityResolved: boolean;
  /**
   * ruhsat/ekspertiz: karşılaştırılan iki değer (birinci / ikinci kaynak). labels verilirse ekranda bu başlıklar kullanılır
   * (ör. "Araç kaydı" / "Yeni belge", "Ruhsat" / "Kontrol formu"). resolved: "RUHSAT" = birinci, "EKSPERTIZ" = ikinci kaynak seçildi.
   */
  conflicts: { field: ConflictField; label: string; ruhsat: string; ekspertiz: string; resolved: null | DocKind | "MANUAL"; labels?: [string, string] }[];
  aiFields: { field: string; label: string; value: string; document: DocKind; page: number | null; evidence: string; location: string | null }[];
  missing: { field: string; label: string; reason: string }[];
  /** AI'nın okuyup emin olamadığı alanlar (belge alan adıyla). Eski kayıtlarda yok. */
  uncertain?: { field: string; label: string; reason: string }[];
  stockDuplicates: { id: string; title: string; status: string; match: string }[];
  duplicatesAcknowledged: boolean;
  ownerCheckRequired: boolean;
  ownerChecked: boolean;
  aiConfirmed: boolean;
  warnings: string[];
  findings: { engine: string | null; mechanical: string | null; electrical: string | null; important: string[] };
};

/** Çelişkide personelin kaynak seçebildiği alanlar ve araç sütunları. */
export const CONFLICT_FIELDS = {
  plate: { label: "Plaka", column: "legalPlate" },
  vinLast6: { label: "Şasi no (son 6)", column: "legalVin" },
  brand: { label: "Marka", column: "brand" },
  model: { label: "Model", column: "model" },
  year: { label: "Model yılı", column: "year" },
  fuel: { label: "Yakıt", column: "fuel" },
  km: { label: "Kilometre", column: "km" },
  transmission: { label: "Vites", column: "transmission" },
  bodyType: { label: "Kasa tipi", column: "bodyType" },
} as const;
export type ConflictField = keyof typeof CONFLICT_FIELDS;

export function parseReview(json: string | null | undefined): DocReview | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as DocReview;
  } catch {
    return null;
  }
}

/** Yayını ve kontrol tamamlamayı engelleyen açık konular (insan okunur). */
export function reviewBlockers(r: DocReview | null): string[] {
  if (!r) return [];
  const out: string[] = [];
  if (r.identity === "DIFFERENT" && !r.identityResolved) out.push("Ruhsat ve ekspertiz farklı araçlara ait görünüyor: ekspertizi ayırın");
  if (r.identity === "REVIEW" && !r.identityResolved) out.push("Belgelerin aynı araca ait olduğunu doğrulayın");
  const open = r.conflicts.filter((c) => !c.resolved).length;
  if (open) out.push(`${open} çelişkili alan için doğru kaynağı seçin`);
  if (r.stockDuplicates.length && !r.duplicatesAcknowledged) out.push("Stokta aynı plaka/şasiye sahip araç uyarısını inceleyin");
  if (r.ownerCheckRequired && !r.ownerChecked) out.push("Tescil sahibini (işletme adına mı) elle kontrol edin");
  if (!r.aiConfirmed) out.push("AI'nın doldurduğu bilgileri kontrol ettiğinizi onaylayın");
  return out;
}

/** Çelişkili alanın seçilen kaynaktaki değerini araç sütununa çevirir. */
export function conflictValue(field: ConflictField, raw: string): string | number | null {
  if (field === "year" || field === "km") {
    const n = Number(raw);
    return Number.isInteger(n) ? n : null;
  }
  return raw || null;
}
