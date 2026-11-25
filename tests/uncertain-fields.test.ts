import { describe, expect, it } from "vitest";
import { documentSimulation } from "@/lib/ai/document-read";
import { mergeReadings, type RawRead } from "@/lib/ai/document-sanitize";

// Ruhsat okuması: AI'nın emin olmadığı alanlar ve okunamayan ruhsat alanlarının nedenleri personele gösterilir.
describe("emin olunamayan ve okunamayan alanlar", () => {
  it("simülasyonda emin olunamayan alan araç alan adıyla ve etiketle döner", () => {
    const read = documentSimulation(["RUHSAT"]);
    expect(read.uncertain).toEqual([{ field: "engineCc", label: "Motor hacmi", reason: expect.stringContaining("simülasyon") }]);
  });

  it("ruhsatta boş kalan isteğe bağlı alan nedeniyle listelenir; AI'nın ham alan adı eşlenir", () => {
    const base = documentSimulation(["RUHSAT"]);
    expect(base.missing.find((m) => m.field === "vehicleType")?.reason).toBe("Ruhsatta okunamadı");

    const raw = {
      ruhsat: {
        brand: "FIAT", model: "EGEA", packageName: null, vehicleType: null, tradeName: null, inspectionUntil: null, year: 2019,
        firstRegistrationDate: null, vehicleClass: "OTOMOBİL", color: null, engineCc: 1368, enginePowerKw: null, enginePowerHp: 95,
        fuelText: "BENZİNLİ", seats: 5, plate: "34ABC123", vin: null, vinLabel: null, vinLast6Visible: null, ownerType: "UNKNOWN",
      },
      ekspertiz: null,
      sources: [],
      unreadable: [{ field: "color", document: "RUHSAT", reason: "parlama" }],
      // plate okundu ama emin değil → listede; color boş olduğu için "emin değil" listesine girmez (zaten eksik)
      uncertain: [{ field: "plate", document: "RUHSAT", reason: "son hane silik" }, { field: "color", document: "RUHSAT", reason: "x" }],
      quality: [],
      warnings: [],
    } as unknown as RawRead;
    const read = mergeReadings(raw);
    expect(read.missing.find((m) => m.field === "color")).toEqual({ field: "color", label: "Renk", reason: "parlama" });
    expect(read.missing.find((m) => m.field === "packageName")?.reason).toBe("Ruhsatta okunamadı");
    expect(read.uncertain).toEqual([{ field: "plate", label: "Plaka", reason: "son hane silik" }]);
  });

  it("AI'nın döndürdüğü bilinmeyen / nesne anahtarı alan adları yok sayılır", () => {
    const base = documentSimulation(["RUHSAT"]);
    void base;
    const raw = {
      ruhsat: null, ekspertiz: null, sources: [], unreadable: [], quality: [], warnings: [],
      uncertain: [{ field: "constructor", document: "RUHSAT", reason: "x" }, { field: "__proto__", document: "RUHSAT", reason: "x" }, { field: "toString", document: "RUHSAT", reason: "x" }],
    } as unknown as RawRead;
    expect(mergeReadings(raw).uncertain).toEqual([]);
  });

  it("eski okumalarda (uncertain alanı yok) hata vermez", () => {
    const raw = { ...documentSimulation(["RUHSAT"]) } as unknown;
    expect(raw).toBeTruthy();
    const r = mergeReadings({ ruhsat: null, ekspertiz: null, sources: [], unreadable: [], quality: [], warnings: [] } as RawRead);
    expect(r.uncertain).toEqual([]);
  });
});
