import { timingSafeEqual } from "node:crypto";

/**
 * Akşam özeti (CRM bildirimi): son 24 saatte olanlar + şu an bekleyen işler.
 * Bu dosya saftır (veritabanına dokunmaz); sayımlar daily-summary-db.ts'de yapılır.
 */
export type DailyCounts = {
  created: number; published: number; optioned: number; saleStarted: number; sold: number; cancelled: number;
  waiting: { review: number; draft: number; salePending: number; optioned: number };
  available: number;
  newContacts: number;
};

/** Bildirim metni. Telefon bildiriminde kısa kalsın diye boş satırlar yazılmaz. */
export function buildDailySummary(c: DailyCounts): { title: string; body: string } {
  const day = [
    c.created && `${c.created} yeni kayıt`,
    c.published && `${c.published} yayın`,
    c.optioned && `${c.optioned} opsiyon`,
    c.saleStarted && `${c.saleStarted} satış başladı`,
    c.sold && `${c.sold} satıldı`,
    c.cancelled && `${c.cancelled} satış iptal`,
  ].filter(Boolean);
  const todo = [
    c.waiting.review && `${c.waiting.review} kontrol bekliyor`,
    c.waiting.draft && `${c.waiting.draft} taslak`,
    c.waiting.salePending && `${c.waiting.salePending} noter bekliyor`,
    c.waiting.optioned && `${c.waiting.optioned} opsiyonlu`,
  ].filter(Boolean);
  return {
    title: "Günün özeti",
    body: [
      `Bugün: ${day.length ? day.join(" · ") : "hareket yok"}`,
      `Bekleyen: ${todo.length ? todo.join(" · ") : "yok"}`,
      `Satışta ${c.available} araç${c.newContacts ? ` · ${c.newContacts} kişi WhatsApp'tan yazdı` : ""}`,
    ].join("\n"),
  };
}

/** Zamanlayıcı isteğinin anahtarı ("Authorization: Bearer <CRON_SECRET>"). Anahtar tanımlı değilse hiçbir istek geçmez. */
export function cronAuthorized(header: string | null, secret: string | undefined): boolean {
  const s = secret?.trim();
  if (!s || s.length < 16 || !header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(s);
  return a.length === b.length && timingSafeEqual(a, b);
}
