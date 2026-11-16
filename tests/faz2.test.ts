import { describe, expect, it } from "vitest";
import { mergeReadings, type RawRead } from "@/lib/ai/document-sanitize";
import { vehicleInputSchema, toVehicleData } from "@/lib/vehicle-schema";
import { BRAND_MODELS, BODY_TYPES } from "@/lib/constants";

// Faz 2: ruhsat okuma (D.2 / D.3 ayrı saklanır), muayene tarihi, ondalıklı kW, katalog. Sentetik değerler (gerçek plaka/şasi değildir).
type R = NonNullable<RawRead["ruhsat"]>;
const ruhsat = (o: Partial<R> = {}): R => ({
  brand: "VOLKSWAGEN", model: "LT 35", packageName: "2.5 TDI", year: 2004, firstRegistrationDate: "03/05/2004", vehicleClass: "KAMYONET",
  color: "BEYAZ", engineCc: 2461, enginePowerKw: 80, enginePowerHp: null, fuelText: "DİZEL", seats: 3, plate: "00 TST 001",
  vin: null, vinLabel: null, vinLast6Visible: null, ownerType: "UNKNOWN", ...o,
});
const read = (r: R) => mergeReadings({ ruhsat: r, ekspertiz: null, sources: [], unreadable: [], quality: [], warnings: [] });

describe("ruhsat: tip (D.2) ve ticari ad (D.3)", () => {
  it("ruhsattaki tip ve ticari ad olduğu gibi ayrı saklanır; ilan için anlaşılır model ayrıdır", () => {
    const v = read(ruhsat({ vehicleType: "lt35 p.van h/r lwb 2.5 tdi 109", tradeName: "tstcd1" })).vehicle;
    expect(v).toMatchObject({ model: "LT 35", vehicleType: "LT35 P.VAN H/R LWB 2.5 TDI 109", tradeName: "TSTCD1" });
  });

  it("tip 'P.VAN' ise kasa Panelvan; cinsi 'KAMYONET' tek başına kasa belirlemez", () => {
    expect(read(ruhsat({ vehicleType: "LT35 P.VAN H/R LWB 2.5 TDI 109" })).vehicle.bodyType).toBe("Panelvan");
    expect(read(ruhsat({ vehicleType: "TRANSIT 350 L" })).vehicle.bodyType).toBeNull();
  });

  it("cinsi alanındaki kasa kodu açıklaması kasa tipine çevrilir, cinsi sade kalır", () => {
    const v = read(ruhsat({ vehicleClass: "OTOMOBİL (AA SEDAN)", vehicleType: "CLIO SYMBL ALIZE", tradeName: "CLIO SYMBL ALIZE" })).vehicle;
    expect(v).toMatchObject({ vehicleClass: "Otomobil", bodyType: "Sedan", vehicleType: "CLIO SYMBL ALIZE", tradeName: "CLIO SYMBL ALIZE" });
  });

  it("ondalıklı motor gücü (kW) beygire çevrilir", () => {
    expect(read(ruhsat({ enginePowerKw: 55.1 })).vehicle.enginePowerHp).toBe(75);
  });

  it("muayene tarihi yalnızca geçerli GG/AA/YYYY ise alınır (tahmin yok)", () => {
    expect(read(ruhsat({ inspectionUntil: "25/03/2026" })).vehicle.inspectionUntil).toBe("2026-03-25");
    expect(read(ruhsat({ inspectionUntil: "31/02/2026" })).vehicle.inspectionUntil).toBeNull();
    expect(read(ruhsat({ inspectionUntil: "2026" })).vehicle.inspectionUntil).toBeNull();
  });
});

describe("form ve katalog", () => {
  it("muayene tarihi isteğe bağlıdır; geçersiz biçim reddedilir", () => {
    expect(toVehicleData(vehicleInputSchema.parse({ inspectionUntil: "2026-03-25" }))).toEqual({ inspectionUntil: "2026-03-25" });
    expect(toVehicleData(vehicleInputSchema.parse({ inspectionUntil: "" }))).toEqual({ inspectionUntil: null });
    expect(() => vehicleInputSchema.parse({ inspectionUntil: "25.03.2026" })).toThrow();
  });

  it("sürüm bilgisi (eşzamanlı düzenleme) araç verisine yazılmaz", () => {
    expect(toVehicleData(vehicleInputSchema.parse({ price: 1000, baseVersion: new Date().toISOString(), overwrite: true }))).toEqual({ price: 1000 });
  });

  it("öneri listesi ticari araçları içerir; kasa tipleri ticari araçları kapsar", () => {
    expect(BRAND_MODELS.Volkswagen).toEqual(expect.arrayContaining(["LT", "Crafter", "Transporter", "Caddy"]));
    expect(BRAND_MODELS.Ford).toEqual(expect.arrayContaining(["Transit", "Transit Connect"]));
    expect(BRAND_MODELS.Renault).toEqual(expect.arrayContaining(["Clio Symbol", "Kangoo", "Master"]));
    expect(BODY_TYPES).toEqual(expect.arrayContaining(["Panelvan", "Kamyonet", "Minibüs"]));
    // Eski kayıtlar bozulmasın: önceki markalar listede kalır
    expect(Object.keys(BRAND_MODELS)).toEqual(expect.arrayContaining(["Range Rover", "Tesla", "Porsche"]));
  });
});
