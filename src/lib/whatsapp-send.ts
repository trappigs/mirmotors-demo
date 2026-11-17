import "server-only";

/**
 * WhatsApp Cloud API ile mesaj gönderir. WHATSAPP_ACCESS_TOKEN (System User token) gerekir.
 * Serbest metin ve düğmeli mesaj yalnız karşı taraf son 24 saatte yazdıysa iletilir; asistan yalnız gelen mesaja cevap verdiği için bu hep sağlanır.
 */
const GRAPH = "https://graph.facebook.com/v23.0";
const MAX = 4000; // WhatsApp metin sınırı 4096

type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

async function post(phoneNumberId: string, payload: Record<string, unknown>): Promise<SendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false, error: "WHATSAPP_ACCESS_TOKEN tanımlı değil" };
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => null)) as { messages?: { id?: string }[]; error?: { message?: string; code?: number } } | null;
    if (!res.ok) return { ok: false, error: `${res.status} ${data?.error?.code ?? ""} ${data?.error?.message ?? ""}`.trim() };
    return { ok: true, id: data?.messages?.[0]?.id ?? null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function sendWhatsAppText(phoneNumberId: string, to: string, text: string): Promise<SendResult> {
  return post(phoneNumberId, { to, type: "text", text: { body: text.slice(0, MAX), preview_url: false } });
}

/** Düğmeli mesaj (en çok 3 düğme; başlık ≤20, gövde ≤1024 karakter). Basılan düğmenin kimliği webhook'a geri gelir. */
export function sendWhatsAppButtons(phoneNumberId: string, to: string, body: string, buttons: { id: string; title: string }[]): Promise<SendResult> {
  return post(phoneNumberId, {
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body.slice(0, 1024) },
      action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) } })) },
    },
  });
}
