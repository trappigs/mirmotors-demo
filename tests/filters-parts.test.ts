import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BODY_PART_KEYS, partConflicts, summarizeParts, toPartMap, type PartMap } from "@/lib/body-parts";
import { saveVehicleParts } from "@/lib/body-parts-db";
import { buildPublicWhere, parseFilters } from "@/lib/vehicle-filters";
import { blockerMessage, missingVehicleFields, publishBlockers, publishChecklist, type ChecklistVehicle } from "@/lib/listing-rules";
import { vehicleInputSchema } from "@/lib/vehicle-schema";
import { transitionVehicle } from "@/lib/vehicle-status";

const db = new PrismaClient();
let adminId = "";

const allOriginal = () => Object.fromEntries(BODY_PART_KEYS.map((k) => [k, "ORIGINAL"])) as PartMap;

async function vehicle(data: Record<string, unknown> = {}) {
  return db.vehicle.create({
    data: {
      brand: "BMW", model: "5 Serisi", packageName: "520i", year: 2022, km: 20000, price: 3_000_000,
      fuel: "Benzin", transmission: "Otomatik", bodyType: "Sedan", status: "AVAILABLE", createdById: adminId, ...data,
    },
  });
}
const ids = async (qs: Record<string, string>) =>
  (await db.vehicle.findMany({ where: buildPublicWhere(parseFilters(qs)), select: { id: true } })).map((v) => v.id);

beforeAll(async () => {
  adminId = (await db.user.create({ data: { name: "fp-admin", email: "fp-admin@t.test", passwordHash: "x", role: "ADMIN" } })).id;
});
beforeEach(async () => {
  await db.statusHistory.deleteMany();
  await db.sale.deleteMany();
  await db.vehiclePart.deleteMany();
  await db.vehiclePhoto.deleteMany();
  await db.vehicle.deleteMany();
});
afterAll(() => db.$disconnect());

describe("kaporta özeti", () => {
  it("bilinmeyen parça varken 'tüm parçalar orijinal' denmez", () => {
    const m = toPartMap([{ part: "HOOD", state: "ORIGINAL" }]);
    const s = summarizeParts(m);
    expect(s.allOriginal).toBe(false);
    expect(s.bodyVerified).toBe(false);
    expect(s.unknownCount).toBe(12);
    expect(summarizeParts(allOriginal()).allOriginal).toBe(true);
  });

  it("personel beyanı ile ekspertiz raporu çelişkisini yalnızca ikisi de biliniyorsa bulur", () => {
    const staff = { ...allOriginal(), HOOD: "PAINTED" as const };
    const report = toPartMap([{ part: "HOOD", state: "ORIGINAL" }]);
    expect(partConflicts(staff, report)).toEqual(["HOOD"]);
    expect(partConflicts(staff, toPartMap([]))).toEqual([]);
  });

  it("parçalar ayrı satır olarak kaydedilir, sayaçlar ve geçmiş güncellenir", async () => {
    const v = await vehicle();
    await saveVehicleParts(db, v.id, BODY_PART_KEYS.map((k) => ({ part: k, state: k === "ROOF" ? "CHANGED" : "ORIGINAL" })), adminId);
    expect(await db.vehiclePart.count({ where: { vehicleId: v.id } })).toBe(13);
    const after = await db.vehicle.findUniqueOrThrow({ where: { id: v.id } });
    expect(after).toMatchObject({ bodyVerified: true, changedCount: 1, paintedCount: 0 });
    const parts = await db.vehiclePart.findMany({ where: { vehicleId: v.id } });
    expect(parts.every((p) => p.updatedById === adminId)).toBe(true);
    const h = await db.statusHistory.findFirstOrThrow({ where: { vehicleId: v.id, action: "bodyParts" } });
    expect(h.note).toContain("Tavan: Değişen");
  });
});

