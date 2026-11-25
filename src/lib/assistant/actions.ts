import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { notifyStaff } from "../push";
import { formatPrice, vehicleTitle } from "../format";
import { transitionVehicle } from "../vehicle-status";
import { vehicleInputSchema, toVehicleData } from "../vehicle-schema";
import { autoListingNo } from "../listing-rules";
import { plateDuplicates } from "../plates";
import { mediaChangeBlock } from "../permissions";
import { deleteStored, saveUpload } from "../storage";
import { downloadWhatsAppMedia } from "../whatsapp-media";
import { CONFIRM_TTL_MS, PHOTO_WINDOW_MS, describeAction, describeNewVehicle, precheck, type AssistantActionName, type NewVehicle } from "./action-rules";
import { LINE_SELECT, refWhere, vehicleLine } from "./tools";

/**
 * WhatsApp asistanının kayıt değiştiren işlemleri (2. aşama). Yapay zekâ işlemi YAPAMAZ, yalnız ÖNERİR:
 * öneri AssistantAction olarak kaydedilir, personele sabit bir özet ve "Onayla / Vazgeç" düğmeleri gider.
 * İşlem yalnız personel onaylayınca, CRM'in kendi kurallarıyla (transitionVehicle / düzenleme kuralları) yapılır.
 * Araç ekleme de aynı onaydan geçer ve araç her zaman TASLAK açılır (sitede görünmez); fotoğraflar sonradan eklenir.
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
  await savePending({ waId: input.waId, userId: input.staff.id, vehicleId: v.id, action: input.action, price, summary });
  return proposedText(summary);
}

const proposedText = (summary: string) =>
  `Öneri kaydedildi; personele onay düğmeleri ayrıca gönderilecek. Özet:\n${summary}\nBu işlemi yapıldı gibi anlatma; onay bekliyor.`;

async function savePending(data: { waId: string; userId: string; vehicleId: string | null; action: string; price?: number | null; payload?: string; summary: string }) {
  // Personel başına tek bekleyen öneri: yenisi eskisini geçersiz kılar.
  await prisma.assistantAction.updateMany({ where: { waId: data.waId, status: "PENDING" }, data: { status: "CANCELLED", result: "Yeni öneriyle değişti" } });
  await prisma.assistantAction.create({ data: { ...data, expiresAt: new Date(Date.now() + CONFIRM_TTL_MS) } });
}

/** Yeni araç önerisi: bilgiler CRM formunun kurallarıyla doğrulanır; aynı plakalı araç varsa önerilmez. */
export async function proposeNewVehicle(input: { waId: string; staff: Staff; vehicle: NewVehicle }): Promise<string> {
  const parsed = vehicleInputSchema.safeParse(input.vehicle);
  if (!parsed.success) return `Bilgiler geçersiz: ${parsed.error.issues.map((i) => i.message).join(", ")}. İşlem önerilmedi.`;
  if (!input.vehicle.brand?.trim() || !input.vehicle.model?.trim()) return "Marka ve model gerekli. İşlem önerilmedi.";
  const dup = await plateDuplicates(prisma, parsed.data.legalPlate);
  if (dup.length) return `Bu plakayla stokta araç var: ${dup.map((d) => `#${d.id.slice(-6)} ${d.title}`).join(", ")}. Yeni kayıt önerilmedi; mükerrer değilse CRM'den açılmalı.`;
  const summary = describeNewVehicle(input.vehicle);
  await savePending({ waId: input.waId, userId: input.staff.id, vehicleId: null, action: "createVehicle", payload: JSON.stringify(input.vehicle), summary });
  return proposedText(summary);
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
  const user = await prisma.user.findFirst({ where: { id: a.userId, phone: `+${waId}`, active: true }, select: { id: true, name: true, role: true } });
  let ok = false;
  let message: string;
  try {
    if (!user) message = "Numaranız artık bir personel kaydına bağlı değil; işlem yapılmadı.";
    else if (a.action === "createVehicle") ({ ok, message } = await createVehicle(a.id, a.payload ?? "{}", user));
    else if (a.action === "setPrice") ({ ok, message } = await setPrice(a.vehicleId!, a.price!, user));
    else {
      const actor = { id: user.id, role: user.role as "ADMIN" | "SALES" };
      const r = await transitionVehicle(prisma, actor, a.vehicleId!, a.action as Exclude<AssistantActionName, "setPrice">, {
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
  await prisma.assistantAction.updateMany({ where: { id: a.id, status: "RUNNING" }, data: { status: ok ? "DONE" : "FAILED", result: ok ? null : message, doneAt: new Date() } });
  if (!ok) return `Yapılamadı: ${message}`;

  if (a.action === "createVehicle") {
    const created = await prisma.assistantAction.findUnique({ where: { id: a.id }, select: { vehicleId: true } });
    return `✅ Taslak açıldı: *#${created!.vehicleId!.slice(-6)}*\nFotoğrafları şimdi bu sohbete gönderebilirsiniz; 1 saat içinde açıklamasız gönderilen fotoğraflar bu araca eklenir. Yayın için eksikleri CRM'de tamamlayın: /crm/vehicles/${created!.vehicleId}`;
  }
  afterChange(a.vehicleId!, a.action, user!).catch((e) => console.warn("[whatsapp] bildirim atlandı", (e as Error).message));
  return `✅ Yapıldı.\n${a.summary.replace(/\n→ /, "\n")}\nCRM: /crm/vehicles/${a.vehicleId}`;
}

/** Onaylanan araç: CRM'deki "yeni araç" ile aynı kayıt (taslak, otomatik ilan no, geçmiş kaydı). */
async function createVehicle(actionId: string, payload: string, user: Staff): Promise<{ ok: boolean; message: string }> {
  const parsed = vehicleInputSchema.safeParse(JSON.parse(payload));
  if (!parsed.success) return { ok: false, message: "Araç bilgileri geçersiz." };
  // Öneriden bu yana aynı plakalı araç açılmış olabilir: onay anında yeniden kontrol edilir.
  const dup = await plateDuplicates(prisma, parsed.data.legalPlate);
  if (dup.length) return { ok: false, message: `Bu plakayla stokta araç var (#${dup[0].id.slice(-6)}).` };
  await prisma.$transaction(async (tx) => {
    const data = Object.fromEntries(Object.entries(toVehicleData(parsed.data)).filter(([, v]) => v !== undefined));
    const created = await tx.vehicle.create({ data: { legalRegisteredToCompany: true, ...data, status: "DRAFT", createdById: user.id } });
    await tx.vehicle.update({ where: { id: created.id }, data: { legalListingNo: autoListingNo(created.id) } });
    await tx.statusHistory.create({ data: { vehicleId: created.id, fromStatus: null, toStatus: "DRAFT", action: "create", userId: user.id, note: NOTE } });
    await tx.assistantAction.update({ where: { id: actionId }, data: { vehicleId: created.id } });
  });
  return { ok: true, message: "" };
}

/**
 * Personelin gönderdiği fotoğrafları araca ekler. Hedef: açıklamadaki "#abc123" ya da yoksa bu personelin son 1 saatte
 * WhatsApp'tan açtığı taslak. Yetki CRM'deki fotoğraf kuralıyla aynıdır (satılmış/arşiv/başkasının opsiyonu engellenir).
 */
export async function attachPhotos(input: { waId: string; staff: Staff; mediaIds: string[]; ref: string | null }): Promise<string> {
  let vehicleId: string | null = null;
  if (input.ref) {
    const matches = await prisma.vehicle.findMany({ where: refWhere(input.ref), select: { id: true }, take: 2 });
    if (matches.length !== 1) return matches.length ? `"#${input.ref}" birden çok araçla eşleşti; fotoğraflar eklenmedi.` : `"#${input.ref}" numaralı araç bulunamadı; fotoğraflar eklenmedi.`;
    vehicleId = matches[0].id;
  } else {
    const recent = await prisma.assistantAction.findFirst({
      where: { waId: input.waId, action: "createVehicle", status: "DONE", doneAt: { gt: new Date(Date.now() - PHOTO_WINDOW_MS) } },
      orderBy: { doneAt: "desc" }, select: { vehicleId: true },
    });
    vehicleId = recent?.vehicleId ?? null;
    if (!vehicleId) return "Fotoğrafın hangi araca ait olduğunu bilmiyorum; fotoğrafı açıklamasına aracın numarasını (ör. #abc123) yazarak tekrar gönderin. Fotoğraf eklenmedi.";
  }

  // İndirmeden önce yetki: eklenemeyecek fotoğraf diske hiç yazılmaz (aynı kontrol kayıtta kilit altında tekrarlanır).
  const target = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { status: true, optionedById: true } });
  const early = target ? mediaChangeBlock(target, { id: input.staff.id, role: input.staff.role as "ADMIN" | "SALES" }) : "Araç bulunamadı.";
  if (early) return `Fotoğraf eklenmedi: ${early}`;

  const saved: string[] = [];
  const errors: string[] = [];
  for (const id of input.mediaIds) {
    const media = await downloadWhatsAppMedia(id);
    if (!media.ok) { errors.push(media.error); continue; }
    const ext = media.mime.includes("png") ? ".png" : media.mime.includes("webp") ? ".webp" : ".jpg";
    try {
      saved.push(await saveUpload(new File([new Uint8Array(media.data)], `whatsapp${ext}`), "photo", vehicleId));
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  if (!saved.length) return `Fotoğraf eklenemedi: ${errors[0] ?? "bilinmeyen hata"}`;

  const result = await prisma.$transaction(async (tx) => {
    // Aynı araca eşzamanlı gelen fotoğraflar (ayrı webhook'lar) sırayı ve kapağı bozmasın: araç başına kilit.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${vehicleId}))`;
    const v = await tx.vehicle.findUnique({ where: { id: vehicleId! }, include: { photos: { select: { sortOrder: true, isCover: true } } } });
    if (!v) return { error: "Araç bulunamadı." };
    const blocked = mediaChangeBlock(v, { id: input.staff.id, role: input.staff.role as "ADMIN" | "SALES" });
    if (blocked) return { error: blocked };
    if (v.photos.length + saved.length > 40) return { error: "Bir araçta en fazla 40 fotoğraf olabilir." };
    let order = v.photos.reduce((m, p) => Math.max(m, p.sortOrder), -1);
    const hasCover = v.photos.some((p) => p.isCover);
    for (const [i, path] of saved.entries()) {
      await tx.vehiclePhoto.create({ data: { vehicleId: v.id, path, sortOrder: ++order, isCover: !hasCover && i === 0 } });
    }
    return { total: v.photos.length + saved.length, status: v.status };
  });
  if ("error" in result) {
    for (const p of saved) await deleteStored(p).catch(() => undefined);
    return `Fotoğraf eklenmedi: ${result.error}`;
  }
  if (result.status === "AVAILABLE" || result.status === "OPTIONED") {
    try { revalidatePath(`/araclar/${vehicleId}`); } catch { /* site dinamik */ }
  }
  return `📷 ${saved.length} fotoğraf *#${vehicleId.slice(-6)}* aracına eklendi (toplam ${result.total}).${errors.length ? ` ${errors.length} fotoğraf eklenemedi.` : ""}`;
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
