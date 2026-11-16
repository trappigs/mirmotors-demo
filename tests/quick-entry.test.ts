import { describe, expect, it } from "vitest";
import { COLORS, normalizeColor } from "@/lib/constants";
import { toVehicleData, vehicleInputSchema } from "@/lib/vehicle-schema";

// Hızlı araç girişi: ruhsattaki renk eşlemesi ve takas alanının kayıt kuralları (sentetik değerler).
describe("ruhsat rengi eşleme", () => {
  it("büyük harfli ruhsat rengi listedeki ada çevrilir", () => {
    expect(normalizeColor("BEYAZ")).toBe("Beyaz");
    expect(normalizeColor("GÜMÜŞ GRİ")).toBe("Gümüş Gri");
    expect(normalizeColor("  KIRMIZI ")).toBe("Kırmızı");
    expect(normalizeColor("ŞAMPANYA")).toBe("Şampanya");
  });
  it("kısa adlar listedeki karşılığına eşlenir", () => {
    expect(normalizeColor("GÜMÜŞ")).toBe("Gümüş Gri");
    expect(normalizeColor("KAHVE")).toBe("Kahverengi");
  });
  it("listede olmayan renk silinmez, yalnızca harf düzeni düzelir", () => {
    expect(normalizeColor("METALİK GRİ")).toBe("Metalik Gri");
    expect(COLORS).not.toContain("Metalik Gri");
  });
  it("boş renk boş kalır", () => {
    expect(normalizeColor(null)).toBe("");
    expect(normalizeColor("   ")).toBe("");
  });
});

describe("takas alanı", () => {
  const parse = (o: Record<string, unknown>) => toVehicleData(vehicleInputSchema.parse(o));
  it("formdan gelen Evet / Hayır / boş değerleri", () => {
    expect(parse({ tradeIn: "true" }).tradeIn).toBe(true);
    expect(parse({ tradeIn: "false" }).tradeIn).toBe(false);
    expect(parse({ tradeIn: "" }).tradeIn).toBeNull();
  });
  it("gönderilmezse dokunulmaz (kısmi düzenleme takas bilgisini silmez)", () => {
    expect("tradeIn" in parse({ price: 950000 }) && parse({ price: 950000 }).tradeIn !== undefined).toBe(false);
  });
  it("binlik noktalı fiyat ve kilometre rakama çevrilir", () => {
    expect(parse({ price: "1.250.000", km: "85.000" })).toMatchObject({ price: 1_250_000, km: 85_000 });
  });
});
