import { NextResponse } from "next/server";
import path from "path";
import { requireApiUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { PUBLIC_DIR, saveUpload, storageDriver, verifyDirectUpload } from "@/lib/storage";
import { aiStatus, emptyDraft, generateDraft, simulationResult, transcribe, type DraftResult } from "@/lib/ai/vehicle-draft";
import { extractFrames } from "@/lib/ai/frames";

export const maxDuration = 300;

/**
 * Video (+ isteğe bağlı transkript) alır, videoyu kaydeder ve araç taslağı üretir.
 * - ANTHROPIC_API_KEY yoksa: SİMÜLASYON (sabit örnek transkript ve çıktı), açıkça işaretlenir.
 * - Varsa: transkript (elle girilen veya OPENAI_API_KEY ile Whisper) + videodan kareler Claude'a gönderilir.
 * - Vercel Blob ortamında video tarayıcıdan doğrudan yüklenir ve burada yalnızca yolu gelir; canlı analiz
 *   (yerel dosyadan kare çıkarma) bu ortamda desteklenmez, akış SİMÜLASYON olarak çalışır.
 */
export async function POST(req: Request) {
  try {
    await requireApiUser();
    const form = await req.formData();
    const forceSimulation = form.get("simulation") === "1";
    const manualTranscript = String(form.get("transcript") ?? "").trim().slice(0, 20000) || null;

    const direct = storageDriver() === "blob";
    const video = form.get("video");
    if (!direct && !(video instanceof File)) return jsonError("Video seçilmedi");
    const videoPath = direct
      ? await verifyDirectUpload(form.get("videoPath"), "video", "drafts")
      : await saveUpload(video as File, "video", "drafts");
    const status = aiStatus();

    let result: DraftResult;
    if (!status.live || forceSimulation || direct || !(video instanceof File)) {
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
      // Bilgi çıkarılamasa da işlem hata vermez: boş taslakla devam edilir, personel alanları elle doldurur.
      const draft = !transcript && frames.length === 0
        ? emptyDraft("Videodan konuşma dökümü veya görüntü karesi alınamadı; hiçbir alan doldurulmadı. Bilgileri elle girin.")
        : await generateDraft({ transcript, frames });
      result = { mode: "LIVE", transcript, transcriptSource: source, framesUsed: frames.length, draft };
    }
    return NextResponse.json({ ...result, videoPath });
  } catch (e) {
    return handleApiError(e);
  }
}
