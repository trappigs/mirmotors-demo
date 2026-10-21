import { NextResponse } from "next/server";
import path from "path";
import { requireApiUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { PUBLIC_DIR, saveUpload } from "@/lib/storage";
import { aiStatus, generateDraft, simulationResult, transcribe, type DraftResult } from "@/lib/ai/vehicle-draft";
import { extractFrames } from "@/lib/ai/frames";

export const maxDuration = 300;

/**
 * Video (+ isteğe bağlı transkript) alır, videoyu kaydeder ve araç taslağı üretir.
 * - ANTHROPIC_API_KEY yoksa: SİMÜLASYON (sabit örnek transkript ve çıktı), açıkça işaretlenir.
 * - Varsa: transkript (elle girilen veya OPENAI_API_KEY ile Whisper) + videodan kareler Claude'a gönderilir.
 */
export async function POST(req: Request) {
  try {
    await requireApiUser();
    const form = await req.formData();
    const video = form.get("video");
    if (!(video instanceof File)) return jsonError("Video seçilmedi");
    const forceSimulation = form.get("simulation") === "1";
    const manualTranscript = String(form.get("transcript") ?? "").trim().slice(0, 20000) || null;

    const videoPath = await saveUpload(video, "video", "drafts");
    const status = aiStatus();

    let result: DraftResult;
    if (!status.live || forceSimulation) {
      result = simulationResult();
    } else {
      let transcript = manualTranscript;
      let source: DraftResult["transcriptSource"] = transcript ? "manual" : null;
      // Whisper dosya sınırı 25 MB; daha büyük videolarda transkript elle girilmelidir.
      if (!transcript && status.transcription && video.size <= 25 * 1024 * 1024) {
        transcript = await transcribe(video, video.name);
        source = "whisper";
      }
      const frames = await extractFrames(path.join(PUBLIC_DIR, videoPath));
      if (!transcript && frames.length === 0) {
        return jsonError(
          "Transkript yok ve videodan kare çıkarılamadı. Konuşma dökümünü elle yapıştırın veya OPENAI_API_KEY tanımlayın.",
          422,
        );
      }
      const draft = await generateDraft({ transcript, frames });
      result = { mode: "LIVE", transcript, transcriptSource: source, framesUsed: frames.length, draft };
    }
    return NextResponse.json({ ...result, videoPath });
  } catch (e) {
    return handleApiError(e);
  }
}
