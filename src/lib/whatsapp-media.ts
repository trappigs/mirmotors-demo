import "server-only";

/**
 * WhatsApp'a gönderilen medya dosyasını indirir (Cloud API: önce medya kimliğinden geçici adres, sonra dosya).
 * Geçici adres yalnız token ile ve kısa süre geçerlidir; dosya diske yazılmadan bellekte döner.
 */
const GRAPH = "https://graph.facebook.com/v23.0";
const MAX_BYTES = 10 * 1024 * 1024; // ilan fotoğrafı sınırı (constants UPLOAD_LIMITS.photo)

export async function downloadWhatsAppMedia(mediaId: string): Promise<{ ok: true; data: Buffer; mime: string } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false, error: "WHATSAPP_ACCESS_TOKEN tanımlı değil" };
  if (!/^\d{5,30}$/.test(mediaId)) return { ok: false, error: "Geçersiz medya kimliği" };
  try {
    const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
    const info = (await meta.json().catch(() => null)) as { url?: string; mime_type?: string; file_size?: number } | null;
    if (!meta.ok || !info?.url) return { ok: false, error: `medya bilgisi alınamadı (${meta.status})` };
    if (info.file_size && info.file_size > MAX_BYTES) return { ok: false, error: "Fotoğraf 10 MB'tan büyük" };
    // Adres Meta'nın sunucusunda olmalı: token başka bir adrese gönderilmez.
    const host = new URL(info.url).hostname;
    if (!/(^|\.)(fbsbx\.com|facebook\.com|whatsapp\.net)$/.test(host)) return { ok: false, error: "Beklenmeyen medya adresi" };
    const file = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
    if (!file.ok) return { ok: false, error: `medya indirilemedi (${file.status})` };
    const data = Buffer.from(await file.arrayBuffer());
    if (data.length > MAX_BYTES) return { ok: false, error: "Fotoğraf 10 MB'tan büyük" };
    return { ok: true, data, mime: info.mime_type ?? file.headers.get("content-type") ?? "" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
