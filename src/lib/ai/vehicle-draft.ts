import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS } from "../constants";
import { SAMPLE_DRAFT, SAMPLE_TRANSCRIPT } from "./simulation";

export const AI_MODEL = "claude-opus-5-5";

/** Canlı AI yalnızca ANTHROPIC_API_KEY tanımlıysa etkindir; aksi hâlde açıkça işaretli simülasyon modu kullanılır. */
export function aiStatus() {
  return {
    live: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    transcription: Boolean(process.env.OPENAI_API_KEY?.trim()),
  };
}

const nStr = z.string().nullable();
const nInt = z.number().int().nullable();

// AI çıktısının şeması. Bilinmeyen her alan null olmalıdır (uydurma yok).
export const vehicleDraftSchema = z.object({
  brand: nStr,
  model: nStr,
  packageName: nStr,
  year: nInt,
  km: nInt,
  price: nInt,
  fuel: z.enum(FUEL_TYPES as [string, ...string[]]).nullable(),
  transmission: z.enum(TRANSMISSIONS as [string, ...string[]]).nullable(),
  bodyType: z.enum(BODY_TYPES as [string, ...string[]]).nullable(),
  color: nStr,
  enginePower: nInt,
  engineCc: nInt,
  drivetrain: nStr,
  equipment: z.array(z.string()),
  paintedParts: nStr,
  changedParts: nStr,
  damageNote: nStr,
  tramerAmount: nInt,
  expertiseSummary: nStr,
  description: nStr,
  evidence: z.array(z.object({ field: z.string(), quote: z.string() })),
  warnings: z.array(z.string()),
});
export type VehicleDraft = z.infer<typeof vehicleDraftSchema>;

export type DraftResult = {
  mode: "LIVE" | "SIMULATION";
  transcript: string | null;
  transcriptSource: "manual" | "whisper" | "sample" | null;
  framesUsed: number;
  draft: VehicleDraft;
};

const SYSTEM = `Sen bir otomobil galerisinin araç giriş asistanısın. Görevin, galeri çalışanının çektiği araç tanıtım videosunun
konuşma dökümünden (ve varsa videodan alınmış birkaç kareden) ilan formu için yapılandırılmış bir TASLAK çıkarmak.

Kurallar:
- Yalnızca dökümde açıkça söylenen veya karelerde açıkça görülen bilgileri yaz. Emin olmadığın her alanı null bırak.
- Fiyat, kilometre, tramer, boya/değişen/hasar ve ekspertiz bilgilerini ASLA tahmin etme; yalnızca dökümde açıkça geçiyorsa yaz.
- Karelerden yalnızca görsel olarak doğrulanabilir bilgileri (renk, kasa tipi gibi) çıkarabilirsin; bunları evidence içinde "kare" olarak belirt.
- Plaka, şasi numarası, kişi adı veya telefon gibi kişisel/tanımlayıcı bilgileri hiçbir alana yazma.
- fuel/transmission/bodyType yalnızca verilen seçeneklerden biri olabilir.
- Doldurduğun her alan için evidence listesine dökümden kısa bir alıntı ekle.
- Çelişkili veya belirsiz noktaları warnings listesine Türkçe olarak yaz.
- description alanına dökümde geçen bilgilere dayanan, abartısız 1-3 cümlelik Türkçe ilan açıklaması yazabilirsin; yeni bilgi ekleme.`;

export async function generateDraft(input: { transcript: string | null; frames: Buffer[] }): Promise<VehicleDraft> {
  const client = new Anthropic();
  const content: Anthropic.ContentBlockParam[] = input.frames.map((f) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: "image/jpeg" as const, data: f.toString("base64") },
  }));
  content.push({
    type: "text",
    text: input.transcript
      ? `Araç tanıtım videosunun konuşma dökümü:\n"""\n${input.transcript}\n"""\n\nBu bilgilerden ilan taslağını çıkar.`
      : "Konuşma dökümü yok. Yalnızca karelerde açıkça görülen bilgileri doldur, diğer her şeyi null bırak.",
  });

  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(vehicleDraftSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new Error("AI isteği reddetti; lütfen manuel giriş yapın.");
  if (!response.parsed_output) throw new Error("AI çıktısı şemaya uygun değil; lütfen manuel giriş yapın.");
  return response.parsed_output;
}

/** Ses → metin: Claude ses işlemez; ayrı bir servis gerekir. OPENAI_API_KEY varsa Whisper kullanılır. */
export async function transcribe(file: Blob, filename: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file, filename);
  fd.append("model", "whisper-1");
  fd.append("language", "tr");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: fd,
  });
  if (!res.ok) throw new Error(`Transkripsiyon servisi hata verdi (${res.status})`);
  const data = (await res.json()) as { text?: string };
  return data.text?.trim() ?? "";
}

export function simulationResult(): DraftResult {
  return { mode: "SIMULATION", transcript: SAMPLE_TRANSCRIPT, transcriptSource: "sample", framesUsed: 0, draft: SAMPLE_DRAFT };
}
