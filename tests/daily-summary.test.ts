import { describe, expect, it } from "vitest";
import { buildDailySummary, cronAuthorized } from "../src/lib/daily-summary";

const empty = { created: 0, published: 0, optioned: 0, saleStarted: 0, sold: 0, cancelled: 0, waiting: { review: 0, draft: 0, salePending: 0, optioned: 0 }, available: 0, newContacts: 0 };

describe("akşam özeti", () => {
  it("yalnız olan hareketleri yazar", () => {
    const s = buildDailySummary({ ...empty, created: 2, sold: 1, waiting: { ...empty.waiting, review: 3, salePending: 1 }, available: 14, newContacts: 2 });
    expect(s.title).toBe("Günün özeti");
    expect(s.body).toBe("Bugün: 2 yeni kayıt · 1 satıldı\nBekleyen: 3 kontrol bekliyor · 1 noter bekliyor\nSatışta 14 araç · 2 kişi WhatsApp'tan yazdı");
  });

  it("hareketsiz günde de anlaşılır", () => {
    expect(buildDailySummary({ ...empty, available: 5 }).body).toBe("Bugün: hareket yok\nBekleyen: yok\nSatışta 5 araç");
  });
});

describe("zamanlayıcı anahtarı", () => {
  const secret = "a".repeat(32);
  it("doğru anahtarla geçer", () => expect(cronAuthorized(`Bearer ${secret}`, secret)).toBe(true));
  it("yanlış, eksik ya da tanımsız anahtarla geçmez", () => {
    expect(cronAuthorized(`Bearer ${"b".repeat(32)}`, secret)).toBe(false);
    expect(cronAuthorized(null, secret)).toBe(false);
    expect(cronAuthorized(`Bearer ${secret}`, undefined)).toBe(false);
    expect(cronAuthorized("Bearer ", "")).toBe(false);
    expect(cronAuthorized("Bearer kisa", "kisa")).toBe(false);
  });
});
