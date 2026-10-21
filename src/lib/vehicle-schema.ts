import { z } from "zod";
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS } from "./constants";

const optText = (max = 2000) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional());
const optInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(min).max(max).nullable().optional(),
  );

export const vehicleInputSchema = z.object({
  brand: z.string().trim().min(1, "Marka zorunlu").max(60),
  model: z.string().trim().min(1, "Model zorunlu").max(60),
  packageName: optText(120),
  year: z.coerce.number().int().min(1950, "Geçersiz yıl").max(new Date().getFullYear() + 1, "Geçersiz yıl"),
  km: z.coerce.number().int().min(0, "Kilometre negatif olamaz").max(2_000_000),
  price: z.coerce.number().int().min(1, "Fiyat zorunlu").max(1_000_000_000),
  fuel: z.enum(FUEL_TYPES as [string, ...string[]], { message: "Yakıt türü seçin" }),
  transmission: z.enum(TRANSMISSIONS as [string, ...string[]], { message: "Vites türü seçin" }),
  bodyType: z.enum(BODY_TYPES as [string, ...string[]], { message: "Kasa tipi seçin" }),
  color: optText(60),
  enginePower: optInt(1, 2000),
  engineCc: optInt(1, 10000),
  drivetrain: optText(60),
  description: optText(4000),
  equipment: z.array(z.string().trim().min(1).max(80)).max(80).default([]),
  paintedParts: optText(1000),
  changedParts: optText(1000),
  damageNote: optText(2000),
  tramerAmount: optInt(0, 100_000_000),
  expertiseSummary: optText(4000),
  legalListingNo: optText(60),
  legalAuthorizationNo: optText(60),
  legalPlate: optText(20),
  legalVin: optText(30),
  legalOwnerConsent: z.boolean().optional(),
  // AI taslağından gelen kayıtlarda insan doğrulaması zorunludur.
  aiDraftMode: z.enum(["LIVE", "SIMULATION"]).nullable().optional(),
  aiDraftJson: optText(20000),
  // AI akışında yüklenen video (storage/public/drafts/...) araca bağlanır.
  draftVideoPath: z.string().regex(/^drafts\/[a-f0-9-]+\.(mp4|webm|mov)$/).nullable().optional(),
  verifiedPrice: z.boolean().optional(),
  verifiedDamage: z.boolean().optional(),
  verifiedExpertise: z.boolean().optional(),
});

export type VehicleInput = z.infer<typeof vehicleInputSchema>;

export function toVehicleData(input: VehicleInput) {
  const { equipment, draftVideoPath: _v, verifiedPrice: _p, verifiedDamage: _d, verifiedExpertise: _e, ...rest } = input;
  void _v; void _p; void _d; void _e;
  return { ...rest, equipment: JSON.stringify(equipment) };
}

export function checkAiVerification(input: VehicleInput): string | null {
  if (!input.aiDraftMode) return null;
  if (!input.verifiedPrice || !input.verifiedDamage || !input.verifiedExpertise) {
    return "AI taslağından oluşturulan araçlarda fiyat, hasar ve ekspertiz bilgileri personel tarafından doğrulanmalıdır.";
  }
  return null;
}
