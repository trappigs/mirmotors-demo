import "server-only";
import webpush from "web-push";
import { prisma } from "./db";

// Web Push (personel bildirimleri). Anahtarlar yalnızca ortam değişkenlerinden okunur; uydurulmaz.
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT eksikse gönderim sessizce atlanır.

export type PushPayload = { title: string; body: string; url?: string };

function vapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

/** Sunucu anahtarları tanımlı mı? (Tanımlı değilse bildirim gönderilmez.) */
export function pushConfigured(): boolean {
  return vapid() !== null;
}

/** Tarayıcının abonelik için kullanacağı genel anahtar (gizli değildir). */
export function pushPublicKey(): string | null {
  return vapid()?.publicKey ?? null;
}

let configuredFor = "";
function ensureConfigured(): boolean {
  const v = vapid();
  if (!v) return false;
  const sig = `${v.subject}|${v.publicKey}`;
  if (configuredFor !== sig) {
    webpush.setVapidDetails(v.subject, v.publicKey, v.privateKey);
    configuredFor = sig;
  }
  return true;
}

/**
 * Abone olan personele bildirim gönderir (işlemi yapan hariç). Hata fırlatmaz: bildirim hiçbir işlemi engellemez.
 * Süresi dolmuş / iptal edilmiş abonelikler (404/410) silinir.
 */
export async function notifyStaff(payload: PushPayload, opts: { exceptUserId?: string } = {}): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    const subs = await prisma.pushSubscription.findMany({
      where: opts.exceptUserId ? { userId: { not: opts.exceptUserId } } : {},
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    if (!subs.length) return;
    const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? "/crm" });
    const gone: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 12, timeout: 10_000 });
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) gone.push(s.id);
          else console.warn("push gönderilemedi", code ?? (e as Error).message);
        }
      }),
    );
    if (gone.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  } catch (e) {
    console.warn("push bildirimi atlandı", (e as Error).message);
  }
}
