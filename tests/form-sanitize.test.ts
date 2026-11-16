import { describe, expect, it } from "vitest";
import { BODY_PART_KEYS, type BodyPartKey } from "@/lib/body-parts";
import { mergeReadings, type RawRead } from "@/lib/ai/document-sanitize";
import { parseFormDate, parseFormInt, sanitizeForm, type FormRaw } from "@/lib/ai/form-sanitize";

// Sentetik kontrol formu okumaları (gerçek araç / kişi verisi değildir). AI'nın el yazısını doğru okuduğu varsayılmaz;
// burada yalnızca dönüştürme, doğrulama ve belirsizlik kuralları denetlenir.
const allParts = (col = "ORIGINAL") => Object.fromEntries(BODY_PART_KEYS.map((k) => [k, [col]])) as Record<BodyPartKey, string[]>;
const form = (o: Partial<FormRaw> = {}): FormRaw => ({
  pages: [{ image: 1, formPage: 1 }, { image: 2, formPage: 2 }],
  brand: "Toyota", model: "Corolla", packageName: "1.6 Vision", vehicleClass: "Otomobil", vehicleType: "ZRE210L", year: "2021", km: "45.200",
  price: "1.250.000", color: "Gri", plate: "00 TST 00", vinLast6: "TST123", engineCc: "1598", enginePowerHp: "132", stockCode: "ST-01",
  fuel: ["Benzin"], transmission: ["Otomatik"], bodyType: ["Sedan"], drivetrain: ["Önden çekiş"],
  parts: allParts(),
  damageRecord: ["NONE"], damageNote: null, tramerAmount: null, lien: ["NONE"], warranty: ["NONE"], warrantyUntil: null, warrantyKm: null,
  expertiseReport: ["YOK"], equipment: ["ABS", "Klima", "Geri görüş kamerası"], otherEquipment: null,
  authority: ["COMPANY"], edevlet: ["NOT_NEEDED"], edevletUntil: null, notes: null, unclear: [],
  ...o,
});
const statusOf = (r: ReturnType<typeof sanitizeForm>, field: string) => r.status.find((s) => s.field === field);

