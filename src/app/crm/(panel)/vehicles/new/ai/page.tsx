import Link from "next/link";
import { aiStatus } from "@/lib/ai/vehicle-draft";
import { storageDriver } from "@/lib/storage";
import { AiDraftFlow } from "./AiDraftFlow";

export default function AiNewVehiclePage() {
  const s = aiStatus();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/crm/vehicles/new" className="text-sm text-zinc-500 hover:text-ink">← Giriş yöntemi</Link>
        <h1 className="mt-2 font-display text-2xl font-bold">AI ile video üzerinden araç girişi</h1>
        <p className="text-sm text-zinc-500">Video yükle → taslak oluştur → kontrol et ve düzelt → kaydet → fotoğrafları yükle → yayımla</p>
      </div>
      <AiDraftFlow live={s.live && storageDriver() !== "blob"} transcription={s.transcription} direct={storageDriver() === "blob"} />
    </div>
  );
}
