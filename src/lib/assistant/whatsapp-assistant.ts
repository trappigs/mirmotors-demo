import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { prisma } from "../db";
import { AI_MODEL } from "../ai/vehicle-draft";
import { FUEL_TYPES, TRANSMISSIONS, VEHICLE_STATUSES } from "../constants";
import { getVehicle, searchVehicles, stockSummary } from "./tools";

/**
 * Mir Motors WhatsApp asistanı (personel için). Mesajı anlar, CRM'i SALT OKUNUR araçlarla sorgular, kısa Türkçe cevap üretir.
 * Kayıt değiştirmez; değişiklik istenirse CRM'e yönlendirir.
 */

const HISTORY = 10;

function systemPrompt(staffName: string) {
  const today = new Intl.DateTimeFormat("tr-TR", { dateStyle: "full", timeZone: "Europe/Istanbul" }).format(new Date());
  return `Sen Mir Motors (ikinci el otomobil galerisi) çalışanlarının WhatsApp asistanısın. Bugün ${today}. Konuştuğun personel: ${staffName}.

Kurallar:
- Stok, araç, fiyat, durum ve satış sorularını YALNIZCA araçlardan (tools) gelen verilerle cevapla. Veri yoksa "bulamadım" de; asla tahmin etme, uydurma.
- Kayıt değiştiremezsin (fiyat, durum, opsiyon, satış, araç ekleme). Böyle bir istek gelirse bunun henüz WhatsApp'tan yapılamadığını, CRM'den yapılacağını kısaca söyle.
- Cevaplar WhatsApp mesajıdır: kısa, düz Türkçe, gerekirse madde işaretli. Kalın için *yıldız* kullan; tablo ve başlık kullanma.
- Araçları "#abc123" kısa numarasıyla an; personel bu numarayla detay sorabilir.
- Galeriyle ilgisiz konularda kibarca yalnız galeri işlerine yardım edebildiğini söyle.`;
}

function tools() {
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
  ];
}

export async function answerStaffMessage(input: { waId: string; staffName: string; text: string }): Promise<string> {
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
    system: systemPrompt(input.staffName),
    messages,
    tools: tools(),
    max_iterations: 6,
  });
  const text = final.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
  return text || "Bir cevap üretemedim, sorunuzu farklı yazar mısınız?";
}
