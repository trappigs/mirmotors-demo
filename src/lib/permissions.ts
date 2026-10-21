// Araç bilgisi ve medya değişiklik yetkisi. Durum geçişlerindeki sahiplik kuralıyla aynıdır:
// opsiyonlu / satış sürecindeki araçta yalnızca opsiyon sahibi veya yönetici değişiklik yapabilir.
type Actor = { id: string; role: "ADMIN" | "SALES" };
type VehicleRef = { status: string; optionedById: string | null };

export function mediaChangeBlock(vehicle: VehicleRef, actor: Actor): string | null {
  if (vehicle.status === "SOLD") return "Satılmış aracın kayıtları korunur; değişiklik yapılamaz.";
  if ((vehicle.status === "OPTIONED" || vehicle.status === "SALE_PENDING") && actor.role !== "ADMIN" && vehicle.optionedById !== actor.id) {
    return "Bu araç başka bir çalışan tarafından opsiyonlanmış; yalnızca opsiyon sahibi veya yönetici değişiklik yapabilir.";
  }
  return null;
}

/** Araç bilgileri (form) için: satış sürecindeki/satılmış araç düzenlenemez, opsiyonluda sahiplik gerekir. */
export function canEditDetails(vehicle: VehicleRef, actor: Actor): boolean {
  if (vehicle.status === "DRAFT" || vehicle.status === "AVAILABLE") return true;
  if (vehicle.status === "OPTIONED") return actor.role === "ADMIN" || vehicle.optionedById === actor.id;
  return false;
}
