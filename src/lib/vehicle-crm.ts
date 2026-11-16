import "server-only";
import type { Vehicle } from "@prisma/client";
import type { VehicleFormValues } from "@/components/crm/VehicleForm";
import { toPartMap } from "./body-parts";
import { getCompanyInfo } from "./company";
import { parseReview, reviewBlockers } from "./doc-review";
import { parseEquipment } from "./format";
import { DAMAGE_RECORDS, LIEN_STATES, WARRANTY_STATES, knownState, publishChecklist, type CheckItem } from "./listing-rules";

const s = (v: string | number | boolean | null | undefined) => (v === null || v === undefined ? "" : String(v));

/** Araç kaydından form başlangıç değerleri (araç sayfası ve sihirbaz). */
export function formInitial(v: Vehicle): VehicleFormValues {
  return {
    brand: s(v.brand), model: s(v.model), packageName: s(v.packageName), year: s(v.year), km: s(v.km), price: s(v.price), tradeIn: s(v.tradeIn),
    fuel: s(v.fuel), transmission: s(v.transmission), bodyType: s(v.bodyType), color: s(v.color), enginePower: s(v.enginePower),
    engineCc: s(v.engineCc), drivetrain: s(v.drivetrain), description: s(v.description), equipment: parseEquipment(v.equipment),
    // Eski "sorgulanmadı / doğrulanamadı / bilinmiyor" değerleri formda "Bilgi girilmedi" olarak açılır.
    damageRecord: s(knownState(DAMAGE_RECORDS, v.damageRecord)), damageNote: s(v.damageNote), tramerAmount: s(v.tramerAmount),
    expertiseSummary: s(v.expertiseSummary), legalListingNo: s(v.legalListingNo), legalAuthorizationNo: s(v.legalAuthorizationNo),
    legalPlate: s(v.legalPlate), legalVin: s(v.legalVin), legalLien: s(knownState(LIEN_STATES, v.legalLien)), legalWarranty: s(v.legalWarranty),
    legalRegisteredToCompany: s(v.legalRegisteredToCompany), legalOwnerConsent: v.legalOwnerConsent,
    vehicleClass: s(v.vehicleClass), vehicleType: s(v.vehicleType), stockCode: s(v.stockCode), warrantyStatus: s(knownState(WARRANTY_STATES, v.warrantyStatus)), warrantyUntil: s(v.warrantyUntil), warrantyKm: s(v.warrantyKm), inspectionUntil: s(v.inspectionUntil),
  };
}

/** Yayın kontrol listesi (CRM ekranları için; yayımlama aynı kuralları durum makinesinde uygular). */
export async function vehicleChecklist(v: Vehicle & { photos: unknown[]; parts: { part: string; state: string; reportState: string }[] }): Promise<{ items: CheckItem[] }> {
  const items = publishChecklist({
    v,
    company: await getCompanyInfo(),
    photoCount: v.photos.length,
    staffParts: toPartMap(v.parts),
    reportParts: toPartMap(v.parts, "reportState"),
    reviewBlockers: reviewBlockers(parseReview(v.docReview)),
  });
  return { items };
}
