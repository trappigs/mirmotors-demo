import { z } from "zod";
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS } from "./constants";
import { DAMAGE_RECORDS, LIEN_STATES, VIN_LAST6, WARRANTY_STATES } from "./listing-rules";

const blank = (v: unknown) => v === "" || v === null || v === undefined || (typeof v === "string" && v.trim() === "");
const optText = (max = 2000) =>
  z.preprocess((v) => (blank(v) ? null : v), z.string().trim().max(max).nullable().optional());
const optInt = (min: number, max: number, message = "Geçersiz sayı") =>
  z.preprocess(
    (v) => (blank(v) ? null : Number(String(v).replace(/\./g, ""))),
    z.number({ message }).int(message).min(min, message).max(max, message).nullable().optional(),
  );
const optEnum = (values: readonly string[], message: string) =>
  z.preprocess((v) => (blank(v) ? null : v), z.enum(values as [string, ...string[]], { message }).nullable().optional());
const optBool = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v === true || v === "true"), z.boolean().nullable().optional());

/**
 * Araç formu. Taslak eksik bilgiyle kaydedilebilir (ör. AI videodan bulamadıysa); yayımlama için zorunlu
 * alanlar durum makinesinde denetlenir (src/lib/listing-rules.ts → missingVehicleFields).
 */
export const vehicleInputSchema = z.object({
  brand: optText(60),
  model: optText(60),
  packageName: optText(120),
  year: optInt(1950, new Date().getFullYear() + 1, "Geçersiz model yılı"),
  km: optInt(0, 2_000_000, "Geçersiz kilometre"),
  price: optInt(1, 1_000_000_000, "Geçersiz fiyat"),
  // Gönderilmezse dokunulmaz (kısmi düzenleme takas bilgisini silmez); "" = belirtilmedi.
  tradeIn: z.preprocess((v) => (v === undefined ? undefined : v === "" || v === null ? null : v === true || v === "true"), z.boolean().nullable().optional()),
  fuel: optEnum(FUEL_TYPES, "Yakıt türü seçin"),
  transmission: optEnum(TRANSMISSIONS, "Vites türü seçin"),
  bodyType: optEnum(BODY_TYPES, "Kasa tipi seçin"),
  color: optText(60),
  enginePower: optInt(1, 2000, "Geçersiz motor gücü"),
  engineCc: optInt(1, 10000, "Geçersiz motor hacmi"),
  drivetrain: optText(60),
  description: optText(4000),
  // Gönderilmezse dokunulmaz (kısmi düzenleme donanım listesini silmez); oluşturmada veritabanı varsayılanı "[]".
  equipment: z.array(z.string().trim().min(1).max(80)).max(80).optional(),
  damageNote: optText(2000),
  damageRecord: optEnum(DAMAGE_RECORDS, "Hasar kaydı durumunu seçin"),
  tramerAmount: optInt(0, 100_000_000, "Geçersiz tramer tutarı"),
  expertiseSummary: optText(4000),
  // legalListingNo formdan alınmaz: sistem otomatik verir (listing-rules → autoListingNo).
  legalAuthorizationNo: optText(60),
  legalPlate: optText(20),
  legalVin: z.preprocess(
    (v) => (blank(v) ? null : String(v).trim().toUpperCase()),
    z.string().regex(VIN_LAST6, "Şasi no için yalnızca son 6 haneyi girin").nullable().optional(),
  ),
  legalLien: optEnum(LIEN_STATES, "Rehin / haciz durumunu seçin"),
  legalWarranty: optText(200),
  vehicleClass: optText(60),
  vehicleType: optText(120),
  inspectionUntil: z.preprocess((v) => (blank(v) ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Muayene tarihini seçin").nullable().optional()),
  // Ruhsattaki ilk tescil tarihi (B), ruhsattaki biçimiyle (GG/AA/YYYY) metin olarak saklanır. Biçim zorlanmaz:
  // daha önce AI'nın farklı yazdığı kayıtlar düzenlenirken kayıt engellenmesin.
  firstRegistration: optText(20),
  seats: optInt(1, 99, "Geçersiz koltuk sayısı"),
  stockCode: optText(40),
  warrantyStatus: optEnum(WARRANTY_STATES, "Garanti durumunu seçin"),
  warrantyUntil: z.preprocess((v) => (blank(v) ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Garanti bitiş tarihini seçin").nullable().optional()),
  warrantyKm: optInt(0, 2_000_000, "Geçersiz garanti kilometresi"),
  legalRegisteredToCompany: optBool,
  legalOwnerConsent: z.boolean().optional(),
  // AI taslağından gelen kayıtlarda personel onayı zorunludur.
  aiDraftMode: z.enum(["LIVE", "SIMULATION"]).nullable().optional(),
  aiDraftJson: optText(20000),
  // AI akışında yüklenen analiz videosu (storage/public/drafts/...) araca bağlanır; müşteriye otomatik açılmaz.
  draftVideoPath: z.string().regex(/^drafts\/[a-f0-9-]+\.(mp4|webm|mov)$/).nullable().optional(),
  aiReviewed: z.boolean().optional(),
  // Otomatik taslak: tarayıcının ürettiği tek kullanımlık anahtar (aynı giriş iki taslak oluşturmaz).
  createKey: z.string().regex(/^[a-f0-9-]{20,64}$/i).optional(),
  // Stokta aynı plakalı araç varken personel "Yine de yeni kayıt oluştur" dediyse.
  plateDuplicateAck: z.boolean().optional(),
  // Eşzamanlı düzenleme: istemcinin gördüğü kayıt sürümü (updatedAt). Arada başka çalışan değiştirdiyse kayıt reddedilir.
  baseVersion: z.string().max(40).optional(),
  // "Benim değişikliğimi kaydet": personel uyarıyı gördü ve kendi değerlerini kaydetmeyi seçti.
  overwrite: z.boolean().optional(),
});

export type VehicleInput = z.infer<typeof vehicleInputSchema>;

export function toVehicleData(input: VehicleInput) {
  const { equipment, draftVideoPath: _v, aiReviewed: _r, createKey: _k, plateDuplicateAck: _p, baseVersion: _b, overwrite: _o, ...rest } = input;
  void _v; void _r; void _k; void _p; void _b; void _o;
  return { ...rest, ...(equipment ? { equipment: JSON.stringify(equipment) } : {}) };
}

export function checkAiVerification(input: VehicleInput): string | null {
  if (!input.aiDraftMode) return null;
  if (!input.aiReviewed) {
    return "AI taslağından araç oluşturmak için AI'nın bulduğu bilgileri kontrol ettiğinizi onaylayın.";
  }
  return null;
}
