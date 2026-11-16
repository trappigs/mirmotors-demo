import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { transitionVehicle, type Actor } from "@/lib/vehicle-status";
import { BODY_PART_KEYS } from "@/lib/body-parts";
import { normalizePlate, plateDuplicates } from "@/lib/plates";
import { stockDuplicates } from "@/lib/doc-analysis";
import { aiFieldFilled, aiFieldTarget, checkTarget, fixHref } from "@/lib/fix-targets";
import { publishChecklist } from "@/lib/listing-rules";
import { bodyTypeFromVehicleType, mapBodyType } from "@/lib/ai/document-sanitize";
import { toVehicleData, vehicleInputSchema } from "@/lib/vehicle-schema";
import type { DocReview } from "@/lib/doc-review";

// Faz 1: ortak araç girişi ve son kontrol (sentetik veriler; gerçek plaka/şasi değildir).
const db = new PrismaClient();
let staff: Actor;

const review = (over: Partial<DocReview> = {}): DocReview => ({
  analysisIds: [], identity: "SINGLE", identityNote: "", identityResolved: true, conflicts: [], aiFields: [], missing: [],
  stockDuplicates: [], duplicatesAcknowledged: false, ownerCheckRequired: false, ownerChecked: false, aiConfirmed: false, warnings: [],
  findings: { engine: null, mechanical: null, electrical: null, important: [] }, ...over,
});

/** Zorunlu ilan bilgileri tamam, fotoğraflı sentetik araç. */
async function vehicle(data: Record<string, unknown> = {}) {
  const v = await db.vehicle.create({
    data: {
      brand: "Volkswagen", model: "LT", year: 2008, km: 250000, price: 450_000, fuel: "Dizel", transmission: "Manuel", bodyType: "Panelvan",
      vehicleClass: "Kamyonet", vehicleType: "LT35 P.VAN TEST", equipment: JSON.stringify(["ABS"]), legalPlate: "00 FZ 001", legalVin: "TEST01",
      damageRecord: "NONE", legalLien: "NONE", warrantyStatus: "NONE", legalRegisteredToCompany: true, status: "DRAFT", createdById: staff.id,
      parts: { create: BODY_PART_KEYS.map((part) => ({ part, state: "ORIGINAL" })) },
      ...data,
    },
  });
  await db.vehiclePhoto.create({ data: { vehicleId: v.id, path: "t/faz1.jpg" } });
  return v.id;
}

beforeAll(async () => {
  const u = await db.user.create({ data: { name: "faz1", email: "faz1@t.test", passwordHash: "x", role: "SALES" } });
  staff = { id: u.id, role: "SALES" };
  await db.companySettings.upsert({ where: { id: "default" }, create: { id: "default", title: "Test Otomotiv Ltd. Şti.", authorizationNo: "TEST-1" }, update: {} });
});

beforeEach(async () => {
  // Diğer test dosyalarının bıraktığı satış / belge kayıtları da temizlenir (araç silinebilsin)
  await db.statusHistory.deleteMany();
  await db.sale.deleteMany();
  await db.documentAudit.deleteMany();
  await db.vehicleDocument.deleteMany();
  await db.docAnalysis.deleteMany();
  await db.vehiclePhoto.deleteMany();
  await db.vehiclePart.deleteMany();
  await db.vehicle.deleteMany();
});

afterAll(async () => {
  await db.companySettings.deleteMany();
  await db.$disconnect();
});

describe("aynı plaka kontrolü", () => {
  it("boşluk / küçük harf farkı aynı plaka sayılır; satılmış araç engellemez (yeniden stoğa giriş)", async () => {
    const active = await vehicle({ legalPlate: "00 FZ 001" });
    await vehicle({ legalPlate: "00FZ001", status: "SOLD" });
    expect(normalizePlate(" 00 fz-001 ")).toBe("00FZ001");
    const d = await plateDuplicates(db, "00fz001");
    expect(d.map((x) => x.id)).toEqual([active]);
    expect(await plateDuplicates(db, "00 FZ 001", active)).toEqual([]); // aracın kendisi sayılmaz
    expect(await plateDuplicates(db, "")).toEqual([]);
  });

  it("belgeden eklemedeki stok uyarısı da yazım farkını yakalar", async () => {
    const id = await vehicle({ legalPlate: "00 FZ 001" });
    const d = await stockDuplicates(db, "00FZ001", null);
    expect(d).toMatchObject([{ id, match: "plaka" }]);
  });
});

