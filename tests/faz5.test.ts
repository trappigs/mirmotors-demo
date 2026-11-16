import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { transitionVehicle, type Actor } from "@/lib/vehicle-status";
import { PUBLIC_STATUSES, type VehicleStatus } from "@/lib/constants";
import { canEditDetails, mediaChangeBlock } from "@/lib/permissions";
import { BODY_PART_KEYS } from "@/lib/body-parts";

// Faz 5: arşiv (kalıcı silme yerine) ve kolay satış (noter onayı korunur). Sentetik veriler; gerçek plaka/şasi değildir.
const db = new PrismaClient();
let admin: Actor, ali: Actor, veli: Actor;

async function vehicle(status: VehicleStatus = "DRAFT", createdById = ali.id) {
  const v = await db.vehicle.create({
    data: {
      brand: "Renault", model: "Clio", year: 2019, km: 80000, price: 700_000, fuel: "Benzin", transmission: "Manuel", bodyType: "Hatchback",
      vehicleClass: "Otomobil", vehicleType: "FAZ5-TEST", equipment: JSON.stringify(["ABS"]), legalPlate: "00 FZ 005", legalVin: "TEST05",
      damageRecord: "NONE", legalLien: "NONE", warrantyStatus: "NONE", legalRegisteredToCompany: true, status, createdById,
      parts: { create: BODY_PART_KEYS.map((part) => ({ part, state: "ORIGINAL" })) },
    },
  });
  await db.vehiclePhoto.create({ data: { vehicleId: v.id, path: "t/faz5.jpg" } });
  return v.id;
}

const statusOf = async (id: string) => (await db.vehicle.findUniqueOrThrow({ where: { id } })).status;

beforeAll(async () => {
  const mk = (name: string, role: "ADMIN" | "SALES") =>
    db.user.create({ data: { name, email: `${name}@t.test`, passwordHash: "x", role } }).then((u) => ({ id: u.id, role }));
  admin = await mk("faz5-admin", "ADMIN");
  ali = await mk("faz5-ali", "SALES");
  veli = await mk("faz5-veli", "SALES");
});

