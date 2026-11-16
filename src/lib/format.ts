// "/demo-cars/..." statik seed görselleri olduğu gibi döner; diğerleri /media rotasından servis edilir.
export const mediaUrl = (rel: string | null | undefined) => (rel ? (rel.startsWith("/") ? rel : `/media/${rel}`) : null);

/** Taslakta eksik olabilen bilgiler "girilmedi" olarak gösterilir (0 veya uydurma değer yazılmaz). */
export const formatPrice = (n: number | null | undefined) => (n == null ? "Fiyat girilmedi" : `${new Intl.NumberFormat("tr-TR").format(n)} TL`);
export const formatKm = (n: number | null | undefined) => (n == null ? "Km girilmedi" : `${new Intl.NumberFormat("tr-TR").format(n)} km`);
export const vehicleTitle = (v: { brand: string | null; model: string | null; packageName?: string | null }) =>
  [v.brand ?? "Marka girilmedi", v.model, v.packageName].filter(Boolean).join(" ");
export const formatDateTime = (d: Date | string) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(d));

export function parseEquipment(json: string | null | undefined): string[] {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
