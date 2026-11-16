import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * WhatsApp Cloud API webhook yardımcıları (saf fonksiyonlar, birim testli).
 * Meta abonelik doğrulaması: GET ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…
 * Olay teslimi: POST, gövde X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, ham gövde).
 */

/** Doğrulama isteği geçerliyse Meta'ya aynen geri dönülecek challenge değeri, değilse null. */
export function verifyChallenge(params: URLSearchParams, expectedToken: string | undefined): string | null {
  if (!expectedToken) return null;
  if (params.get("hub.mode") !== "subscribe") return null;
  const token = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge");
  if (!challenge || !safeEqual(token, expectedToken)) return null;
  return challenge;
}

/** Gövde imzası app secret ile üretilmiş mi (sabit süreli karşılaştırma). */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return safeEqual(header, expected);
}

/**
 * Günlüğe yazılacak özet: yalnız olay türleri ve sayılar. Telefon numarası, isim ve mesaj içeriği
 * (kişisel veri) günlüğe yazılmaz.
 */
export function summarizeEvent(body: unknown): { object: string; messages: number; statuses: number; fields: string[] } {
  const b = (body ?? {}) as { object?: unknown; entry?: { changes?: { field?: unknown; value?: { messages?: unknown[]; statuses?: unknown[] } }[] }[] };
  const fields = new Set<string>();
  let messages = 0;
  let statuses = 0;
  for (const e of Array.isArray(b.entry) ? b.entry : []) {
    for (const c of Array.isArray(e?.changes) ? e.changes : []) {
      if (typeof c?.field === "string") fields.add(c.field);
      if (Array.isArray(c?.value?.messages)) messages += c.value.messages.length;
      if (Array.isArray(c?.value?.statuses)) statuses += c.value.statuses.length;
    }
  }
  return { object: typeof b.object === "string" ? b.object : "?", messages, statuses, fields: [...fields] };
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
