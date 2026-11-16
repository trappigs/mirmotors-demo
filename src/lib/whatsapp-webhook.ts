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

export type IncomingMessage = { waMessageId: string; waId: string; contactName: string | null; type: string; text: string | null; sentAt: Date };

const TYPE_LABELS: Record<string, string> = {
  image: "Fotoğraf", audio: "Ses kaydı", video: "Video", document: "Belge", sticker: "Çıkartma",
  location: "Konum", contacts: "Kişi kartı", reaction: "Tepki", unsupported: "Desteklenmeyen mesaj",
};
/** CRM'de mesaj türünün okunur adı (metin olmayan mesajlar için). */
export const messageTypeLabel = (type: string) => TYPE_LABELS[type] ?? type;

const MAX_TEXT = 4000;

/**
 * Webhook gövdesindeki gelen müşteri mesajlarını çıkarır (durum güncellemeleri hariç).
 * Metin: text.body; medya/düğme mesajlarında açıklama ya da seçilen düğme metni. Medya dosyası alınmaz.
 */
export function extractMessages(body: unknown): IncomingMessage[] {
  const out: IncomingMessage[] = [];
  const entries = (body as { entry?: unknown })?.entry;
  for (const e of Array.isArray(entries) ? entries : []) {
    const changes = (e as { changes?: unknown })?.changes;
    for (const c of Array.isArray(changes) ? changes : []) {
      // Meta'nın gövdesi dış kaynaklıdır: her alan tek tek tür kontrolünden geçirilir.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (c as { field?: string; value?: any })?.value;
      if ((c as { field?: string })?.field !== "messages" || !value || typeof value !== "object") continue;
      const names = new Map<string, string>();
      for (const ct of Array.isArray(value.contacts) ? value.contacts : []) {
        const name = ct?.profile?.name;
        if (typeof ct?.wa_id === "string" && typeof name === "string") names.set(ct.wa_id, name);
      }
      for (const m of Array.isArray(value.messages) ? value.messages : []) {
        if (typeof m?.id !== "string" || typeof m?.from !== "string") continue;
        const waId = m.from.replace(/\D/g, "");
        if (!waId) continue;
        const type = typeof m.type === "string" ? m.type : "unknown";
        const raw =
          m.text?.body ?? m[type]?.caption ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ??
          (type === "reaction" ? m.reaction?.emoji : undefined) ?? (type === "location" ? [m.location?.name, m.location?.address].filter(Boolean).join(" · ") || undefined : undefined);
        const text = typeof raw === "string" && raw.trim() ? raw.slice(0, MAX_TEXT) : null;
        const ts = Number(m.timestamp);
        out.push({
          waMessageId: m.id,
          waId,
          contactName: names.get(m.from) ?? names.get(waId) ?? null,
          type,
          text,
          sentAt: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : new Date(),
        });
      }
    }
  }
  return out;
}

/** Numarayı okunur biçimde gösterir: 905321234567 → +90 532 123 45 67 (TR dışı numaralar yalnız + ile). */
export function formatWaId(waId: string): string {
  const m = /^90(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(waId);
  return m ? `+90 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${waId}`;
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
