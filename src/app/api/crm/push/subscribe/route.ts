import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { pushConfigured } from "@/lib/push";

// Tarayıcının PushSubscription.toJSON() çıktısı. Anahtarlar tarayıcının genel anahtarlarıdır.
const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).refine((u) => u.startsWith("https://"), "Geçersiz bildirim adresi"),
  keys: z.object({ p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(256) }),
});

const unsubscribeSchema = z.object({ endpoint: z.string().max(2048).optional() });

/** Bu cihazı oturumdaki kullanıcı adına bildirimlere abone eder (aynı cihaz tekrar abone olursa güncellenir). */
export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    if (!pushConfigured()) return jsonError("Bildirim altyapısı hazır, sunucu anahtarları henüz tanımlanmadı.", 503);
    const sub = subscriptionSchema.parse(await req.json());
    await prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      update: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** Aboneliği kaldırır: endpoint verilirse yalnızca o cihaz, verilmezse kullanıcının tüm cihazları. */
export async function DELETE(req: Request) {
  try {
    const user = await requireApiUser();
    const body = unsubscribeSchema.parse(await req.json().catch(() => ({})));
    await prisma.pushSubscription.deleteMany({ where: { userId: user.id, ...(body.endpoint ? { endpoint: body.endpoint } : {}) } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
