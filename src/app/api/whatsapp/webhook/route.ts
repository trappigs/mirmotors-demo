import { NextResponse, after } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notifyStaff } from "@/lib/push";
import { sendWhatsAppText } from "@/lib/whatsapp-send";
import { answerStaffMessage } from "@/lib/assistant/whatsapp-assistant";
import { extractMessages, summarizeEvent, verifyChallenge, verifySignature, type IncomingWithTarget } from "@/lib/whatsapp-webhook";

/**
 * WhatsApp Cloud API webhook (Meta uygulaması: MirMotorsWP). Herkese açık adres; korunması imzayla yapılır.
 * WHATSAPP_VERIFY_TOKEN: Meta'daki "Verify token". WHATSAPP_APP_SECRET: uygulamanın App Secret'ı.
 * Mesajlar yalnız imza doğrulanınca kaydedilir. Kayıtlı personelden (User.phone) gelen mesajlara asistan cevap verir;
 * diğer numaralara cevap verilmez, yalnız CRM > Mesajlar'da görünür. Günlüğe yalnız sayılar yazılır.
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
    // İmza doğrulanamıyorsa sahte mesaj girebilir: kaydedilmez, cevaplanmaz.
    console.warn("[whatsapp] WHATSAPP_APP_SECRET tanımlı değil; mesajlar kaydedilmedi");
    return new NextResponse("OK", { status: 200 });
  }

  const fresh: IncomingWithTarget[] = [];
  try {
    for (const m of extractMessages(body)) {
      const { phoneNumberId: _target, ...data } = m;
      void _target;
      try {
        await prisma.whatsAppMessage.create({ data });
        fresh.push(m);
      } catch (e) {
        // Meta aynı olayı tekrar gönderebilir: zaten kayıtlı mesaj ikinci kez işlenmez (cevap da ikinci kez gitmez).
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      }
    }
  } catch (e) {
    // 500 dönülürse Meta olayı daha sonra yeniden gönderir; mesaj kaybolmaz.
    console.error("[whatsapp] mesaj kaydedilemedi", (e as Error).message);
    return new NextResponse("Retry", { status: 500 });
  }

  if (fresh.length) {
    // Cevap üretimi saniyeler sürebilir; Meta'ya hemen 200 dönülür, iş yanıttan sonra yapılır.
    after(() => handleFresh(fresh));
  }
  return new NextResponse("OK", { status: 200 });
}

async function handleFresh(messages: IncomingWithTarget[]) {
  const staff = await prisma.user.findMany({ where: { phone: { in: [...new Set(messages.map((m) => m.waId))] } }, select: { name: true, phone: true } });
  const staffBy = new Map(staff.map((s) => [s.phone!, s.name]));

  const outsiders = messages.filter((m) => !staffBy.has(m.waId));
  if (outsiders.length) {
    const others = new Set(outsiders.map((m) => m.waId)).size - 1;
    await notifyStaff({
      title: "Yeni WhatsApp mesajı",
      body: `${outsiders[0].contactName ?? "Kayıtlı olmayan numara"}${others > 0 ? ` ve ${others} kişi daha` : ""} yazdı`,
      url: `/crm/mesajlar?k=${outsiders[0].waId}`,
    });
  }

  // Personel: aynı anda birkaç mesaj geldiyse kişi başına tek cevap (son mesaja, geçmişle birlikte).
  const lastByStaff = new Map<string, IncomingWithTarget>();
  for (const m of messages) if (staffBy.has(m.waId)) lastByStaff.set(m.waId, m);
  for (const m of lastByStaff.values()) {
    if (!m.phoneNumberId) continue;
    let reply: string;
    try {
      reply = m.text && m.type === "text"
        ? await answerStaffMessage({ waId: m.waId, staffName: staffBy.get(m.waId)!, text: m.text })
        : "Şimdilik yalnız yazılı mesajları anlayabiliyorum.";
    } catch (e) {
      console.error("[whatsapp] asistan cevap üretemedi", (e as Error).message);
      reply = "Şu an cevap veremiyorum, biraz sonra tekrar dener misiniz?";
    }
    const sent = await sendWhatsAppText(m.phoneNumberId, m.waId, reply);
    if (!sent.ok) {
      console.error("[whatsapp] cevap gönderilemedi", sent.error);
      continue;
    }
    await prisma.whatsAppMessage.create({
      data: {
        waMessageId: sent.id ?? `out-${Date.now()}-${m.waId}`,
        waId: m.waId, contactName: null, type: "text", text: reply, sentAt: new Date(), readAt: new Date(), direction: "OUT",
      },
    });
    console.info("[whatsapp] asistan cevap gönderdi", JSON.stringify({ chars: reply.length }));
  }
}