describe("filtreler", () => {
  it("'boyalı yok' / 'değişen yok' yalnızca tüm parçaları doğrulanmış araçları getirir", async () => {
    const clean = await vehicle();
    await saveVehicleParts(db, clean.id, BODY_PART_KEYS.map((k) => ({ part: k, state: "ORIGINAL" })), adminId);
    const unknown = await vehicle(); // hiç kaporta bilgisi yok
    const painted = await vehicle();
    await saveVehicleParts(db, painted.id, [{ part: "HOOD", state: "PAINTED" }], adminId);

    expect(await ids({ boyali: "yok" })).toEqual([clean.id]);
    expect(await ids({ degisen: "yok" })).toEqual([clean.id]);
    expect(await ids({ boyali: "var" })).toEqual([painted.id]);
    expect(await ids({})).toHaveLength(3);
    expect(await ids({ boyali: "yok" })).not.toContain(unknown.id);
  });

  it("hasar bilgisi girilmemiş araç hasar filtrelerine girmez", async () => {
    const none = await vehicle({ damageRecord: "NONE" });
    const heavy = await vehicle({ damageRecord: "HEAVY" });
    await vehicle({ damageRecord: null });
    expect(await ids({ hasar: "yok" })).toEqual([none.id]);
    expect(await ids({ agirHasar: "var" })).toEqual([heavy.id]);
    expect((await ids({ agirHasar: "yok" })).sort()).toEqual([none.id].sort());
  });

  it("aralıklar, ters girilmiş aralık, paket, donanım ve kombinasyon", async () => {
    const a = await vehicle({ price: 2_000_000, km: 10_000, year: 2023, enginePower: 190, engineCc: 1998, color: "Siyah", drivetrain: "Arkadan İtiş", equipment: JSON.stringify(["Sunroof", "Isıtmalı koltuk"]) });
    const b = await vehicle({ price: 4_000_000, km: 90_000, year: 2018, packageName: "530d", equipment: JSON.stringify(["Isıtmalı koltuk"]) });
    expect(await ids({ minFiyat: "1.500.000", maxFiyat: "2.500.000" })).toEqual([a.id]);
    expect(await ids({ minFiyat: "2500000", maxFiyat: "1500000" })).toEqual([a.id]); // ters aralık düzeltilir
    expect(await ids({ maxKm: "50000", minYil: "2020" })).toEqual([a.id]);
    expect(await ids({ paket: "530d" })).toEqual([b.id]);
    expect(await ids({ donanim: "Sunroof,Isıtmalı koltuk" })).toEqual([a.id]);
    expect((await ids({ donanim: "Isıtmalı koltuk" })).sort()).toEqual([a.id, b.id].sort());
    expect(await ids({ marka: "BMW", renk: "Siyah", minHp: "150", maxCc: "2000", cekis: "Arkadan İtiş" })).toEqual([a.id]);
    expect(await ids({ marka: "Audi" })).toEqual([]);
  });

  it("satış bekleyen, satılmış ve taslak araçlar hiçbir filtreyle gelmez", async () => {
    await vehicle({ status: "SALE_PENDING" });
    await vehicle({ status: "SOLD" });
    await vehicle({ status: "DRAFT" });
    const ok = await vehicle({ status: "OPTIONED" });
    expect(await ids({})).toEqual([ok.id]);
    expect(await ids({ durum: "SOLD" })).toEqual([ok.id]); // geçersiz durum yok sayılır, yine yalnızca yayındakiler
  });
});

