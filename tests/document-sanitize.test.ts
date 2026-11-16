import { describe, expect, it } from "vitest";
import { mapFuel, mapTransmission, mergeReadings, resolveVin, vinLabelOk, type RawRead } from "@/lib/ai/document-sanitize";
import { mapBodyType, partsFromDiagram, visibleSide } from "@/lib/ai/document-sanitize";
import { reviewBlockers, type DocReview } from "@/lib/doc-review";
import { BODY_PART_KEYS, type BodyPartKey, type PartState } from "@/lib/body-parts";

const parts = (over: Partial<Record<BodyPartKey, PartState>> = {}) =>
  ({ ...Object.fromEntries(BODY_PART_KEYS.map((k) => [k, "UNKNOWN"])), ...over }) as Record<BodyPartKey, PartState>;

type R = NonNullable<RawRead["ruhsat"]>;
type E = NonNullable<RawRead["ekspertiz"]>;
const ruhsat = (o: Partial<R> = {}): R => ({
  brand: "RENAULT", model: "CLIO", packageName: "1.4 16V", year: 2006, firstRegistrationDate: "14/04/2006", vehicleClass: "OTOMOBİL",
  color: "GRİ (METALİK)", engineCc: 1390, enginePowerKw: 72, enginePowerHp: null, fuelText: "BENZİN-LPG", seats: 5, plate: "00 TST 782",
  vin: "VF1LB17C500000001", vinLabel: "(E) ŞASE NO", vinLast6Visible: null, ownerType: "COMPANY", ...o,
});
const ekspertiz = (o: Partial<E> = {}): E => ({
  brand: "Renault", model: "Clio", year: 2006, plate: "00TST782", vin: "VF1LB17C500000001", vinLabel: "Şasi Numarası", vinLast6Visible: null,
  km: 54839, fuelText: "Benzin-Lpg", transmissionText: "Manuel", reportDate: "2021-03-08", company: "Örnek Ekspertiz",
  legend: [{ text: "Turuncu = Lokal boya", state: "LOCAL_PAINT" }], parts: parts({ TRUNK: "LOCAL_PAINT", RIGHT_REAR_FENDER: "PAINTED" }),
  damageNote: "Alıcı 12345678901; arka panel onarımlı", engineFindings: "Kompresyon normal", mechanicalNotes: null, electricalNotes: null,
  tramerAmountTl: null, importantWarnings: [], ...o,
});
const raw = (r: R | null, e: E | null): RawRead => ({ ruhsat: r, ekspertiz: e, sources: [], unreadable: [], quality: [], warnings: [] });

describe("şasi doğrulaması", () => {
  it("yalnızca Şase No etiketinden okunan 17 karakterlik geçerli şasiyi kabul eder", () => {
    expect(resolveVin("VF1LB17C500000001", "(E) ŞASE NO", null)).toMatchObject({ last6: "000001", partial: false });
    expect(vinLabelOk("(P.5) MOTOR NO")).toBe(false);
    expect(resolveVin("55266963XY", "(P.5) MOTOR NO", null).last6).toBeNull(); // motor no şasi sanılmaz
    expect(resolveVin("VF1LB17C500000001", "(P.5) MOTOR NO", null).last6).toBeNull(); // biçim doğru ama etiket yanlış
    expect(resolveVin("VF1LB17C53419433O", "(E) ŞASE NO", null).last6).toBeNull(); // O harfi şaside geçersiz
  });

  it("yalnızca son 6 hane görülebildiyse kısmi olarak tutar, tam şasi gibi davranmaz", () => {
    expect(resolveVin(null, "(E) ŞASE NO", "470359")).toMatchObject({ last6: "470359", partial: true });
    const r = mergeReadings(raw(ruhsat({ vin: null, vinLast6Visible: "000001" }), null));
    expect(r.vehicle.vinPartial).toBe(true);
    expect(r.warnings.join(" ")).toMatch(/son 6 hane/);
  });
});

