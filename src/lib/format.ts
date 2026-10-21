export const mediaUrl = (rel: string | null | undefined) => (rel ? `/media/${rel}` : null);

export const formatPrice = (n: number) => `${new Intl.NumberFormat("tr-TR").format(n)} TL`;
export const formatKm = (n: number) => `${new Intl.NumberFormat("tr-TR").format(n)} km`;
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
