"use client";
import { useRef, useState } from "react";
import { VehicleForm, emptyVehicleForm, type VehicleFormValues } from "@/components/crm/VehicleForm";

type Draft = Record<string, unknown> & { equipment: string[]; evidence: { field: string; quote: string }[]; warnings: string[] };
type Result = {
  mode: "LIVE" | "SIMULATION";
  transcript: string | null;
  transcriptSource: "manual" | "whisper" | "sample" | null;
  framesUsed: number;
  draft: Draft;
  videoPath: string;
};

const FORM_KEYS = Object.keys(emptyVehicleForm) as (keyof VehicleFormValues)[];

function toFormValues(d: Draft): { values: Partial<VehicleFormValues>; fields: string[] } {
  const values: Partial<VehicleFormValues> = {};
  const fields: string[] = [];
  for (const k of FORM_KEYS) {
    const val = d[k];
    if (val === null || val === undefined || (Array.isArray(val) && val.length === 0)) continue;
    (values as Record<string, unknown>)[k] = Array.isArray(val) ? val : String(val);
    fields.push(k);
  }
  return { values, fields };
}

export function AiDraftFlow({ live, transcription }: { live: boolean; transcription: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function generate(simulation: boolean) {
    if (!file) return setError("Önce bir video seçin.");
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.append("video", file);
    fd.append("transcript", transcript);
    if (simulation) fd.append("simulation", "1");
    try {
      const res = await fetch("/api/crm/ai-draft", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Taslak oluşturulamadı");
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const { values, fields } = toFormValues(result.draft);
    return (
      <div className="space-y-6">
        <div className={`rounded-lg p-4 text-sm ${result.mode === "SIMULATION" ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-900"}`} data-testid="ai-mode-banner">
          {result.mode === "SIMULATION" ? (
            <><strong>SİMÜLASYON MODU:</strong> Bu taslak canlı AI analizi değildir. Yüklediğiniz video kaydedildi ancak alanlar sabit bir örnek transkript ve örnek AI çıktısından doldurulmuştur.</>
          ) : (
            <><strong>Canlı AI taslağı</strong> ({result.transcriptSource === "whisper" ? "Whisper transkripti" : result.transcriptSource === "manual" ? "elle girilen transkript" : "transkript yok"}{result.framesUsed ? ` + ${result.framesUsed} video karesi` : ""}). Tüm alanları kontrol edin.</>
          )}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="font-semibold">Yüklenen video</h2>
            <video src={`/media/${result.videoPath}`} controls className="mt-3 w-full rounded-lg bg-black" />
          </div>
          <div className="card p-5">
            <h2 className="font-semibold">{result.mode === "SIMULATION" ? "Örnek transkript (simülasyon)" : "Transkript"}</h2>
            <p className="mt-3 max-h-48 overflow-y-auto whitespace-pre-line text-sm text-zinc-700">{result.transcript || "—"}</p>
            {result.draft.warnings.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm text-amber-800">
                {result.draft.warnings.map((w) => <li key={w}>⚠ {w}</li>)}
              </ul>
            )}
            {result.draft.evidence.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-zinc-600">Kanıt alıntıları ({result.draft.evidence.length})</summary>
                <ul className="mt-2 space-y-1 text-zinc-600">
                  {result.draft.evidence.map((e, i) => <li key={i}><strong>{e.field}:</strong> “{e.quote}”</li>)}
                </ul>
              </details>
            )}
          </div>
        </div>
        <VehicleForm
          mode="create"
          initial={values}
          ai={{ mode: result.mode, json: JSON.stringify(result.draft), fields, videoPath: result.videoPath }}
        />
      </div>
    );
  }

  return (
    <div className="card max-w-3xl space-y-5 p-6">
      {!live && (
        <p className="rounded-md bg-amber-100 p-3 text-sm text-amber-900">
          <strong>Simülasyon modu:</strong> ANTHROPIC_API_KEY tanımlı değil. Video gerçekten yüklenir ve araca bağlanır; ancak taslak alanları
          sabit bir örnek transkript ve örnek çıktıdan gelir. Bu, canlı AI analizi değildir.
        </p>
      )}
      {live && !transcription && (
        <p className="rounded-md bg-sky-50 p-3 text-sm text-sky-900">
          Canlı AI etkin. Sesi metne çevirmek için ayrı bir servis (OPENAI_API_KEY → Whisper) tanımlı değil: konuşma dökümünü aşağıya yapıştırın;
          aksi hâlde yalnızca videodan alınan kareler kullanılır.
        </p>
      )}
      <div>
        <span className="label">1. Araç tanıtım videosu</span>
        <input
          ref={input}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          data-testid="ai-video-input"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
        <button type="button" onClick={() => input.current?.click()} className="btn-outline">{file ? "Videoyu değiştir" : "Video seç"}</button>
        {file && <span className="ml-3 text-sm text-zinc-600">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span>}
        {preview && <video src={preview} controls className="mt-3 w-full max-w-lg rounded-lg bg-black" />}
      </div>
      <div>
        <label className="label" htmlFor="transcript">2. Konuşma dökümü (isteğe bağlı)</label>
        <textarea id="transcript" rows={5} value={transcript} onChange={(e) => setTranscript(e.target.value)} className="input" placeholder="Videoda anlatılanları buraya yapıştırabilirsiniz…" />
      </div>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy || !file} onClick={() => generate(false)} className="btn-primary" data-testid="btn-generate-draft">
          {busy ? "İşleniyor…" : live ? "AI ile taslak oluştur" : "Simülasyon taslağı oluştur"}
        </button>
        {live && (
          <button type="button" disabled={busy || !file} onClick={() => generate(true)} className="btn-outline">Simülasyonla dene</button>
        )}
      </div>
      <p className="text-xs text-zinc-500">AI fotoğraf üretmez ve videodan ilan fotoğrafı çıkarmaz. Fotoğrafları taslak kaydedildikten sonra siz yüklersiniz.</p>
    </div>
  );
}
