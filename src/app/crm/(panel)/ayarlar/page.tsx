import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { envCompanyInfo } from "@/lib/listing-rules";
import { formatDateTime } from "@/lib/format";
import { CompanySettingsForm } from "@/components/crm/CompanySettingsForm";
import { NotificationToggle } from "@/components/crm/NotificationToggle";
import { StaffPhonesForm } from "@/components/crm/StaffPhonesForm";
import { formatWaId } from "@/lib/whatsapp-webhook";

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
  const staff = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, phone: true } });
  const assistantNumber = process.env.WHATSAPP_ASSISTANT_NUMBER?.replace(/\D/g, "") || null;
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
      <StaffPhonesForm users={staff.map((u) => ({ id: u.id, name: u.name, phone: u.phone ? formatWaId(u.phone) : "" }))} assistantNumber={assistantNumber ? formatWaId(assistantNumber) : null} />
      <div id="bildirimler"><NotificationToggle /></div>
    </div>
  );
}
