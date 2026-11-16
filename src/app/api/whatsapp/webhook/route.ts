import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyStaff } from "@/lib/push";
import { extractMessages, summarizeEvent, verifyChallenge, verifySignature } from "@/lib/whatsapp-webhook";

/**
 * WhatsApp Cloud API webhook (Meta uygulaması: MirMotorsWP). Herkese açık adres; korunması imzayla yapılır.
 * WHATSAPP_VERIFY_TOKEN: Meta'daki "Verify token" ile aynı. WHATSAPP_APP_SECRET: uygulamanın App Secret'ı.
 * Gelen müşteri mesajları yalnız imza doğrulanınca CRM'e (WhatsAppMessage) kaydedilir; günlüğe yalnız sayılar yazılır.
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
  if (secret && !verifySignature(raw, req.headers.get("x-hub-signature-256"), secret)) {
    console.warn("[whatsapp] imzası geçersiz istek reddedildi");
    return new NextResponse("Invalid signature", { status: 401 });
  }
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }
  console.info("[whatsapp] olay", JSON.stringify({ signed: !!secret, ...summarizeEvent(body) }));
  if (!secret) {
    // İmza doğrulanamıyorsa sahte mesaj CRM'e girebilir: kaydedilmez.
    console.warn("[whatsapp] WHATSAPP_APP_SECRET tanımlı değil; mesajlar kaydedilmedi");
    return new NextResponse("OK", { status: 200 });
  }

  const messages = extractMessages(body);
  if (messages.length) {
    try {
      // Meta aynı olayı tekrar gönderebilir: waMessageId benzersiz, tekrarlar atlanır.
      const { count } = await prisma.whatsAppMessage.createMany({ data: messages, skipDuplicates: true });
      if (count > 0) {
        const first = messages[0];
        const others = new Set(messages.map((m) => m.waId)).size - 1;
        await notifyStaff({
          title: "Yeni WhatsApp mesajı",
          body: `${first.contactName ?? "Müşteri"}${others > 0 ? ` ve ${others} kişi daha` : ""} yazdı`,
          url: `/crm/mesajlar?k=${first.waId}`,
        });
      }
    } catch (e) {
      // 500 dönülürse Meta olayı daha sonra yeniden gönderir; mesaj kaybolmaz.
      console.error("[whatsapp] mesaj kaydedilemedi", (e as Error).message);
      return new NextResponse("Retry", { status: 500 });
    }
  }
  // Meta 200 almazsa aynı olayı tekrar tekrar gönderir.
  return new NextResponse("OK", { status: 200 });
}
