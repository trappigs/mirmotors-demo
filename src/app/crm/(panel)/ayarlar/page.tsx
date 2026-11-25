import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { envCompanyInfo } from "@/lib/listing-rules";
import { formatDateTime } from "@/lib/format";
import { CompanySettingsForm } from "@/components/crm/CompanySettingsForm";
import { NotificationToggle } from "@/components/crm/NotificationToggle";
import { StaffManager, type StaffRow } from "@/components/crm/StaffManager";
import { STAFF_ACTION_LABELS, formatPhone } from "@/lib/staff";
import { formatWaId } from "@/lib/whatsapp-webhook";
import Link from "next/link";

/** Her personelin gördüğü hesap kartı: şifre değiştirme bağlantısı. */
function AccountCard() {
  return (
    <section className="card flex flex-wrap items-center justify-between gap-3 p-6">
      <div>
        <h2 className="font-display text-lg font-semibold">Hesabım</h2>
        <p className="text-sm text-zinc-500">Şifrenizi değiştirin; diğer cihazlardaki oturumlarınız kapanır.</p>
      </div>
      <Link href="/crm/sifre" className="btn-outline">Şifremi değiştir</Link>
    </section>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  // Bildirim ayarı her personel içindir (cihaz bazlı); işletme bilgileri yalnızca yöneticiye görünür.
  if (user.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="font-display text-2xl font-bold">Ayarlar</h1>
        <AccountCard />
        <div id="bildirimler"><NotificationToggle /></div>
      </div>
    );
  }
  const row = await prisma.companySettings.findUnique({ where: { id: "default" }, include: { updatedBy: { select: { name: true } } } });
  const env = envCompanyInfo();
  const assistantNumber = process.env.WHATSAPP_ASSISTANT_NUMBER?.replace(/\D/g, "") || null;
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, phone: true, active: true, lastLoginAt: true, mustChangePassword: true },
  });
  const staff: StaffRow[] = users.map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role as StaffRow["role"], phone: formatPhone(u.phone), active: u.active,
    lastLogin: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : null, mustChangePassword: u.mustChangePassword,
  }));
  const events = await prisma.staffEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { user: { select: { name: true } }, actor: { select: { name: true } } },
  });
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Ayarlar</h1>
        <p className="text-sm text-zinc-500">
          İşletme bilgileri bir kez girilir ve her ilana otomatik eklenir. Belgedeki bilgiyi aynen girin.
        </p>
      </div>
      <CompanySettingsForm
        initial={{ title: row?.title ?? "", authorizationNo: row?.authorizationNo ?? "", mersis: row?.mersis ?? "", address: row?.address ?? "" }}
        fallback={env}
      />
      {row?.updatedAt && <p className="text-xs text-zinc-500">Son değişiklik: {row.updatedBy?.name ?? "—"} · {formatDateTime(row.updatedAt)}</p>}
      <StaffManager staff={staff} meId={user.id} />
      <p className="-mt-3 text-xs text-zinc-500" data-testid="assistant-note">
        WhatsApp asistanı: personelin cep telefonu kayıtlıysa{assistantNumber ? <> <strong>{formatWaId(assistantNumber)}</strong> numarasına</> : " asistan numarasına"} yazdığı mesajları o personel adına cevaplar.
      </p>
      {events.length > 0 && (
        <section className="card p-6" data-testid="staff-events">
          <h2 className="font-display font-semibold">Personel işlemleri</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  <strong>{e.user.name}</strong>: {STAFF_ACTION_LABELS[e.action] ?? e.action}
                  {e.actorId !== e.userId && <span className="text-zinc-500"> · {e.actor.name}</span>}
                </span>
                <span className="text-xs text-zinc-400">{formatDateTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <AccountCard />
      <div id="bildirimler"><NotificationToggle /></div>
    </div>
  );
}
