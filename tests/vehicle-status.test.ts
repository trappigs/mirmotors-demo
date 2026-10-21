import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { transitionVehicle, type Actor } from "@/lib/vehicle-status";

const db = new PrismaClient();
let admin: Actor, ahmet: Actor, mehmet: Actor;

async function newVehicle(status = "DRAFT", photos = 1) {
  const v = await db.vehicle.create({
    data: {
      brand: "BMW", model: "5 Serisi", year: 2022, km: 10000, price: 3_000_000,
      fuel: "Benzin", transmission: "Otomatik", bodyType: "Sedan", status, createdById: admin.id,
    },
  });
  for (let i = 0; i < photos; i++) await db.vehiclePhoto.create({ data: { vehicleId: v.id, path: `t/${i}.jpg` } });
  return v.id;
}

beforeAll(async () => {
  const mk = (name: string, role: "ADMIN" | "SALES") =>
    db.user.create({ data: { name, email: `${name}@t.test`, passwordHash: "x", role } }).then((u) => ({ id: u.id, role }));
  admin = await mk("admin", "ADMIN");
  ahmet = await mk("ahmet", "SALES");
  mehmet = await mk("mehmet", "SALES");
});

beforeEach(async () => {
  await db.statusHistory.deleteMany();
  await db.sale.deleteMany();
  await db.vehiclePhoto.deleteMany();
  await db.vehicle.deleteMany();
});

afterAll(() => db.$disconnect());

describe("yayımlama", () => {
  it("fotoğraf olmadan yayımlanamaz", async () => {
    const id = await newVehicle("DRAFT", 0);
    const r = await transitionVehicle(db, ahmet, id, "publish");
    expect(r.ok).toBe(false);
    expect((await db.vehicle.findUniqueOrThrow({ where: { id } })).status).toBe("DRAFT");
  });

  it("fotoğrafla yayımlanır ve geçmişe yazılır", async () => {
    const id = await newVehicle("DRAFT", 1);
    expect((await transitionVehicle(db, ahmet, id, "publish")).ok).toBe(true);
    const h = await db.statusHistory.findMany({ where: { vehicleId: id } });
    expect(h).toMatchObject([{ fromStatus: "DRAFT", toStatus: "AVAILABLE", userId: ahmet.id }]);
  });
});

describe("opsiyon ve satış", () => {
  it("demo senaryosu: Ahmet opsiyonlar, Mehmet engellenir, satış tamamlanır", async () => {
    const id = await newVehicle("AVAILABLE");
    expect((await transitionVehicle(db, ahmet, id, "option")).ok).toBe(true);

    const mOption = await transitionVehicle(db, mehmet, id, "option");
    expect(mOption).toMatchObject({ ok: false, status: 409 });
    const mSale = await transitionVehicle(db, mehmet, id, "startSale");
    expect(mSale).toMatchObject({ ok: false, status: 409 });
    expect(mSale.ok === false && mSale.error).toContain("ahmet");
    expect((await transitionVehicle(db, mehmet, id, "releaseOption")).ok).toBe(false);

    expect((await transitionVehicle(db, ahmet, id, "startSale", { agreedPrice: 2_950_000 })).ok).toBe(true);
    expect((await transitionVehicle(db, ahmet, id, "completeSale", { notaryCompleted: false })).ok).toBe(false);
    expect((await transitionVehicle(db, mehmet, id, "completeSale", { notaryCompleted: true })).ok).toBe(false);
    expect((await transitionVehicle(db, admin, id, "completeSale", { notaryCompleted: true })).ok).toBe(true);

    const v = await db.vehicle.findUniqueOrThrow({ where: { id }, include: { sales: true, history: true } });
    expect(v.status).toBe("SOLD");
    expect(v.sales[0]).toMatchObject({ startedById: ahmet.id, completedById: admin.id, notaryCompleted: true, agreedPrice: 2_950_000 });
    expect(v.history.map((h) => h.toStatus)).toEqual(["OPTIONED", "SALE_PENDING", "SOLD"]);
  });

  it("satılmış araç tekrar satışa açılamaz / opsiyonlanamaz", async () => {
    const id = await newVehicle("SOLD");
    for (const action of ["option", "releaseOption", "startSale", "cancelSale", "publish", "unpublish"] as const) {
      expect((await transitionVehicle(db, admin, id, action, { notaryCompleted: true })).ok).toBe(false);
    }
    expect((await db.vehicle.findUniqueOrThrow({ where: { id } })).status).toBe("SOLD");
  });

  it("yönetici opsiyonu kaldırabilir, satış personeli başkasınınkini kaldıramaz", async () => {
    const id = await newVehicle("AVAILABLE");
    await transitionVehicle(db, ahmet, id, "option");
    expect((await transitionVehicle(db, mehmet, id, "releaseOption")).ok).toBe(false);
    expect((await transitionVehicle(db, admin, id, "releaseOption")).ok).toBe(true);
    const v = await db.vehicle.findUniqueOrThrow({ where: { id } });
    expect(v).toMatchObject({ status: "AVAILABLE", optionedById: null });
  });

  it("eşzamanlı iki opsiyon isteğinden yalnızca biri başarılı olur", async () => {
    for (let round = 0; round < 5; round++) {
      const id = await newVehicle("AVAILABLE");
      const results = await Promise.all([
        transitionVehicle(db, ahmet, id, "option").catch(() => ({ ok: false as const })),
        transitionVehicle(db, mehmet, id, "option").catch(() => ({ ok: false as const })),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const history = await db.statusHistory.count({ where: { vehicleId: id, action: "option" } });
      expect(history).toBe(1);
    }
  });

  it("eşzamanlı iki satış başlatma isteğinden yalnızca biri başarılı olur", async () => {
    const id = await newVehicle("AVAILABLE");
    await transitionVehicle(db, ahmet, id, "option");
    const results = await Promise.all([
      transitionVehicle(db, ahmet, id, "startSale").catch(() => ({ ok: false as const })),
      transitionVehicle(db, admin, id, "startSale").catch(() => ({ ok: false as const })),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.sale.count({ where: { vehicleId: id } })).toBe(1);
  });
});