describe("aynı araç kontrolü ve birleştirme", () => {
  it("tam şasi eşleşmesinde birleştirir: kW→hp, yakıt/vites, parçalar, bulgular; kişisel veri maskelenir", () => {
    const r = mergeReadings(raw(ruhsat(), ekspertiz()));
    expect(r.identity).toBe("SAME");
    expect(r.vehicle).toMatchObject({ brand: "Renault", model: "Clio", year: 2006, km: 54839, plate: "00TST782", vinLast6: "000001", enginePowerHp: 98, fuel: "LPG", transmission: "Manuel", ownerIsCompany: true, seats: 5, vehicleClass: "Otomobil" });
    expect(r.parts.TRUNK).toBe("LOCAL_PAINT");
    expect(r.parts.HOOD).toBe("UNKNOWN"); // raporda belirtilmeyen parça orijinal yapılmaz
    expect(r.findings.engine).toBe("Kompresyon normal");
    expect(r.damageNote).not.toMatch(/\d{11}/);
    expect(r.missing.find((m) => m.field === "tramerAmount")?.reason).toMatch(/tramer olmadığı anlamına gelmez/);
  });

  it("tam şasi numarası taslağa, kayda ve uyarılara hiçbir yerde girmez; yalnızca son 6 hane kalır", () => {
    const r = mergeReadings(raw(ruhsat(), ekspertiz()));
    expect(JSON.stringify(r)).not.toContain("VF1LB17C500000001");
    expect(r.vehicle.vinLast6).toBe("000001");
  });

  it("araç tipi (D.2) ayrı okunur, model / ticari ad ile karıştırılmaz; okunamazsa boş kalır", () => {
    expect(mergeReadings(raw(ruhsat({ vehicleType: " clio symbol " }), null)).vehicle).toMatchObject({ model: "Clio", vehicleType: "CLIO SYMBOL" });
    expect(mergeReadings(raw(ruhsat(), null)).vehicle.vehicleType).toBeNull();
  });

  it("şasi uyuşmazsa FARKLI araç: ekspertiz bilgileri birleştirilmez", () => {
    const r = mergeReadings(raw(ruhsat({ vin: "NM417800006470359", plate: "48VJ105", brand: "FIAT", model: "PALIO", year: 2008 }), ekspertiz()));
    expect(r.identity).toBe("DIFFERENT");
    expect(r.vehicle.km).toBeNull();
    expect(Object.values(r.parts).every((s) => s === "UNKNOWN")).toBe(true);
    expect(r.conflicts.map((c) => c.field)).toEqual(expect.arrayContaining(["plate", "vinLast6", "brand", "year"]));
  });

  it("yalnızca plaka farklıysa kesin 'farklı araç' denmez: incelemeye gönderilir, birleştirme yapılır", () => {
    const r = mergeReadings(raw(ruhsat({ vin: null }), ekspertiz({ vin: null, plate: "34ABC123" })));
    expect(r.identity).toBe("REVIEW");
    expect(r.vehicle.km).toBe(54839);
    expect(r.conflicts.map((c) => c.field)).toContain("plate");
  });

  it("karşılaştırılacak şasi/plaka yoksa eşleşme doğrulanamadı olarak incelemeye düşer", () => {
    const r = mergeReadings(raw(ruhsat({ vin: null, plate: null }), ekspertiz({ vin: null, plate: null })));
    expect(r.identity).toBe("REVIEW");
  });

  it("tek belgede eksik alanlar nedenleriyle listelenir", () => {
    const r = mergeReadings(raw(ruhsat(), null));
    expect(r.identity).toBe("SINGLE");
    expect(r.missing.find((m) => m.field === "km")?.reason).toMatch(/ruhsatta yer almaz/i);
    expect(r.missing.find((m) => m.field === "price")).toBeTruthy();
  });

  it("yakıt ve vites metinlerini seçeneklere eşler", () => {
    expect(mapFuel("BENZİNLİ")).toBe("Benzin");
    expect(mapFuel("Motorin")).toBe("Dizel");
    expect(mapFuel("Benzin-Lpg")).toBe("LPG");
    expect(mapTransmission("Yarı Otomatik")).toBe("Yarı Otomatik");
    expect(mapTransmission("Düz")).toBe("Manuel");
  });
});

describe("inceleme engelleri", () => {
  const base: DocReview = {
    analysisIds: ["a"], identity: "SAME", identityNote: "", identityResolved: true, conflicts: [], aiFields: [], missing: [], stockDuplicates: [],
    duplicatesAcknowledged: true, ownerCheckRequired: false, ownerChecked: false, aiConfirmed: true, warnings: [],
    findings: { engine: null, mechanical: null, electrical: null, important: [] },
  };
  it("çözülmemiş eşleşme, çelişki, mükerrer, tescil ve AI onayı engeldir", () => {
    expect(reviewBlockers(base)).toEqual([]);
    expect(reviewBlockers({ ...base, identity: "DIFFERENT", identityResolved: false })[0]).toMatch(/farklı araçlara/);
    expect(reviewBlockers({ ...base, conflicts: [{ field: "plate", label: "Plaka", ruhsat: "a", ekspertiz: "b", resolved: null }] })[0]).toMatch(/çelişkili/);
    expect(reviewBlockers({ ...base, stockDuplicates: [{ id: "x", title: "t", status: "DRAFT", match: "plaka" }], duplicatesAcknowledged: false })).toHaveLength(1);
    expect(reviewBlockers({ ...base, ownerCheckRequired: true })).toHaveLength(1);
    expect(reviewBlockers({ ...base, aiConfirmed: false })).toHaveLength(1);
    expect(reviewBlockers(null)).toEqual([]);
  });
});

