import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { notifyStaff } from "../push";
import { formatPrice, vehicleTitle } from "../format";
import { transitionVehicle } from "../vehicle-status";
import { CONFIRM_TTL_MS, describeAction, precheck, type AssistantActionName } from "./action-rules";
import { LINE_SELECT, refWhere, vehicleLine } from "./tools";

/**
 * WhatsApp asistanının kayıt değiştiren işlemleri (2. aşama). Yapay zekâ işlemi YAPAMAZ, yalnız ÖNERİR:
 * öneri AssistantAction olarak kaydedilir, personele sabit bir özet ve "Onayla / Vazgeç" düğmeleri gider.
 * İşlem yalnız personel onaylayınca, CRM'in kendi kurallarıyla (transitionVehicle / düzenleme kuralları) yapılır.
 */

const NOTE = "WhatsApp asistanı üzerinden";

export type Staff = { id: string; name: string; role: string };

export async function proposeAction(input: { waId: string; staff: Staff; ref: string; action: AssistantActionName; price?: number | null }): Promise<string> {
  const matches = await prisma.vehicle.findMany({ where: refWhere(input.ref), select: { ...LINE_SELECT, optionedById: true }, take: 2 });
  if (!matches.length) return "Bu numara/plaka/stok koduyla araç bulunamadı. İşlem önerilmedi.";
  if (matches.length > 1) return "Bu bilgiyle birden çok araç eşleşti; aracın #kısa numarasını sor. İşlem önerilmedi.";
  const v = matches[0];
  const sale = input.action === "completeSale"
    ? await prisma.sale.findFirst({ where: { vehicleId: v.id, completedAt: null, cancelledAt: null }, select: { startedById: true } })
    : null;
  const price = input.action === "setPrice" || input.action === "startSale" ? input.price ?? null : null;
  const blocked = precheck(input.action, v, { id: input.staff.id, role: input.staff.role }, sale?.startedById ?? null, price);
  if (blocked) return `Yapılamaz: ${blocked} İşlem önerilmedi.`;
  if (input.action === "setPrice" && price === v.price) return `Aracın fiyatı zaten ${formatPrice(price)}. İşlem önerilmedi.`;

  const summary = describeAction(input.action, vehicleLine(v), v.price, price);
  // Personel başına tek bekleyen öneri: yenisi eskisini geçersiz kılar.
  await prisma.assistantAction.updateMany({ where: { waId: input.waId, status: "PENDING" }, data: { status: "CANCELLED", result: "Yeni öneriyle değişti" } });
  await prisma.assistantAction.create({
    data: {
      waId: input.waId, userId: input.staff.id, vehicleId: v.id, action: input.action, price, summary,
      expiresAt: new Date(Date.now() + CONFIRM_TTL_MS),
    },
  });
  return `Öneri kaydedildi; personele onay düğmeleri ayrıca gönderilecek. Özet:\n${summary}\nBu işlemi yapıldı gibi anlatma; onay bekliyor.`;
}

