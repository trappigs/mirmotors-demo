// Son kontrol ekranındaki "Düzelt" bağlantıları: her eksik madde sihirbazın ilgili adımına ve o adımdaki alana (#id) götürür.
// Alan kimlikleri VehicleForm (input id = alan adı), BodyPartsEditor (#kaporta) ve sihirbaz sayfasındaki bölümlerle aynıdır.

export type FixTarget = { step: 1 | 2 | 3 | 4; anchor: string; href?: string };

const SETTINGS: FixTarget = { step: 4, anchor: "", href: "/crm/ayarlar" };

/** Yayın kontrol listesi maddesi (listing-rules → CheckItem.key) → düzeltileceği yer. */
const CHECK_TARGETS: Record<string, FixTarget> = {
  companyTitle: SETTINGS,
  companyAuth: SETTINGS,
  brandModel: { step: 1, anchor: "brand" },
  classType: { step: 1, anchor: "vehicleClass" },
  year: { step: 1, anchor: "year" },
  equipment: { step: 1, anchor: "equipment" },
  vin: { step: 1, anchor: "legalVin" },
  plate: { step: 1, anchor: "legalPlate" },
  fuel: { step: 1, anchor: "fuel" },
  km: { step: 1, anchor: "km" },
  price: { step: 1, anchor: "price" },
  transmission: { step: 1, anchor: "transmission" },
  bodyType: { step: 1, anchor: "bodyType" },
  parts: { step: 2, anchor: "kaporta" },
  partConflicts: { step: 2, anchor: "kaporta" },
  damage: { step: 2, anchor: "damageRecord" },
  lien: { step: 2, anchor: "legalLien" },
  warranty: { step: 2, anchor: "warrantyStatus" },
  authority: { step: 2, anchor: "legalRegisteredToCompany" },
  photos: { step: 3, anchor: "fotograflar" },
  review: { step: 4, anchor: "belge-kontrolu" },
};

/** Belge okumasında okunamayan / belirsiz alan (AI alan adı) → form alanı. */
const AI_FIELD_ANCHORS: Record<string, [1 | 2, string]> = {
  brand: [1, "brand"], model: [1, "model"], packageName: [1, "packageName"], vehicleClass: [1, "vehicleClass"], vehicleType: [1, "vehicleType"],
  year: [1, "year"], km: [1, "km"], price: [1, "price"], color: [1, "color"], plate: [1, "legalPlate"], vinLast6: [1, "legalVin"],
  engineCc: [1, "engineCc"], enginePowerHp: [1, "enginePower"], stockCode: [2, "stockCode"], fuel: [1, "fuel"], transmission: [1, "transmission"],
  bodyType: [1, "bodyType"], drivetrain: [1, "drivetrain"], equipment: [1, "equipment"],
  damageRecord: [2, "damageRecord"], damageNote: [2, "damageNote"], tramerAmount: [2, "tramerAmount"], lien: [2, "legalLien"],
  warranty: [2, "warrantyStatus"], warrantyUntil: [2, "warrantyUntil"], warrantyKm: [2, "warrantyKm"], authority: [2, "legalRegisteredToCompany"],
};

export function checkTarget(key: string): FixTarget {
  return CHECK_TARGETS[key] ?? { step: 1, anchor: "" };
}

export function aiFieldTarget(field: string): FixTarget {
  if (field.startsWith("part:")) return { step: 2, anchor: "kaporta" };
  const t = AI_FIELD_ANCHORS[field];
  return t ? { step: t[0], anchor: t[1] } : { step: 1, anchor: "" };
}

export const fixHref = (vehicleId: string, t: FixTarget) =>
  t.href ?? `/crm/vehicles/${vehicleId}/tamamla?adim=${t.step}${t.anchor ? `#${t.anchor}` : ""}`;

/** AI'nın okuyamadığı alan sonradan personelce dolduruldu mu? (araç sütunu → değer) */
export function aiFieldFilled(field: string, v: Record<string, unknown>, parts: Record<string, string>): boolean {
  if (field.startsWith("part:")) return (parts[field.slice(5)] ?? "UNKNOWN") !== "UNKNOWN";
  const column: Record<string, string> = {
    plate: "legalPlate", vinLast6: "legalVin", enginePowerHp: "enginePower", lien: "legalLien", warranty: "warrantyStatus",
  };
  if (field === "authority") return v.legalRegisteredToCompany === true || v.legalOwnerConsent === true;
  if (field === "equipment") return typeof v.equipment === "string" && v.equipment !== "[]" && v.equipment !== "";
  const val = v[column[field] ?? field];
  return val !== null && val !== undefined && val !== "";
}