describe("kaporta şeması geometrisi (sağ/sol kararı kodda)", () => {
  // Yaygın şablon: üstte ters çizilmiş yan görünüş, ortada üstten görünüş, altta düz yan görünüş; aracın önü solda
  const views = [
    { id: "V1", kind: "SIDE" as const, frontAt: "LEFT" as const, upsideDown: true },
    { id: "V2", kind: "TOP" as const, frontAt: "LEFT" as const, upsideDown: false },
    { id: "V3", kind: "SIDE" as const, frontAt: "LEFT" as const, upsideDown: false },
  ];
  it("önü solda düz yan görünüş sol taraf, ters çizim sağ taraftır", () => {
    expect(visibleSide(views[2])).toBe("LEFT");
    expect(visibleSide(views[0])).toBe("RIGHT");
    expect(visibleSide({ ...views[2], frontAt: "RIGHT" })).toBe("RIGHT");
    expect(visibleSide({ ...views[2], frontAt: "UNKNOWN" })).toBeNull();
  });
  it("alt görünüşte arka tekerlek üstündeki BOYALI → sol arka çamurluk; plastik ve marşpiyel parça yapılmaz", () => {
    const { parts } = partsFromDiagram({
      views,
      labels: [
        { viewId: "V3", slot: "FENDER_FRONT", text: "PLASTİK", state: "UNKNOWN" },
        { viewId: "V3", slot: "DOOR_FRONT", text: "ORJİNAL", state: "ORIGINAL" },
        { viewId: "V3", slot: "DOOR_REAR", text: "ORJİNAL", state: "ORIGINAL" },
        { viewId: "V3", slot: "FENDER_REAR", text: "BOYALI", state: "PAINTED" },
        { viewId: "V3", slot: "SILL", text: "ORJİNAL", state: "ORIGINAL" },
        { viewId: "V1", slot: "FENDER_REAR", text: "ORJİNAL", state: "ORIGINAL" },
        { viewId: "V2", slot: "TRUNK", text: "LOKAL BOYA", state: "LOCAL_PAINT" },
      ],
    });
    expect(parts.LEFT_REAR_FENDER).toBe("PAINTED");
    expect(parts.RIGHT_REAR_FENDER).toBe("ORIGINAL");
    expect(parts.LEFT_FRONT_FENDER).toBe("UNKNOWN");
    expect(parts.TRUNK).toBe("LOCAL_PAINT");
    expect(Object.keys(parts)).not.toContain("SILL");
  });
});

describe("şema kutularının önden sırası", () => {
  it("4 gövde kutusunda sıra kesin: AI arka kutuya 'arka tampon' dese de arka çamurluk sayılır", () => {
    const { parts } = partsFromDiagram({
      views: [{ id: "V3", kind: "SIDE", frontAt: "LEFT", upsideDown: false }],
      labels: [
        { viewId: "V3", slot: "FRONT_END", order: 1, text: "PLASTİK", state: "UNKNOWN" },
        { viewId: "V3", slot: "DOOR_FRONT", order: 2, text: "ORJİNAL", state: "ORIGINAL" },
        { viewId: "V3", slot: "DOOR_REAR", order: 3, text: "ORJİNAL", state: "ORIGINAL" },
        { viewId: "V3", slot: "REAR_END", order: 4, text: "BOYALI", state: "PAINTED" },
        { viewId: "V3", slot: "SILL", order: 0, text: "ORJİNAL", state: "ORIGINAL" },
      ],
    });
    expect(parts.LEFT_REAR_FENDER).toBe("PAINTED");
    expect(parts.REAR_BUMPER).toBeUndefined();
    expect(parts.LEFT_FRONT_FENDER).toBe("UNKNOWN");
  });
});

describe("kasa tipi ruhsattan", () => {
  it("AB kasa kodu veya kasa adı tanınır; tanınmayan boş kalır", () => {
    expect(mapBodyType("Otomobil (Aa Sedan)")).toBe("Sedan");
    expect(mapBodyType("OTOMOBİL AB")).toBe("Hatchback");
    expect(mapBodyType("AC STATION WAGON")).toBe("Station Wagon");
    expect(mapBodyType("Otomobil")).toBeNull();
    expect(mapBodyType("KAMYONET")).toBeNull();
  });
});
