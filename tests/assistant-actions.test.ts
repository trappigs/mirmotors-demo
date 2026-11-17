import { describe, expect, it } from "vitest";
import { describeAction, isTypedCancel, isTypedConfirm, parseButtonId, precheck } from "../src/lib/assistant/action-rules";
import { extractMessages } from "../src/lib/whatsapp-webhook";

const sales = { id: "u-ahmet", role: "SALES" };
const admin = { id: "u-admin", role: "ADMIN" };
const v = (status: string, optionedById: string | null = null) => ({ status, optionedById });

describe("asistan işlem ön kontrolü", () => {
  it("opsiyon yalnız satıştaki araçta", () => {
    expect(precheck("option", v("AVAILABLE"), sales, null)).toBeNull();
    expect(precheck("option", v("OPTIONED", "u-x"), sales, null)).toMatch(/Satışta/);
    expect(precheck("option", v("SOLD"), admin, null)).toMatch(/satılmış/);
  });

  it("opsiyonu yalnız sahibi ya da yönetici kaldırır", () => {
    expect(precheck("releaseOption", v("OPTIONED", "u-ahmet"), sales, null)).toBeNull();
    expect(precheck("releaseOption", v("OPTIONED", "u-mehmet"), sales, null)).toMatch(/opsiyonlayan/);
    expect(precheck("releaseOption", v("OPTIONED", "u-mehmet"), admin, null)).toBeNull();
  });

  it("satış iptali yalnız yönetici; tamamlama başlatan ya da yönetici", () => {
    expect(precheck("cancelSale", v("SALE_PENDING"), sales, null)).toMatch(/yönetici/);
    expect(precheck("cancelSale", v("SALE_PENDING"), admin, null)).toBeNull();
    expect(precheck("completeSale", v("SALE_PENDING"), sales, "u-ahmet")).toBeNull();
    expect(precheck("completeSale", v("SALE_PENDING"), sales, "u-mehmet")).toMatch(/başlatan/);
    expect(precheck("completeSale", v("AVAILABLE"), admin, null)).toMatch(/önce satış/);
  });

  it("fiyat: zorunlu, geçerli ve satış sürecinde değişmez", () => {
    expect(precheck("setPrice", v("AVAILABLE"), sales, null, 1_250_000)).toBeNull();
    expect(precheck("setPrice", v("AVAILABLE"), sales, null, null)).toMatch(/belirtilmeli/);
    expect(precheck("setPrice", v("AVAILABLE"), sales, null, -5)).toMatch(/geçersiz/);
    expect(precheck("setPrice", v("AVAILABLE"), sales, null, 1.5)).toMatch(/geçersiz/);
    expect(precheck("setPrice", v("SALE_PENDING"), admin, null, 900_000)).toMatch(/değiştirilemez/);
    expect(precheck("setPrice", v("OPTIONED", "u-mehmet"), sales, null, 900_000)).toMatch(/opsiyonlayan/);
    expect(precheck("startSale", v("AVAILABLE"), sales, null)).toBeNull();
  });
});

describe("onay özeti ve cevaplar", () => {
  it("özet işlemi ve fiyatı açıkça yazar", () => {
    expect(describeAction("setPrice", "#abc123 · BMW 320i", 1_000_000, 950_000)).toBe("#abc123 · BMW 320i\n→ *Fiyatı değiştir*: 1.000.000 TL → 950.000 TL.");
    expect(describeAction("completeSale", "#abc123", null)).toMatch(/Noter devrinin tamamlandığını/);
  });

  it("düğme kimliği", () => {
    expect(parseButtonId("ok:cmabc1234567890")).toEqual({ confirm: true, actionId: "cmabc1234567890" });
    expect(parseButtonId("no:cmabc1234567890")).toEqual({ confirm: false, actionId: "cmabc1234567890" });
    expect(parseButtonId("ok:x")).toBeNull();
    expect(parseButtonId("ok:abc; drop")).toBeNull();
    expect(parseButtonId(null)).toBeNull();
  });

  it("yazılı onay yalnız kısa ve açık olunca", () => {
    for (const t of ["evet", "Evet.", " EVET ", "onaylıyorum", "tamam!"]) expect(isTypedConfirm(t)).toBe(true);
    for (const t of ["evet ama fiyatı 900 olsun", "hayır", "", null]) expect(isTypedConfirm(t)).toBe(false);
    for (const t of ["hayır", "Vazgeç", "iptal"]) expect(isTypedCancel(t)).toBe(true);
    expect(isTypedCancel("satışı iptal et")).toBe(false);
  });

  it("düğme cevabının kimliği webhook'tan okunur", () => {
    const body = {
      entry: [{ changes: [{ field: "messages", value: {
        metadata: { phone_number_id: "PNID" },
        messages: [{ id: "wamid.2", from: "905365619652", timestamp: "1763337600", type: "interactive",
          interactive: { type: "button_reply", button_reply: { id: "ok:cmabc1234567890", title: "Onayla" } } }],
      } }] }],
    };
    const [m] = extractMessages(body);
    expect(m.replyId).toBe("ok:cmabc1234567890");
    expect(m.text).toBe("Onayla");
  });
});