describe("eksik bilgiyle taslak ve yayın kuralları", () => {
  it("taslak eksik bilgiyle doğrulanır, yayımlama eksikleri listeler", async () => {
    const input = vehicleInputSchema.parse({ brand: "Toyota", year: "", price: "" });
    expect(input.price).toBeNull();
    expect(missingVehicleFields(input)).toEqual(expect.arrayContaining(["Model", "Fiyat", "Kilometre"]));
    const v = await vehicle({ model: null, price: null, status: "DRAFT" });
    await db.vehiclePhoto.create({ data: { vehicleId: v.id, path: "t/1.jpg" } });
    const r = await transitionVehicle(db, { id: adminId, role: "ADMIN" }, v.id, "publish");
    expect(r).toMatchObject({ ok: false, status: 422 });
    expect(!r.ok && r.error).toMatch(/fiyat/i);
  });

  it("şasi numarasının yalnızca son 6 hanesi kabul edilir", () => {
    expect(() => vehicleInputSchema.parse({ legalVin: "WBA12345678901234" })).toThrow();
    expect(vehicleInputSchema.parse({ legalVin: "a12345" }).legalVin).toBe("A12345");
  });

  const unknownParts = Object.fromEntries(BODY_PART_KEYS.map((k) => [k, "UNKNOWN"])) as PartMap;
  const originalParts = Object.fromEntries(BODY_PART_KEYS.map((k) => [k, "ORIGINAL"])) as PartMap;
  const noCompany = { title: null, authorizationNo: null, mersis: null, address: null };
  const check = (v: ChecklistVehicle, parts = unknownParts, company = noCompany) =>
    publishChecklist({ v, company, photoCount: 1, staffParts: parts, reportParts: unknownParts, reviewBlockers: [] });
  const okKeys = (items: ReturnType<typeof check>) => items.filter((i) => i.ok).map((i) => i.key);

  it("mevzuat listesi: bilinmeyen alanlar eksik sayılır ve yayını engeller, tramer tutarı ayrıca zorunlu değildir", () => {
    const items = check({ brand: "Toyota", model: "Corolla", year: 2020, km: 1000, price: 100, fuel: "Benzin", transmission: "Manuel", bodyType: "Sedan" });
    const missing = items.filter((i) => !i.ok).map((i) => i.key);
    expect(missing).toEqual(expect.arrayContaining(["companyTitle", "companyAuth", "classType", "equipment", "plate", "vin", "parts", "damage", "lien", "warranty", "authority"]));
    expect(items.some((i) => /tramer/i.test(i.label))).toBe(false);
    expect(publishBlockers(items).map((i) => i.key)).toEqual(missing);
    const msg = blockerMessage(publishBlockers(items));
    expect(msg).toContain("İlan yayımlanamıyor: Şasi numarasının son 6 hanesi eksik.");
    expect(msg).toContain("İlan yayımlanamıyor: Plaka eksik.");
  });

  it("hasar: Yok yeterli; Var ise nitelik gerekir (tramer tutarı nitelik sayılmaz); boş ve eski sorgulanmadı değeri yayını engeller", () => {
    const reason = (v: ChecklistVehicle) => check(v).find((i) => i.key === "damage")!;
    expect(reason({ damageRecord: "NONE" }).ok).toBe(true);
    expect(reason({ damageRecord: "MINOR" }).reason).toBe("Hasar kaydının niteliği belirtilmedi.");
    expect(reason({ damageRecord: "MINOR", tramerAmount: 12500 }).ok).toBe(false);
    expect(reason({ damageRecord: "HEAVY", damageNote: "Sol arka darbe, şasi hasarsız" }).ok).toBe(true);
    expect(reason({ damageRecord: "NOT_QUERIED" }).reason).toBe("Hasar kaydı bilgisi girilmedi."); // eski kayıt
    expect(reason({}).ok).toBe(false);
  });

  it("rehin/haciz: Yok veya Var bildirilir; boş (veya eski doğrulanmadı) yayını engeller", () => {
    const lien = (v: ChecklistVehicle) => check(v).find((i) => i.key === "lien")!;
    expect(lien({ legalLien: "NONE" }).ok).toBe(true);
    expect(lien({ legalLien: "EXISTS" }).ok).toBe(true);
    expect(lien({ legalLien: "UNVERIFIED" }).reason).toBe("Rehin/haciz durumu girilmedi."); // eski kayıt
    expect(lien({}).ok).toBe(false);
  });

  it("garanti: devam ediyorsa tarih ve km gerekir; yoksa istenmez; boş (veya eski bilinmiyor) ≠ yok", () => {
    const w = (v: ChecklistVehicle) => check(v).find((i) => i.key === "warranty")!;
    expect(w({ warrantyStatus: "NONE" }).ok).toBe(true);
    expect(w({ warrantyStatus: "ACTIVE", warrantyUntil: "2027-03-01" }).reason).toContain("bitiş kilometresi");
    expect(w({ warrantyStatus: "ACTIVE" }).reason).toContain("bitiş tarihi ve bitiş kilometresi");
    expect(w({ warrantyStatus: "ACTIVE", warrantyUntil: "2027-03-01", warrantyKm: 100000 }).ok).toBe(true);
    expect(w({ warrantyStatus: "UNKNOWN" }).ok).toBe(false);
    expect(w({ warrantyStatus: "UNKNOWN" }).reason).toBe("Garanti durumu girilmedi.");
    expect(okKeys(check({}, originalParts))).toContain("parts");
    expect(okKeys(check({ legalOwnerConsent: true }))).toContain("authority");
  });

  it("araç cinsi ve tipi ayrı alanlardır; model (ticari ad) tip yerine sayılmaz", () => {
    const ct = (v: ChecklistVehicle) => check(v).find((i) => i.key === "classType")!;
    expect(ct({ model: "Corolla", vehicleClass: "Otomobil" }).reason).toBe("Aracın tipi eksik.");
    expect(ct({ vehicleClass: "Otomobil", vehicleType: "ZRE210L" }).ok).toBe(true);
  });

  it("sade durum değerleri kabul edilir; kaldırılan (sorgulanmadı / doğrulanmadı / bilinmiyor) ve geçersiz değerler reddedilir", () => {
    const p = vehicleInputSchema.parse({ damageRecord: "HEAVY", legalLien: "EXISTS", warrantyStatus: "ACTIVE", vehicleType: "ZRE210L" });
    expect(p).toMatchObject({ damageRecord: "HEAVY", legalLien: "EXISTS", warrantyStatus: "ACTIVE", vehicleType: "ZRE210L" });
    expect(() => vehicleInputSchema.parse({ legalLien: "YOK" })).toThrow();
    expect(() => vehicleInputSchema.parse({ damageRecord: "NOT_QUERIED" })).toThrow();
    expect(() => vehicleInputSchema.parse({ legalLien: "UNVERIFIED" })).toThrow();
    expect(() => vehicleInputSchema.parse({ warrantyStatus: "UNKNOWN" })).toThrow();
  });

  it("zorunlu ilan bilgileri eksik ilan yayımlanmaz; tamamlanınca yayımlanır ve ilan no verilir", async () => {
    try {
      const v = await vehicle({ status: "DRAFT" });
      await db.vehiclePhoto.create({ data: { vehicleId: v.id, path: "t/legal.jpg" } });
      const r1 = await transitionVehicle(db, { id: adminId, role: "ADMIN" }, v.id, "publish");
      expect(r1).toMatchObject({ ok: false, status: 422 });
      expect(!r1.ok && r1.error).toContain("İlan yayımlanamıyor: Şasi numarasının son 6 hanesi eksik.");
      expect(!r1.ok && r1.error).toContain("İlan yayımlanamıyor: Plaka eksik.");
      expect(!r1.ok && r1.error).toContain("İşletmenin resmî unvanı girilmedi");
      expect((await db.vehicle.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("DRAFT");

      await db.companySettings.upsert({ where: { id: "default" }, create: { id: "default", title: "Test Otomotiv Ltd. Şti.", authorizationNo: "TEST-1" }, update: {} });
      await db.vehicle.update({
        where: { id: v.id },
        data: { vehicleClass: "Otomobil", vehicleType: "G30", equipment: JSON.stringify(["ABS"]), legalPlate: "34TEST01", legalVin: "A12345", damageRecord: "NONE", legalLien: "UNVERIFIED", warrantyStatus: "NONE", legalRegisteredToCompany: true },
      });
      await saveVehicleParts(db, v.id, BODY_PART_KEYS.map((k) => ({ part: k, state: "ORIGINAL" })), adminId);
      const r2 = await transitionVehicle(db, { id: adminId, role: "ADMIN" }, v.id, "publish");
      expect(r2).toMatchObject({ ok: false, status: 422 });
      expect(!r2.ok && r2.error).toBe("İlan yayımlanamıyor: Rehin/haciz durumu girilmedi."); // eski "doğrulanmadı" değeri

      await db.vehicle.update({ where: { id: v.id }, data: { legalLien: "NONE" } });
      const r3 = await transitionVehicle(db, { id: adminId, role: "ADMIN" }, v.id, "publish");
      expect(r3).toMatchObject({ ok: true, status: "AVAILABLE" });
      expect((await db.vehicle.findUniqueOrThrow({ where: { id: v.id } })).legalListingNo).toBe(`MM-${v.id.slice(-6).toUpperCase()}`);
    } finally {
      await db.companySettings.deleteMany();
    }
  });
});
