"use client";
import type { AutosaveStatus } from "@/lib/client-autosave";

const time = (d: Date) => d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

/** Otomatik kayıt durumu: personel bilgilerin kaydedilip kaydedilmediğini her an görür; hata olursa nedeni ve "Tekrar dene" çıkar. */
export function AutosaveBadge({ status, error, savedAt, created = true, onRetry }: {
  status: AutosaveStatus; error: string; savedAt: Date | null; created?: boolean; onRetry: () => void;
}) {
  const base = "flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm";
  if (status === "error") {
    return (
      <div className={`${base} border border-red-200 bg-red-50 text-red-800`} role="alert" data-testid="autosave-status" data-status={status}>
        <span className="font-semibold">Kaydedilemedi:</span> {error}.
        <span className="text-xs">Bilgiler bu cihazda saklanıyor{error.includes("bağlantı") || error.includes("ulaşılamadı") ? ", bağlantı gelince tekrar denenecek" : ""}.</span>
        <button type="button" onClick={onRetry} className="btn-outline ml-auto bg-white py-1 text-xs">Tekrar dene</button>
      </div>
    );
  }
  const text =
    status === "saving" ? "Kaydediliyor…"
    : status === "pending" ? "Değişiklik kaydedilecek…"
    : status === "held" ? "Plaka için seçim bekleniyor; diğer bilgiler kaydedildi"
    : savedAt ? `✓ Taslak kaydedildi · ${time(savedAt)}`
    : created ? "Değişiklikler otomatik kaydedilir" : "Yazmaya başladığınızda taslak otomatik oluşturulur";
  const tone = status === "held" ? "bg-amber-50 text-amber-900" : status === "saved" ? "bg-emerald-50 text-emerald-800" : "bg-zinc-50 text-zinc-600";
  return (
    <div className={`${base} ${tone}`} role="status" aria-live="polite" data-testid="autosave-status" data-status={status}>
      {text}
    </div>
  );
}
