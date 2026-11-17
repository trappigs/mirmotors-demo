import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { prisma } from "../db";
import { AI_MODEL } from "../ai/vehicle-draft";
import { FUEL_TYPES, TRANSMISSIONS, VEHICLE_STATUSES } from "../constants";
import { getVehicle, searchVehicles, stockSummary } from "./tools";
import { proposeAction, type Staff } from "./actions";
import { ASSISTANT_ACTIONS } from "./action-rules";

/**
 * Mir Motors WhatsApp asistanı (personel için). Mesajı anlar, CRM'i sorgular, kısa Türkçe cevap üretir.
 * Kayıt değiştiren istekleri yalnız ÖNERİR (propose_action); işlem personel düğmeyle onaylayınca yapılır (./actions.ts).
 */

const HISTORY = 10;

function systemPrompt(staffName: string) {
  const today = new Intl.DateTimeFormat("tr-TR", { dateStyle: "full", timeZone: "Europe/Istanbul" }).format(new Date());
  return `Sen Mir Motors (ikinci el otomobil galerisi) çalışanlarının WhatsApp asistanısın. Bugün ${today}. Konuştuğun personel: ${staffName}.

Kurallar:
- Stok, araç, fiyat, durum ve satış sorularını YALNIZCA araçlardan (tools) gelen verilerle cevapla. Veri yoksa "bulamadım" de; asla tahmin etme, uydurma.
- Şu işlemleri propose_action ile ÖNEREBİLİRSİN: opsiyonla (option), opsiyonu kaldır (releaseOption), satış başlat (startSale, anlaşılan fiyat varsa price), satışı iptal et (cancelSale), satışı tamamla/noter devri bitti (completeSale), fiyat değiştir (setPrice, price zorunlu).
- propose_action işlemi YAPMAZ; personele ayrıca "Onayla / Vazgeç" düğmeleri gider. Öneriden sonra işlemi yapılmış gibi anlatma; yalnız "onayınızı bekliyorum" de.
- Hangi araç olduğu ya da fiyat belirsizse önermeden önce sor; tahminle araç seçme. Fiyatı "1.250.000" ya da "1,25 milyon" gibi yazılsa da tam TL sayısına çevir.
- Bunların dışındaki değişiklikler (araç ekleme, diğer bilgiler, fotoğraf, yayımlama) WhatsApp'tan yapılamaz; CRM'e yönlendir.
- Cevaplar WhatsApp mesajıdır: kısa, düz Türkçe, gerekirse madde işaretli. Kalın için *yıldız* kullan; tablo ve başlık kullanma.
- Araçları "#abc123" kısa numarasıyla an; personel bu numarayla detay sorabilir.
- Galeriyle ilgisiz konularda kibarca yalnız galeri işlerine yardım edebildiğini söyle.`;
}

function tools(ctx: { waId: string; staff: Staff }) {
  return [
    betaZodTool({
      name: "search_vehicles",
      description:
        "Stokta araç arar. text: marka/model/paket/renk/plaka/stok kodu kelimeleri. Varsayılan olarak satılmış ve arşivlenmiş araçlar hariçtir; satılanları da görmek için includeSold=true ya da status=SOLD ver.",
      inputSchema: z.object({
        text: z.string().nullable().optional(),
        status: z.enum(VEHICLE_STATUSES).nullable().optional(),
        color: z.string().nullable().optional(),
        fuel: z.enum(FUEL_TYPES as [string, ...string[]]).nullable().optional(),
        transmission: z.enum(TRANSMISSIONS as [string, ...string[]]).nullable().optional(),
        minPrice: z.number().int().nullable().optional(),
        maxPrice: z.number().int().nullable().optional(),
        minYear: z.number().int().nullable().optional(),
        maxKm: z.number().int().nullable().optional(),
        includeSold: z.boolean().nullable().optional(),
        limit: z.number().int().min(1).max(20).nullable().optional(),
      }),
      run: (a) => searchVehicles(a),
    }),
    betaZodTool({
      name: "get_vehicle",
      description: "Tek aracın ayrıntısı. ref: kısa numara (#abc123), plaka ya da stok kodu.",
      inputSchema: z.object({ ref: z.string().min(2) }),
      run: (a) => getVehicle(a.ref),
    }),
    betaZodTool({
      name: "stock_summary",
      description: "Durumlara göre stok sayıları, son N günde eklenen ve satılan araçlar.",
      inputSchema: z.object({ days: z.number().int().min(1).max(365) }),
      run: (a) => stockSummary(a.days),
    }),
    betaZodTool({
      name: "propose_action",
      description:
        "Kayıt değiştiren bir işlemi personelin onayına sunar (yapmaz). ref: aracın kısa numarası (#abc123), plakası ya da stok kodu. price: setPrice için yeni fiyat (zorunlu), startSale için anlaşılan fiyat (isteğe bağlı), tam TL.",
      inputSchema: z.object({
        ref: z.string().min(2),
        action: z.enum(ASSISTANT_ACTIONS),
        price: z.number().int().positive().nullable().optional(),
      }),
      run: (a) => proposeAction({ waId: ctx.waId, staff: ctx.staff, ref: a.ref, action: a.action, price: a.price }),
    }),
  ];
}

export async function answerStaffMessage(input: { waId: string; staff: Staff; text: string }): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return "Asistan henüz etkin değil: sunucuda yapay zekâ anahtarı tanımlı değil.";
  }
  // Konuşma geçmişi (son mesajlar; en yenisi şu anki mesaj, zaten kayıtlı).
  const rows = await prisma.whatsAppMessage.findMany({
    where: { waId: input.waId, text: { not: null } },
    orderBy: { sentAt: "desc" },
    take: HISTORY,
    select: { direction: true, text: true },
  });
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const r of rows.reverse()) {
    const role = r.direction === "OUT" ? "assistant" : "user";
    const last = messages[messages.length - 1];
    if (last?.role === role) last.content = `${last.content as string}\n${r.text}`;
    else messages.push({ role, content: r.text! });
  }
  while (messages[0]?.role === "assistant") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") messages.push({ role: "user", content: input.text });

  const client = new Anthropic();
  const final = await client.beta.messages.toolRunner({
    model: AI_MODEL,
    max_tokens: 1500,
    system: systemPrompt(input.staff.name),
    messages,
    tools: tools({ waId: input.waId, staff: input.staff }),
    max_iterations: 6,
  });
  const text = final.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
  return text || "Bir cevap üretemedim, sorunuzu farklı yazar mısınız?";
}