describe("kontrol formu dönüştürme", () => {
  it("1. eksiksiz form: tüm alanlar CRM değerlerine çevrilir, sorun listesi boş", () => {
    const r = sanitizeForm(form());
    expect(r.vehicle).toMatchObject({ brand: "Toyota", year: 2021, km: 45200, price: 1_250_000, plate: "00TST00",fuel: "Benzin", transmission: "Otomatik", drivetrain: "Önden Çekiş", vinLast6: "TST123", enginePowerHp: 132 });
    expect(r.parts && Object.values(r.parts).every((s) => s === "ORIGINAL")).toBe(true);
    expect(r.legal).toMatchObject({ damageRecord: "NONE", legalLien: "NONE", warrantyStatus: "NONE", registeredToCompany: true, ownerConsent: null });
    expect(r.equipment).toEqual(["ABS", "Klima", "Geri görüş kamerası"]);
    expect(r.status).toEqual([]);
  });

  it("2. eksik alanlar: boş zorunlu alanlar 'formda boş' olarak listelenir, boş isteğe bağlı alanlar listelenmez, hiçbiri 'Yok' sayılmaz", () => {
    const r = sanitizeForm(form({ price: null, color: null, lien: [], warranty: [], damageRecord: [], fuel: [] }));
    expect(r.vehicle.price).toBeNull();
    expect(r.legal).toMatchObject({ legalLien: null, warrantyStatus: null, damageRecord: null });
    expect(r.status.map((s) => s.field)).toEqual(expect.arrayContaining(["price", "lien", "warranty", "damageRecord", "fuel"]));
    expect(statusOf(r, "color")).toBeUndefined();
    expect(statusOf(r, "lien")).toMatchObject({ status: "BLANK" });
  });

  it("eski formdaki kaldırılmış kutular (sorgulanmadı / doğrulanmadı / bilinmiyor) kabul edilmez: değer boş kalır, personele bildirilir", () => {
    const r = sanitizeForm(form({ damageRecord: ["NOT_QUERIED"], lien: ["UNVERIFIED"], warranty: ["UNKNOWN"] }));
    expect(r.legal).toMatchObject({ damageRecord: null, legalLien: null, warrantyStatus: null });
    expect(statusOf(r, "lien")).toMatchObject({ status: "UNREADABLE" });
  });

  it("3. bir kaporta satırında iki kutu: parça Bilinmiyor kalır ve belirsiz olarak bildirilir; boş satır Orijinal sayılmaz", () => {
    const r = sanitizeForm(form({ parts: { ...allParts(), HOOD: ["ORIGINAL", "PAINTED"], ROOF: [], TRUNK: ["NOT_CHECKED"] } }));
    expect(r.parts!.HOOD).toBe("UNKNOWN");
    expect(statusOf(r, "part:HOOD")).toMatchObject({ status: "AMBIGUOUS", label: "Kaporta: Ön kaput" });
    expect(statusOf(r, "part:HOOD")!.note).toContain("ORIGINAL, PAINTED");
    expect(r.parts!.ROOF).toBe("UNKNOWN");
    expect(statusOf(r, "part:ROOF")).toMatchObject({ status: "BLANK" });
    expect(r.parts!.TRUNK).toBe("UNKNOWN"); // "Kontrol edilemedi" = Bilinmiyor
    expect(r.parts!.LEFT_REAR_FENDER).toBe("ORIGINAL"); // sol/sağ tablodaki yazılı satır adından
  });

  it("çift işaretli tek seçimli grup tek seçeneğe indirilmez", () => {
    const r = sanitizeForm(form({ fuel: ["Benzin", "LPG"], transmission: ["Manuel"] }));
    expect(r.vehicle.fuel).toBeNull();
    expect(statusOf(r, "fuel")).toMatchObject({ status: "AMBIGUOUS" });
    expect(r.vehicle.transmission).toBe("Manuel");
  });

  it("4. okunamayan kilometre: harfli veya AI'nın emin olmadığı değer kaydedilmez", () => {
    expect(sanitizeForm(form({ km: "45.2O0" })).vehicle.km).toBeNull();
    expect(statusOf(sanitizeForm(form({ km: "45.2O0" })), "km")).toMatchObject({ status: "UNREADABLE" });
    const r = sanitizeForm(form({ km: null, unclear: [{ field: "km", reason: "silik el yazısı" }] }));
    expect(statusOf(r, "km")).toMatchObject({ status: "UNREADABLE", note: "silik el yazısı" });
    expect(parseFormInt("12.500 km", 0, 2_000_000)).toEqual({ value: 12500, status: "READ" });
    expect(parseFormInt("1850", 1950, 2030).status).toBe("UNREADABLE"); // geçersiz model yılı
    expect(sanitizeForm(form({ vinLast6: "TSO123" })).vehicle.vinLast6).toBeNull(); // O harfi şaside geçersiz
  });

  it("6. garanti devam ediyor ama bitiş tarihi yok: tarih eksik olarak bildirilir, km kaydedilir", () => {
    const r = sanitizeForm(form({ warranty: ["ACTIVE"], warrantyUntil: null, warrantyKm: "100.000" }));
    expect(r.legal).toMatchObject({ warrantyStatus: "ACTIVE", warrantyUntil: null, warrantyKm: 100000 });
    expect(statusOf(r, "warrantyUntil")!.note).toContain("bitiş tarihi yazılmamış");
    expect(parseFormDate("05.03.2027")).toEqual({ value: "2027-03-05", status: "READ" });
    expect(parseFormDate("31.02.2027").status).toBe("UNREADABLE");
  });

  it("7. hasar kaydı var ama niteliği yok: eksik olarak bildirilir", () => {
    const r = sanitizeForm(form({ damageRecord: ["MINOR"], damageNote: null, tramerAmount: "8.500" }));
    expect(r.legal).toMatchObject({ damageRecord: "MINOR", damageNote: null, tramerAmount: 8500 });
    expect(statusOf(r, "damageNote")!.note).toContain("niteliği yazılmamış");
  });

  it("8. yalnızca 1. sayfa: 2. sayfa eksikliği bildirilir; donanım ve satış yetkisi 'yok' değil 'okunmadı' (null)", () => {
    const r = sanitizeForm(form({ pages: [{ image: 1, formPage: 1 }], equipment: ["ABS"], authority: ["COMPANY"] }));
    expect(r.pages).toMatchObject({ page1: true, page2: false });
    expect(r.equipment).toBeNull();
    expect(r.legal.registeredToCompany).toBeNull();
    expect(r.warnings.some((w) => w.includes("2. sayfası"))).toBe(true);
  });

  it("ters sırada yüklenen sayfalar içerikten eşleştirilir", () => {
    const r = sanitizeForm(form({ pages: [{ image: 1, formPage: 2 }, { image: 2, formPage: 1 }] }));
    expect(r.pages).toMatchObject({ page1: true, page2: true, reversed: true });
  });

  it("listede olmayan donanım kaybolmaz; e-Devlet yetkisi doğrulanmış gibi gösterilmez; boş donanım 'donanım yok' sayılmaz", () => {
    const r = sanitizeForm(form({ equipment: ["ABS"], otherEquipment: "Çeki demiri, Webasto ısıtıcı", edevlet: ["GRANTED"], edevletUntil: "01.02.2027" }));
    expect(r.equipment).toEqual(["ABS", "Çeki demiri", "Webasto ısıtıcı"]);
    expect(r.unmatchedEquipment).toEqual(["Webasto ısıtıcı"]);
    expect(r.warnings.find((w) => w.includes("e-Devlet"))).toContain("EİDS doğrulaması değildir");
    expect(statusOf(sanitizeForm(form({ equipment: [] })), "equipment")!.note).toContain("donanım olmadığı anlamına gelmez");
  });
});