describe("tek kontrol ve onay", () => {
  it("belgeden oluşturulan araç: belge kontrolü bitmeden yayımlanamaz, bitince son ekrandan tek onayla yayımlanır", async () => {
    const id = await vehicle({ status: "REVIEW", docReview: JSON.stringify(review({ aiConfirmed: false })) });
    const early = await transitionVehicle(db, staff, id, "publish");
    expect(early).toMatchObject({ ok: false, status: 422 });
    expect(!early.ok && early.error).toContain("AI'nın doldurduğu bilgileri kontrol ettiğinizi onaylayın");
    expect((await db.vehicle.findUniqueOrThrow({ where: { id } })).status).toBe("REVIEW");

    await db.vehicle.update({ where: { id }, data: { docReview: JSON.stringify(review({ aiConfirmed: true })) } });
    expect(await transitionVehicle(db, staff, id, "publish")).toMatchObject({ ok: true, status: "AVAILABLE" });
    const h = await db.statusHistory.findMany({ where: { vehicleId: id }, orderBy: { createdAt: "asc" } });
    // Personel onayı ve yayın geçmişte ayrı satırlar olarak, onaylayan kişiyle tutulur
    expect(h.map((x) => [x.action, x.fromStatus, x.toStatus, x.userId])).toEqual([
      ["completeReview", "REVIEW", "DRAFT", staff.id],
      ["publish", "DRAFT", "AVAILABLE", staff.id],
    ]);
  });

  it("eksik zorunlu bilgiyle yayımlanamaz; yasal kontroller korunur", async () => {
    const id = await vehicle({ legalVin: null, legalLien: null });
    const r = await transitionVehicle(db, staff, id, "publish");
    expect(r).toMatchObject({ ok: false, status: 422 });
    expect(!r.ok && r.error).toContain("Şasi numarasının son 6 hanesi eksik.");
    expect(!r.ok && r.error).toContain("Rehin/haciz durumu girilmedi.");
  });

  it("her kontrol maddesinin bir 'Düzelt' hedefi var; bağlantı adım ve alana götürür", () => {
    const items = publishChecklist({ v: {}, company: { title: null, authorizationNo: null, mersis: null, address: null }, photoCount: 0, staffParts: {} as never, reportParts: {} as never, reviewBlockers: ["x"] });
    for (const i of items) expect(checkTarget(i.key).anchor || checkTarget(i.key).href, i.key).toBeTruthy();
    expect(fixHref("v1", checkTarget("plate"))).toBe("/crm/vehicles/v1/tamamla?adim=1#legalPlate");
    expect(fixHref("v1", checkTarget("parts"))).toBe("/crm/vehicles/v1/tamamla?adim=2#kaporta");
    expect(fixHref("v1", checkTarget("photos"))).toBe("/crm/vehicles/v1/tamamla?adim=3#fotograflar");
    expect(fixHref("v1", checkTarget("companyTitle"))).toBe("/crm/ayarlar");
  });

  it("AI'nın okuyamadığı alanlar son kontrolde ilgili form alanına bağlanır ve doldurulunca tamamlandı sayılır", () => {
    expect(aiFieldTarget("plate")).toEqual({ step: 1, anchor: "legalPlate" });
    expect(aiFieldTarget("lien")).toEqual({ step: 2, anchor: "legalLien" });
    expect(aiFieldTarget("part:HOOD")).toEqual({ step: 2, anchor: "kaporta" });
    expect(aiFieldFilled("plate", { legalPlate: null }, {})).toBe(false);
    expect(aiFieldFilled("plate", { legalPlate: "00 FZ 001" }, {})).toBe(true);
    expect(aiFieldFilled("equipment", { equipment: "[]" }, {})).toBe(false);
    expect(aiFieldFilled("part:HOOD", {}, { HOOD: "PAINTED" })).toBe(true);
    expect(aiFieldFilled("authority", { legalOwnerConsent: true }, {})).toBe(true);
  });
});

describe("ticari araç ve taslak kaydı", () => {
  it("Panelvan, Kamyonet ve Minibüs kasa tipi kabul edilir; geçersiz değer reddedilir", () => {
    for (const b of ["Panelvan", "Kamyonet", "Minibüs", "Sedan"]) expect(vehicleInputSchema.parse({ bodyType: b }).bodyType).toBe(b);
    expect(() => vehicleInputSchema.parse({ bodyType: "Kamyon" })).toThrow();
  });

  it("ruhsattan kasa: tipte açıkça panelvan yazıyorsa Panelvan; cinsi 'kamyonet' tek başına kasa belirlemez", () => {
    expect(bodyTypeFromVehicleType("LT35 P.VAN H/R LWB 2.5 TDI 108")).toBe("Panelvan");
    expect(bodyTypeFromVehicleType("CRAFTER PANELVAN")).toBe("Panelvan");
    expect(bodyTypeFromVehicleType("FIAT DOBLO COMBI")).toBeNull();
    expect(mapBodyType("KAMYONET")).toBeNull();
    expect(mapBodyType("MİNİBÜS")).toBe("Minibüs");
    expect(mapBodyType("BB")).toBe("Panelvan");
    expect(mapBodyType("MINIVAN")).toBe("MPV"); // "VAN" kelimesi ayrı değil
  });

  it("otomatik kayıt anahtarı ve plaka onayı araç verisine yazılmaz; kısmi kayıt yalnızca gönderilen alanı değiştirir", () => {
    const d = toVehicleData(vehicleInputSchema.parse({ price: "1.250.000", createKey: "0123456789abcdef0123456789abcdef", plateDuplicateAck: true }));
    expect(d).toEqual({ price: 1250000 });
  });

  it("aynı taslak anahtarıyla ikinci araç oluşturulamaz (veritabanı benzersizliği)", async () => {
    await vehicle({ createKey: "0123456789abcdef0123456789abcdef" });
    await expect(vehicle({ createKey: "0123456789abcdef0123456789abcdef", legalPlate: "00 FZ 002" })).rejects.toThrow();
  });
});