/** Bu personelin geçerli (süresi dolmamış) bekleyen önerisi. */
export function latestPending(waId: string) {
  return prisma.assistantAction.findFirst({ where: { waId, status: "PENDING", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
}

/** Personelin yeni (onay dışı) mesajı bekleyen öneriyi geçersiz kılar: eski bir "evet" yanlış işlemi onaylamasın. */
export async function cancelPending(waId: string, reason: string): Promise<number> {
  const r = await prisma.assistantAction.updateMany({ where: { waId, status: "PENDING" }, data: { status: "CANCELLED", result: reason } });
  return r.count;
}

export async function rejectAction(waId: string, actionId: string): Promise<string> {
  const r = await prisma.assistantAction.updateMany({ where: { id: actionId, waId, status: "PENDING" }, data: { status: "CANCELLED", result: "Personel vazgeçti" } });
  return r.count ? "Tamam, işlem yapılmadı." : "Bu öneri artık geçerli değil; bir şey yapılmadı.";
}

/** Onaylanan öneriyi yapar. Aynı onay iki kez gelirse (çift dokunma, Meta'nın tekrarı) yalnız biri işler. */
export async function executeAction(waId: string, actionId: string): Promise<string> {
  const a = await prisma.assistantAction.findFirst({ where: { id: actionId, waId } });
  if (!a) return "Bu öneri bulunamadı; bir şey yapılmadı.";
  if (a.status !== "PENDING") return a.status === "DONE" ? "Bu işlem zaten yapıldı." : "Bu öneri artık geçerli değil; bir şey yapılmadı.";
  if (a.expiresAt <= new Date()) {
    await prisma.assistantAction.updateMany({ where: { id: a.id, status: "PENDING" }, data: { status: "CANCELLED", result: "Süresi doldu" } });
    return "Onay süresi (10 dk) doldu; bir şey yapılmadı. İşlemi yeniden isteyin.";
  }
  const claimed = await prisma.assistantAction.updateMany({ where: { id: a.id, status: "PENDING" }, data: { status: "RUNNING" } });
  if (claimed.count !== 1) return "Bu öneri zaten işleniyor.";

  // Yetki, onay anındaki kullanıcı kaydına göre: bu arada rolü değişen ya da numarası silinen personel işlem yapamaz.
  const user = await prisma.user.findFirst({ where: { id: a.userId, phone: waId }, select: { id: true, name: true, role: true } });
  let ok = false;
  let message: string;
  try {
    if (!user) message = "Numaranız artık bir personel kaydına bağlı değil; işlem yapılmadı.";
    else if (a.action === "setPrice") ({ ok, message } = await setPrice(a.vehicleId, a.price!, user));
    else {
      const actor = { id: user.id, role: user.role as "ADMIN" | "SALES" };
      const r = await transitionVehicle(prisma, actor, a.vehicleId, a.action as Exclude<AssistantActionName, "setPrice">, {
        note: NOTE,
        agreedPrice: a.action === "startSale" ? a.price ?? undefined : undefined,
        notaryCompleted: a.action === "completeSale" ? true : undefined,
      });
      ok = r.ok;
      message = r.ok ? "" : r.error;
    }
  } catch (e) {
    console.error("[whatsapp] asistan işlemi hata verdi", (e as Error).message);
    message = "İşlem sırasında bir hata oldu; kayıt değişmedi. CRM'den kontrol edin.";
  }
  await prisma.assistantAction.update({ where: { id: a.id }, data: { status: ok ? "DONE" : "FAILED", result: ok ? null : message, doneAt: new Date() } });
  if (!ok) return `Yapılamadı: ${message}`;

  afterChange(a.vehicleId, a.action, user!).catch((e) => console.warn("[whatsapp] bildirim atlandı", (e as Error).message));
  return `✅ Yapıldı.\n${a.summary.replace(/\n→ /, "\n")}\nCRM: /crm/vehicles/${a.vehicleId}`;
}

/** Fiyat değişikliği: CRM düzenleme kurallarıyla aynı koşullar, tek koşullu UPDATE (arada değişen fiyat ezilmez). */
async function setPrice(vehicleId: string, price: number, user: Staff): Promise<{ ok: boolean; message: string }> {
  return prisma.$transaction(async (tx) => {
    const v = await tx.vehicle.findUnique({ where: { id: vehicleId }, select: { status: true, price: true, optionedById: true } });
    if (!v) return { ok: false, message: "Araç bulunamadı." };
    const blocked = precheck("setPrice", v, user, null, price);
    if (blocked) return { ok: false, message: blocked };
    const r = await tx.vehicle.updateMany({ where: { id: vehicleId, status: v.status, price: v.price }, data: { price } });
    if (r.count !== 1) return { ok: false, message: "Araç bu arada değişti; tekrar deneyin." };
    await tx.statusHistory.create({
      data: { vehicleId, fromStatus: v.status, toStatus: v.status, action: "edit", userId: user.id, note: `Fiyat: ${formatPrice(v.price)} → ${formatPrice(price)} (${NOTE})` },
    });
    return { ok: true, message: "" };
  });
}

const PUSH_TITLES: Partial<Record<string, string>> = {
  option: "Araç opsiyonlandı",
  releaseOption: "Opsiyon kaldırıldı",
  completeSale: "Araç satıldı",
  setPrice: "Fiyat değişti",
};

async function afterChange(vehicleId: string, action: string, user: Staff) {
  for (const p of ["/", "/araclar", `/araclar/${vehicleId}`]) {
    try {
      revalidatePath(p);
    } catch {
      // Müşteri sitesi zaten dinamik; önbellek temizliği yapılamazsa işlem etkilenmez.
    }
  }
  const title = PUSH_TITLES[action];
  if (!title) return;
  const v = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { brand: true, model: true, year: true } });
  await notifyStaff(
    { title, body: `${[v ? vehicleTitle(v) : null, v?.year].filter(Boolean).join(" ")} · ${user.name} (WhatsApp)`, url: `/crm/vehicles/${vehicleId}` },
    { exceptUserId: user.id },
  );
}
