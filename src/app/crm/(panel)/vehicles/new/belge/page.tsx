import Link from "next/link";
import { documentAiStatus } from "@/lib/ai/document-read";
import { storageDriver } from "@/lib/storage";
import { prisma } from "@/lib/db";
import { DocUploadFlow } from "./DocUploadFlow";


export default async function DocNewVehiclePage({ searchParams }: { searchParams: Promise<{ arac?: string; analiz?: string }> }) {
  const sp = await searchParams;
  const vehicle = sp.arac ? await prisma.vehicle.findUnique({ where: { id: sp.arac }, select: { id: true, brand: true, model: true } }) : null;
  const s = documentAiStatus();
  return (
    <div className="space-y-6">
      <div>
        <Link href={vehicle ? `/crm/vehicles/${vehicle.id}` : "/crm/vehicles/new"} className="text-sm text-zinc-500 hover:text-ink">← {vehicle ? "Araca dön" : "Giriş yöntemi"}</Link>
        <h1 className="mt-2 font-display text-2xl font-bold">{vehicle ? "Araca belge ekle" : "Belgelerden araç ekle"}{vehicle && <span className="font-normal text-zinc-500"> · {vehicle.brand} {vehicle.model}</span>}</h1>
        <p className="text-sm text-zinc-500">
          {vehicle ? "Mevcut bilgileriniz korunur; yalnızca boş alanlar doldurulur, farklar size sorulur." : "Belgeleri yükleyin; bilgiler okunur, siz kontrol edip adım adım tamamlarsınız."}
        </p>
      </div>
      <DocUploadFlow vehicleId={vehicle?.id ?? null} live={s.live} direct={storageDriver() === "blob"} resumeId={sp.analiz ?? null} />
    </div>
  );
}
