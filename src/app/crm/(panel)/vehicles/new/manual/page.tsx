import Link from "next/link";
import { VehicleForm } from "@/components/crm/VehicleForm";

export default function ManualNewVehiclePage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/crm/vehicles/new" className="text-sm text-zinc-500 hover:text-ink">← Giriş yöntemi</Link>
        <h1 className="mt-2 font-display text-2xl font-bold">Manuel araç girişi</h1>
        <p className="text-sm text-zinc-500">Araç önce taslak olarak kaydedilir. Sonraki adımda fotoğrafları yükleyip yayımlayabilirsiniz.</p>
      </div>
      <VehicleForm mode="create" />
    </div>
  );
}
