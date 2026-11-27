import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getVehicle, searchVehicles } from "@/lib/assistant/tools";

// WhatsApp asistanı: plaka boşluklu/boşluksuz, küçük/büyük harfle yazılsa da araç bulunur.
const db = new PrismaClient();
let id = "";

beforeAll(async () => {
  const u = await db.user.create({ data: { name: "plaka", email: `plaka-${Date.now()}@t.test`, passwordHash: "x", role: "SALES" } });
  const v = await db.vehicle.create({
    data: { brand: "Fiat", model: "Egea", year: 2020, price: 700_000, status: "AVAILABLE", legalPlate: "34 MRT 482", createdById: u.id },
  });
  id = v.id;
});
afterAll(async () => {
  await db.vehicle.deleteMany({ where: { id } });
  await db.$disconnect();
});

describe("asistan plaka araması", () => {
  it("kayıtlı plaka boşluklu; bitişik, boşluklu ve küçük harfle bulunur", async () => {
    for (const ref of ["34MRT482", "34 MRT 482", "34 mrt 482", "34-MRT-482"]) {
      expect(await getVehicle(ref)).toContain(`#${id.slice(-6)}`);
    }
    expect(await getVehicle("34 MRT 999")).toMatch(/bulunamadı/);
  });

  it("aramada plaka (tamamı ya da bir kısmı) eşleşir; marka araması bozulmaz", async () => {
    expect(await searchVehicles({ text: "34MRT482" })).toContain(`#${id.slice(-6)}`);
    expect(await searchVehicles({ text: "MRT 482" })).toContain(`#${id.slice(-6)}`);
    expect(await searchVehicles({ text: "fiat egea" })).toContain(`#${id.slice(-6)}`);
  });
});
