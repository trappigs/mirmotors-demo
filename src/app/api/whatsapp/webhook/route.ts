import { NextResponse, after } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notifyStaff } from "@/lib/push";
import { sendWhatsAppButtons, sendWhatsAppText } from "@/lib/whatsapp-send";
import { answerStaffMessage } from "@/lib/assistant/whatsapp-assistant";
import { cancelPending, executeAction, latestPending, rejectAction } from "@/lib/assistant/actions";
import { isTypedCancel, isTypedConfirm, parseButtonId } from "@/lib/assistant/action-rules";
import { extractMessages, summarizeEvent, verifyChallenge, verifySignature, type IncomingWithTarget } from "@/lib/whatsapp-webhook";

/**
 * WhatsApp Cloud API webhook (Meta uygulaması: MirMotorsWP). Herkese açık adres; korunması imzayla yapılır.
 * WHATSAPP_VERIFY_TOKEN: Meta'daki "Verify token". WHATSAPP_APP_SECRET: uygulamanın App Secret'ı.
 * Mesajlar yalnız imza doğrulanınca kaydedilir. Kayıtlı personelden (User.phone) gelen mesajlara asistan cevap verir
 * (kayıt değiştiren işlem yalnız personel "Onayla" düğmesine basınca ya da "evet" yazınca yapılır);
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
      const { phoneNumberId: _target, replyId: _reply, ...data } = m;
      void _target; void _reply;
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
  const staff = await prisma.user.findMany({ where: { phone: { in: [...new Set(messages.map((m) => m.waId))] } }, select: { id: true, name: true, role: true, phone: true } });
  const staffBy = new Map(staff.map((s) => [s.phone!, s]));

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
    try {
      await answerStaff(m, m.phoneNumberId, staffBy.get(m.waId)!);
    } catch (e) {
      console.error("[whatsapp] personel mesajı işlenemedi", (e as Error).message);
    }
  }
}

async function answerStaff(m: IncomingWithTarget, phoneNumberId: string, staff: { id: string; name: string; role: string }) {
  // 1) Düğmeyle onay/vazgeç: düğme kimliği belirli bir öneriye bağlıdır.
  const button = parseButtonId(m.replyId);
  if (button) {
    return reply(phoneNumberId, m.waId, button.confirm ? await executeAction(m.waId, button.actionId) : await rejectAction(m.waId, button.actionId));
  }
  // 2) Yazılı kısa onay/vazgeç: yalnız geçerli bir bekleyen öneri varsa.
  const pending = await latestPending(m.waId);
  if (pending && m.type === "text" && isTypedConfirm(m.text)) return reply(phoneNumberId, m.waId, await executeAction(m.waId, pending.id));
  if (pending && m.type === "text" && isTypedCancel(m.text)) return reply(phoneNumberId, m.waId, await rejectAction(m.waId, pending.id));
  // 3) Başka her mesaj yeni bir konudur: bekleyen öneri geçersiz olur (eski bir "evet" yanlış işlemi onaylamasın).
  if (pending) await cancelPending(m.waId, "Personel başka bir mesaj yazdı");

  const turnStart = new Date();
  let text: string;
  try {
    text = m.text && m.type === "text"
      ? await answerStaffMessage({ waId: m.waId, staff, text: m.text })
      : "Şimdilik yalnız yazılı mesajları anlayabiliyorum.";
  } catch (e) {
    console.error("[whatsapp] asistan cevap üretemedi", (e as Error).message);
    text = "Şu an cevap veremiyorum, biraz sonra tekrar dener misiniz?";
  }
  // Asistan bu mesajda işlem önerdiyse: onaylanacak metin yapay zekânın serbest cevabı değil, sabit özettir.
  const proposed = await latestPending(m.waId);
  if (proposed && proposed.createdAt >= turnStart) {
    const body = `${proposed.summary}

Onaylıyor musunuz? (10 dk geçerli)`;
    const sent = await sendWhatsAppButtons(phoneNumberId, m.waId, body, [
      { id: `ok:${proposed.id}`, title: "Onayla" },
      { id: `no:${proposed.id}`, title: "Vazgeç" },
    ]);
    if (sent.ok) return store(m.waId, sent.id, "interactive", body);
    console.error("[whatsapp] onay düğmeleri gönderilemedi", sent.error);
    await cancelPending(m.waId, "Onay düğmeleri gönderilemedi");
    return reply(phoneNumberId, m.waId, "Onay düğmeleri gönderilemedi; işlem yapılmadı. CRM'den yapabilir ya da tekrar deneyebilirsiniz.");
  }
  return reply(phoneNumberId, m.waId, text);
}

async function reply(phoneNumberId: string, waId: string, text: string) {
  const sent = await sendWhatsAppText(phoneNumberId, waId, text);
  if (!sent.ok) {
    console.error("[whatsapp] cevap gönderilemedi", sent.error);
    return;
  }
  await store(waId, sent.id, "text", text);
}

async function store(waId: string, id: string | null, type: string, text: string) {
  await prisma.whatsAppMessage.create({
    data: { waMessageId: id ?? `out-${Date.now()}-${waId}`, waId, contactName: null, type, text, sentAt: new Date(), readAt: new Date(), direction: "OUT" },
  });
  console.info("[whatsapp] asistan cevap gönderdi", JSON.stringify({ type, chars: text.length }));
}