beforeEach(async () => {
  await db.statusHistory.deleteMany();
  await db.sale.deleteMany();
  await db.vehiclePhoto.deleteMany();
  await db.vehiclePart.deleteMany();
  await db.vehicle.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("arşiv", () => {
  it("taslağı oluşturan personel arşivleyebilir; arşiv bilgileri ve geçmiş yazılır", async () => {
    const id = await vehicle("DRAFT");
    expect(await transitionVehicle(db, ali, id, "archive")).toMatchObject({ ok: true, status: "ARCHIVED" });
    const v = await db.vehicle.findUniqueOrThrow({ where: { id }, include: { history: true } });
    expect(v).toMatchObject({ status: "ARCHIVED", archivedById: ali.id, archivedFromStatus: "DRAFT" });
    expect(v.archivedAt).toBeInstanceOf(Date);
    expect(v.history).toMatchObject([{ fromStatus: "DRAFT", toStatus: "ARCHIVED", action: "archive", userId: ali.id }]);
  });

  it("başka bir satış personeli taslağı arşivleyemez", async () => {
    const id = await vehicle("DRAFT");
    expect(await transitionVehicle(db, veli, id, "archive")).toMatchObject({ ok: false, status: 403 });
    expect(await statusOf(id)).toBe("DRAFT");
  });

  it("satıştaki ilanı satış personeli arşivleyemez, yönetici arşivleyebilir", async () => {
    const id = await vehicle("AVAILABLE");
    expect(await transitionVehicle(db, ali, id, "archive")).toMatchObject({ ok: false, status: 403 });
    expect(await statusOf(id)).toBe("AVAILABLE");
    expect((await transitionVehicle(db, admin, id, "archive")).ok).toBe(true);
    expect(await statusOf(id)).toBe("ARCHIVED");
  });

  it("opsiyonlu, satış sürecindeki ve satılmış araç arşivlenemez", async () => {
    for (const status of ["OPTIONED", "SALE_PENDING", "SOLD"] as const) {
      const id = await vehicle(status);
      expect((await transitionVehicle(db, admin, id, "archive")).ok).toBe(false);
      expect(await statusOf(id)).toBe(status);
    }
  });

  it("yönetici geri yükler: araç Taslak olur, arşiv bilgileri temizlenir", async () => {
    const id = await vehicle("AVAILABLE");
    await transitionVehicle(db, admin, id, "archive");
    expect(await transitionVehicle(db, admin, id, "restore")).toMatchObject({ ok: true, status: "DRAFT" });
    const v = await db.vehicle.findUniqueOrThrow({ where: { id } });
    expect(v).toMatchObject({ status: "DRAFT", archivedAt: null, archivedById: null, archivedFromStatus: null });
    expect(await db.statusHistory.count({ where: { vehicleId: id, action: "restore", fromStatus: "ARCHIVED", toStatus: "DRAFT" } })).toBe(1);
  });

  it("satış personeli arşivden geri yükleyemez", async () => {
    const id = await vehicle("DRAFT");
    await transitionVehicle(db, ali, id, "archive");
    expect(await transitionVehicle(db, ali, id, "restore")).toMatchObject({ ok: false, status: 403 });
    expect(await statusOf(id)).toBe("ARCHIVED");
  });

  it("arşivdeki araç müşteri sitesinde görünmez, düzenlenemez ve yayımlanamaz", async () => {
    expect(PUBLIC_STATUSES).not.toContain("ARCHIVED");
    const id = await vehicle("DRAFT");
    await transitionVehicle(db, ali, id, "archive");
    expect(await db.vehicle.count({ where: { id, status: { in: PUBLIC_STATUSES } } })).toBe(0);
    const v = await db.vehicle.findUniqueOrThrow({ where: { id } });
    expect(canEditDetails(v, admin)).toBe(false);
    expect(mediaChangeBlock(v, admin)).not.toBeNull();
    for (const action of ["publish", "option", "startSale"] as const) {
      expect((await transitionVehicle(db, admin, id, action)).ok).toBe(false);
    }
    expect(await statusOf(id)).toBe("ARCHIVED");
  });
});

describe("kolay satış", () => {
  it("satıştaki araçtan doğrudan satış başlatılır; opsiyon sahibi işlemi yapan olur", async () => {
    const id = await vehicle("AVAILABLE");
    expect(await transitionVehicle(db, veli, id, "startSale", { agreedPrice: 690_000 })).toMatchObject({ ok: true, status: "SALE_PENDING" });
    const v = await db.vehicle.findUniqueOrThrow({ where: { id }, include: { sales: true, history: true } });
    expect(v).toMatchObject({ status: "SALE_PENDING", optionedById: veli.id });
    expect(v.optionedAt).toBeInstanceOf(Date);
    expect(v.sales[0]).toMatchObject({ startedById: veli.id, agreedPrice: 690_000, notaryCompleted: false, completedAt: null });
    expect(v.history).toMatchObject([{ fromStatus: "AVAILABLE", toStatus: "SALE_PENDING", action: "startSale" }]);
    // Satış süreci başladıktan sonra başka personel opsiyonlayamaz / tekrar satış başlatamaz.
    expect((await transitionVehicle(db, ali, id, "option")).ok).toBe(false);
    expect((await transitionVehicle(db, ali, id, "startSale")).ok).toBe(false);
  });

  it("satan personel seçilirse satış notuna yazılır; yetki işlemi yapanda kalır", async () => {
    const id = await vehicle("AVAILABLE");
    expect((await transitionVehicle(db, admin, id, "startSale", { sellerId: ali.id })).ok).toBe(true);
    const sale = await db.sale.findFirstOrThrow({ where: { vehicleId: id } });
    expect(sale).toMatchObject({ startedById: admin.id });
    expect(sale.note).toContain("faz5-ali");
  });

  it("noter onayı olmadan satış tamamlanmaz (SALE_PENDING ≠ SOLD)", async () => {
    const id = await vehicle("AVAILABLE");
    await transitionVehicle(db, ali, id, "startSale");
    expect(await transitionVehicle(db, ali, id, "completeSale")).toMatchObject({ ok: false, status: 422 });
    expect(await transitionVehicle(db, ali, id, "completeSale", { notaryCompleted: false })).toMatchObject({ ok: false, status: 422 });
    expect(await statusOf(id)).toBe("SALE_PENDING");
    expect((await transitionVehicle(db, ali, id, "completeSale", { notaryCompleted: true })).ok).toBe(true);
    expect(await statusOf(id)).toBe("SOLD");
  });

  it("eşzamanlı iki doğrudan satış isteğinden yalnızca biri başarılı olur", async () => {
    const id = await vehicle("AVAILABLE");
    const results = await Promise.all([
      transitionVehicle(db, ali, id, "startSale").catch(() => ({ ok: false as const })),
      transitionVehicle(db, veli, id, "startSale").catch(() => ({ ok: false as const })),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.sale.count({ where: { vehicleId: id } })).toBe(1);
  });
});
