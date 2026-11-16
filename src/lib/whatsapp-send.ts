import "server-only";

/**
 * WhatsApp Cloud API ile metin mesajı gönderir. WHATSAPP_ACCESS_TOKEN (System User token) gerekir.
 * Serbest metin yalnız karşı taraf son 24 saatte yazdıysa iletilir; asistan yalnız gelen mesaja cevap verdiği için bu hep sağlanır.
 */
const GRAPH = "https://graph.facebook.com/v23.0";
const MAX = 4000; // WhatsApp metin sınırı 4096

export async function sendWhatsAppText(phoneNumberId: string, to: string, text: string): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false, error: "WHATSAPP_ACCESS_TOKEN tanımlı değil" };
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text.slice(0, MAX), preview_url: false } }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => null)) as { messages?: { id?: string }[]; error?: { message?: string; code?: number } } | null;
    if (!res.ok) return { ok: false, error: `${res.status} ${data?.error?.code ?? ""} ${data?.error?.message ?? ""}`.trim() };
    return { ok: true, id: data?.messages?.[0]?.id ?? null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
