import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { envCompanyInfo } from "@/lib/listing-rules";
import { formatDateTime } from "@/lib/format";
import { CompanySettingsForm } from "@/components/crm/CompanySettingsForm";
import { NotificationToggle } from "@/components/crm/NotificationToggle";

export default async function SettingsPage() {
  const user = await requireUser();
  // Bildirim ayarı her personel içindir (cihaz bazlı); işletme bilgileri yalnızca yöneticiye görünür.
  if (user.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="font-display text-2xl font-bold">Ayarlar</h1>
        <div id="bildirimler"><NotificationToggle /></div>
      </div>
    );
  }
  const row = await prisma.companySettings.findUnique({ where: { id: "default" }, include: { updatedBy: { select: { name: true } } } });
  const env = envCompanyInfo();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">İşletme ayarları</h1>
        <p className="text-sm text-zinc-500">
          Bu bilgiler bir kez girilir ve her ilana otomatik eklenir. Belgedeki bilgiyi aynen girin.
        </p>
      </div>
      <CompanySettingsForm
        initial={{ title: row?.title ?? "", authorizationNo: row?.authorizationNo ?? "", mersis: row?.mersis ?? "", address: row?.address ?? "" }}
        fallback={env}
      />
      {row?.updatedAt && <p className="text-xs text-zinc-500">Son değişiklik: {row.updatedBy?.name ?? "—"} · {formatDateTime(row.updatedAt)}</p>}
      <div id="bildirimler"><NotificationToggle /></div>
    </div>
  );
}
