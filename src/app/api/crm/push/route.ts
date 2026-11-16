import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { pushConfigured, pushPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Bildirim altyapısının durumu: sunucu anahtarları tanımlı mı, genel anahtar ve bu kullanıcının abonelik sayısı. */
export async function GET() {
  try {
    const user = await requireApiUser();
    const subscriptions = await prisma.pushSubscription.count({ where: { userId: user.id } });
    return NextResponse.json(
      { configured: pushConfigured(), publicKey: pushPublicKey(), subscriptions },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleApiError(e);
  }
}