describe("kontrol formu ve diğer belgeler", () => {
  const ruhsat = (o: Record<string, unknown> = {}) => ({
    brand: "TOYOTA", model: "COROLLA", packageName: null, vehicleType: "ZRE210L", year: 2021, firstRegistrationDate: null, vehicleClass: "OTOMOBİL", color: null,
    engineCc: 1598, enginePowerKw: null, enginePowerHp: null, fuelText: "BENZİN", seats: 5, plate: "00TST00", vin: null, vinLabel: "(E) ŞASE NO", vinLast6Visible: "TST123",
    ownerType: "COMPANY" as const, ...o,
  });
  const raw = (r: ReturnType<typeof ruhsat> | null, f: FormRaw | null): RawRead => ({ ruhsat: r, ekspertiz: null, form: f, sources: [], unreadable: [], quality: [], warnings: [] });

  it("ruhsat ile aynı bilgiler çelişki üretmez; formdaki km ve fiyat araca gelir, 'eksik' listesinden düşer", () => {
    const r = mergeReadings(raw(ruhsat(), form()));
    expect(r.conflicts).toEqual([]);
    expect(r.vehicle.km).toBe(45200);
    expect(r.origin?.km).toBe("FORM");
    expect(r.missing.find((m) => m.field === "km")).toBeUndefined();
    expect(r.form?.vehicle.price).toBe(1_250_000);
    expect(r.missing.find((m) => m.field === "price")).toBeUndefined();
    expect(r.identity).toBe("SAME"); // şasi son 6 hane ve plaka iki belgede aynı
  });

  it("kanıt metinlerindeki tam şasi numarası kayda yazılmaz; yalnızca son 6 hane kalır (canlı denemede bulunan açık)", () => {
    const r = mergeReadings({ ...raw(ruhsat({ vin: "TSTRK00000TST4826", vinLast6Visible: null }), form()), sources: [{ field: "vin", document: "RUHSAT", page: 1, location: "(E)", text: "(E) ŞASE NO: TSTRK00000TST4826" }], warnings: ["Şasi TSTRK00000TST4826 net"] });
    const json = JSON.stringify(r);
    expect(json).not.toContain("TSTRK00000TST4826");
    expect(r.sources[0].text).toContain("•••••••••••ST4826");
    expect(r.vehicle.vinLast6).toBe("ST4826");
  });

  it("büyük/küçük harf ve I/i farkı çelişki sayılmaz (canlı denemede görülen 'I20' / 'i20')", () => {
    const r = mergeReadings(raw(ruhsat({ brand: "HYUNDAI", model: "I20" }), form({ brand: "Hyundai", model: "i20" })));
    expect(r.conflicts).toEqual([]);
  });

  it("5/10. ruhsat ile formun şasisi ve yılı farklıysa çelişki olarak sorulur; ruhsat değeri seçilene kadar onaylanmış sayılmaz", () => {
    const r = mergeReadings(raw(ruhsat(), form({ vinLast6: "TST999", year: "2020" })));
    expect(r.conflicts.map((c) => c.field)).toEqual(expect.arrayContaining(["vinLast6", "year"]));
    expect(r.conflicts.find((c) => c.field === "year")).toMatchObject({ ruhsat: "2021", ekspertiz: "2020", labels: ["Ruhsat / ekspertiz", "Kontrol formu"] });
    expect(r.identity).toBe("REVIEW");
    expect(r.vehicle.year).toBe(2021);
  });

  it("yalnızca kontrol formu: tek belge, formun şasi son 6 hanesi kısmi okuma sayılır", () => {
    const r = mergeReadings(raw(null, form()));
    expect(r.identity).toBe("SINGLE");
    expect(r.vehicle).toMatchObject({ vinLast6: "TST123", vinPartial: true, plate: "00TST00" });
  });
});
