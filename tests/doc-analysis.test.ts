import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getAnalysis, runAnalysis } from "@/lib/doc-analysis";
import { parseReview } from "@/lib/doc-review";
import { transitionVehicle } from "@/lib/vehicle-status";

// Simülasyon modunda (OpenAI çağrısı yapılmaz) analiz işinin araç kaydına etkisi.
const db = new PrismaClient();
let userId = "";
const admin = () => ({ id: userId, role: "ADMIN" as const });

async function analysis(method: string, kinds: ("RUHSAT" | "EKSPERTIZ" | "FORM")[], vehicleId: string | null = null) {
  return db.docAnalysis.create({
    data: {
      method, vehicleId, mode: "SIMULATION", createdById: userId,
      documents: { create: kinds.map((k, i) => ({ kind: k, page: kinds.slice(0, i + 1).filter((x) => x === k).length, path: `docs/${crypto.randomUUID()}.jpg`, masked: true, sha256: `h${i}${Math.random()}`, createdById: userId })) },
    },
  });
}
const vehicleOf = async (analysisId: string) => {
  const a = await db.docAnalysis.findUniqueOrThrow({ where: { id: analysisId } });
  expect(a.status).toBe("REVIEW");
  return db.vehicle.findUniqueOrThrow({ where: { id: a.vehicleId! }, include: { parts: true, documents: true } });
};

beforeAll(async () => {
  userId = (await db.user.create({ data: { name: "da-admin", email: "da-admin@t.test", passwordHash: "x", role: "ADMIN" } })).id;
});
beforeEach(async () => {
  await db.documentAudit.deleteMany();
  await db.vehicleDocument.deleteMany();
  await db.docAnalysis.deleteMany();
  await db.statusHistory.deleteMany();
  await db.sale.deleteMany();
  await db.vehiclePart.deleteMany();
  await db.vehiclePhoto.deleteMany();
  await db.vehicle.deleteMany();
});
afterAll(() => db.$disconnect());

