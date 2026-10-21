import Link from "next/link";
import { aiStatus } from "@/lib/ai/vehicle-draft";

export default function NewVehicleChooser() {
  const ai = aiStatus();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-bold">Yeni araç ekle</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/crm/vehicles/new/manual" className="card block p-6 transition hover:border-zinc-900" data-testid="choose-manual">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">A · Önerilen</p>
          <h2 className="mt-2 font-display text-xl font-semibold">Manuel giriş</h2>
          <p className="mt-2 text-sm text-zinc-600">Araç bilgilerini formdan girin, ardından fotoğraf, video ve ekspertiz belgesini yükleyip yayımlayın.</p>
        </Link>
        <Link href="/crm/vehicles/new/ai" className="card block p-6 transition hover:border-zinc-900" data-testid="choose-ai">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            B · {ai.live ? "Canlı AI etkin" : "Simülasyon modu"}
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold">AI ile video üzerinden giriş</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Araç tanıtım videosunu yükleyin; konuşma dökümünden yapılandırılmış bir taslak oluşturulur. Tüm alanları siz doğrularsınız.
          </p>
          {!ai.live && <p className="mt-3 text-xs text-amber-700">API anahtarı tanımlı değil: örnek transkript ve örnek AI çıktısı kullanılır.</p>}
        </Link>
      </div>
    </div>
  );
}
