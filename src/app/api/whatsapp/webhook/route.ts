import { NextResponse } from "next/server";
import { summarizeEvent, verifyChallenge, verifySignature } from "@/lib/whatsapp-webhook";

/**
 * WhatsApp Cloud API webhook (Meta uygulaması: MirMotorsWP). Herkese açık adres; korunması imzayla yapılır.
 * WHATSAPP_VERIFY_TOKEN: Meta'daki "Verify token" ile aynı. WHATSAPP_APP_SECRET: uygulamanın App Secret'ı.
 * Şimdilik olaylar yalnız özet olarak günlüğe yazılır (içerik/numara yazılmaz); CRM'e aktarım ayrı bir iş.
 */
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const challenge = verifyChallenge(new URL(req.url).searchParams, process.env.WHATSAPP_VERIFY_TOKEN);
  if (challenge === null) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (secret) {
    if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), secret)) {
      console.warn("[whatsapp] imzası geçersiz istek reddedildi");
      return new NextResponse("Invalid signature", { status: 401 });
    }
  } else {
    // App secret tanımlanana kadar imza doğrulanamaz: olay işlenmez, yalnız alındığı not edilir.
    console.warn("[whatsapp] WHATSAPP_APP_SECRET tanımlı değil; olay imzasız kabul edildi ve işlenmedi");
  }
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }
  console.info("[whatsapp] olay", JSON.stringify({ signed: !!secret, ...summarizeEvent(body) }));
  // Meta 200 almazsa aynı olayı tekrar tekrar gönderir.
  return new NextResponse("OK", { status: 200 });
}