describe("belge analizi işi", () => {
  it("ruhsat + ekspertiz → Kontrol Bekliyor araç, belgeler bağlı, kaporta yalnızca rapor tarafında", async () => {
    const a = await analysis("RUHSAT_EKSPERTIZ", ["RUHSAT", "EKSPERTIZ"]);
    await runAnalysis(a.id);
    const done = await db.docAnalysis.findUniqueOrThrow({ where: { id: a.id } });
    expect(done.status).toBe("REVIEW");
    const v = await db.vehicle.findUniqueOrThrow({ where: { id: done.vehicleId! }, include: { parts: true, documents: true } });
    expect(v.status).toBe("REVIEW");
    expect(v.documents).toHaveLength(2);
    expect(v.parts.find((p) => p.part === "TRUNK")).toMatchObject({ state: "UNKNOWN", reportState: "LOCAL_PAINT" });
    const review = parseReview(v.docReview)!;
    expect(review.aiConfirmed).toBe(false);
    expect(review.missing.map((m) => m.field)).toContain("price");
    expect(await db.documentAudit.count({ where: { action: "ANALYZE", analysisId: a.id } })).toBe(1);
  });

  it("Kontrol Bekliyor araç yayımlanamaz; engeller çözülmeden kontrol tamamlanamaz", async () => {
    const a = await analysis("RUHSAT_EKSPERTIZ", ["RUHSAT", "EKSPERTIZ"]);
    await runAnalysis(a.id);
    const vid = (await db.docAnalysis.findUniqueOrThrow({ where: { id: a.id } })).vehicleId!;
    await db.vehiclePhoto.create({ data: { vehicleId: vid, path: "t/1.jpg" } });
    expect(await transitionVehicle(db, admin(), vid, "publish")).toMatchObject({ ok: false, status: 422 });
    expect(await transitionVehicle(db, admin(), vid, "completeReview")).toMatchObject({ ok: false, status: 422 });
    const v = await db.vehicle.findUniqueOrThrow({ where: { id: vid } });
    const r = parseReview(v.docReview)!;
    await db.vehicle.update({ where: { id: vid }, data: { docReview: JSON.stringify({ ...r, identityResolved: true, ownerChecked: true, aiConfirmed: true, duplicatesAcknowledged: true, conflicts: r.conflicts.map((c) => ({ ...c, resolved: "MANUAL" })) }) } });
    expect(await transitionVehicle(db, admin(), vid, "completeReview")).toMatchObject({ ok: true, status: "DRAFT" });
  });

  it("mevcut araca ekspertiz eklemek personelin girdiği değerleri ezmez, yalnızca boşları doldurur", async () => {
    const v = await db.vehicle.create({ data: { brand: "Toyota", model: "Corolla", km: null, price: 1_000_000, status: "DRAFT", createdById: userId } });
    const a = await analysis("ADD", ["EKSPERTIZ"], v.id);
    await runAnalysis(a.id);
    const after = await db.vehicle.findUniqueOrThrow({ where: { id: v.id }, include: { parts: true } });
    expect(after.brand).toBe("Toyota"); // simülasyondaki "Fiat" bu değeri ezmez
    expect(after.km).toBe(84500); // boş alan dolduruldu
    expect(after.status).toBe("REVIEW");
    const review = parseReview(after.docReview)!;
    expect(review.conflicts.find((c) => c.field === "brand")).toMatchObject({ ruhsat: "Toyota", ekspertiz: "Fiat", labels: ["Araç kaydı", "Yeni belge"] });
  });

  it("personelin işaretlediği kaporta durumu, sonradan eklenen ekspertizle değişmez", async () => {
    const v = await db.vehicle.create({ data: { brand: "Fiat", model: "Egea", status: "DRAFT", createdById: userId } });
    await db.vehiclePart.create({ data: { vehicleId: v.id, part: "TRUNK", state: "ORIGINAL", updatedById: userId } });
    const a = await analysis("ADD", ["EKSPERTIZ"], v.id);
    await runAnalysis(a.id);
    const trunk = await db.vehiclePart.findUniqueOrThrow({ where: { vehicleId_part: { vehicleId: v.id, part: "TRUNK" } } });
    expect(trunk).toMatchObject({ state: "ORIGINAL", reportState: "LOCAL_PAINT" });
  });

  it("stokta aynı plakalı araç varsa uyarır", async () => {
    await db.vehicle.create({ data: { brand: "Fiat", legalPlate: "34ABC123", status: "AVAILABLE", createdById: userId } });
    const v = await db.vehicle.create({ data: { brand: "Fiat", status: "DRAFT", createdById: userId } });
    await db.vehicle.update({ where: { id: v.id }, data: { legalPlate: "34ABC123" } });
    const a = await analysis("ADD", ["EKSPERTIZ"], v.id);
    await runAnalysis(a.id);
    const review = parseReview((await db.vehicle.findUniqueOrThrow({ where: { id: v.id } })).docReview)!;
    expect(review.stockDuplicates).toHaveLength(1);
    expect(review.duplicatesAcknowledged).toBe(false);
  });

  it("kontrol formu (2 sayfa) + ruhsat: form bilgileri CRM alanlarına aktarılır, kaporta personel beyanı olarak yazılır, onaysız kesinleşmez", async () => {
    const a = await analysis("AUTO", ["RUHSAT", "FORM", "FORM"]);
    await runAnalysis(a.id);
    const v = await vehicleOf(a.id);
    expect(v).toMatchObject({
      status: "REVIEW", price: 985000, km: 84500, transmission: "Manuel", drivetrain: "Önden Çekiş", bodyType: "Sedan",
      damageRecord: "MINOR", legalLien: "NONE", warrantyStatus: "NONE", tramerAmount: 12400,
      legalRegisteredToCompany: true, // ruhsattan okunamadı → formdaki personel beyanı (yine de elle kontrol istenir, aşağıda)
    });
    expect(JSON.parse(v.equipment)).toEqual(["ABS", "ESP", "Klima", "Bluetooth", "Geri görüş kamerası"]);
    expect(v.documents.filter((d) => d.kind === "FORM")).toHaveLength(2);
    expect(v.parts.find((p) => p.part === "RIGHT_REAR_FENDER")).toMatchObject({ state: "PAINTED", reportState: "UNKNOWN" });
    expect(v.parts.filter((p) => p.state !== "UNKNOWN")).toHaveLength(13);
    const review = parseReview(v.docReview)!;
    expect(review.aiConfirmed).toBe(false);
    expect(review.aiFields.find((f) => f.field === "price")).toMatchObject({ document: "FORM" });
    expect(review.warnings.some((w) => /e-Devlet ilan yetkisi: gerekmiyor.*EİDS doğrulaması değildir/.test(w))).toBe(true);
    // Ruhsatta sahip okunamadı (ör. yalnızca sol sayfa): Mir Motors stoku galeri adına kabul edilir, ayrıca kontrol istenmez
    expect(review.ownerCheckRequired).toBe(false);
    expect(v.legalRegisteredToCompany).toBe(true);
    // Belge kontrolü tamamlanmadan yayımlanamaz
    await db.vehiclePhoto.create({ data: { vehicleId: v.id, path: "t/f.jpg" } });
    expect(await transitionVehicle(db, admin(), v.id, "publish")).toMatchObject({ ok: false, status: 422 });
  });

  it("ekspertiz ve kontrol formu kaportada çelişirse iki kaynak ayrı tutulur ve çelişki uyarısı yayını engeller", async () => {
    const a = await analysis("AUTO", ["RUHSAT", "EKSPERTIZ", "FORM", "FORM"]);
    await runAnalysis(a.id);
    const v = await vehicleOf(a.id);
    // Simülasyon: ekspertizde bagaj lokal boyalı, formda orijinal
    expect(v.parts.find((p) => p.part === "TRUNK")).toMatchObject({ state: "ORIGINAL", reportState: "LOCAL_PAINT" });
    const { publishChecklist } = await import("@/lib/listing-rules");
    const { toPartMap } = await import("@/lib/body-parts");
    const items = publishChecklist({ v, company: { title: "T", authorizationNo: "T", mersis: null, address: null }, photoCount: 1, staffParts: toPartMap(v.parts), reportParts: toPartMap(v.parts, "reportState"), reviewBlockers: [] });
    expect(items.find((i) => i.key === "partConflicts")).toMatchObject({ ok: false });
    expect(items.find((i) => i.key === "partConflicts")!.reason).toContain("Bagaj");
  });

  it("formun yalnızca 1. sayfası: taslak oluşur, 2. sayfa eksikliği bildirilir, donanım ve satış yetkisi boş kalır", async () => {
    const a = await analysis("AUTO", ["FORM"]);
    await runAnalysis(a.id);
    const v = await vehicleOf(a.id);
    expect(v.equipment).toBe("[]");
    expect(v.legalOwnerConsent).toBe(false);
    const review = parseReview(v.docReview)!;
    expect(review.identity).toBe("SINGLE");
    expect(review.warnings.some((w) => w.includes("2. sayfası"))).toBe(true);
  });

  it("aynı araca sonradan kontrol formu eklemek personelin girdiği değerleri ve kaporta işaretlerini ezmez", async () => {
    const v = await db.vehicle.create({ data: { brand: "Fiat", model: "Egea", km: 90000, price: 1_100_000, status: "DRAFT", equipment: JSON.stringify(["Sunroof"]), createdById: userId } });
    await db.vehiclePart.create({ data: { vehicleId: v.id, part: "RIGHT_REAR_FENDER", state: "ORIGINAL", updatedById: userId } });
    const a = await analysis("ADD", ["FORM", "FORM"], v.id);
    await runAnalysis(a.id);
    const after = await db.vehicle.findUniqueOrThrow({ where: { id: v.id }, include: { parts: true } });
    expect(after).toMatchObject({ km: 90000, price: 1_100_000, damageRecord: "MINOR", status: "REVIEW" });
    expect(JSON.parse(after.equipment)).toEqual(["Sunroof"]);
    expect(after.parts.find((p) => p.part === "RIGHT_REAR_FENDER")?.state).toBe("ORIGINAL"); // personel beyanı korunur
    expect(after.parts.find((p) => p.part === "HOOD")?.state).toBe("ORIGINAL"); // boş parça formdan doldu
    const review = parseReview(after.docReview)!;
    expect(review.conflicts.find((c) => c.field === "km")).toMatchObject({ ruhsat: "90000", ekspertiz: "84500" });
  });

  it("iptal edilen analiz araç oluşturmaz; takılı kalan analiz zaman aşımına düşer", async () => {
    const a = await analysis("RUHSAT", ["RUHSAT"]);
    await db.docAnalysis.update({ where: { id: a.id }, data: { status: "CANCELLED" } });
    await runAnalysis(a.id);
    expect(await db.vehicle.count()).toBe(0);

    const b = await analysis("RUHSAT", ["RUHSAT"]);
    await db.docAnalysis.update({ where: { id: b.id }, data: { status: "ANALYZING" } });
    await db.$executeRaw`UPDATE "DocAnalysis" SET "updatedAt" = NOW() - INTERVAL '10 minutes' WHERE id = ${b.id}`;
    const stale = await getAnalysis(b.id);
    expect(stale?.status).toBe("ERROR");
    expect(stale?.error).toMatch(/Zaman aşımı/);
  });
});
