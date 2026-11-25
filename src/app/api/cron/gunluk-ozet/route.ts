import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyStaff } from "@/lib/push";
import { buildDailySummary, cronAuthorized } from "@/lib/daily-summary";

/**
 * Akşam özeti: sunucudaki zamanlayıcı (cron) her akşam çağırır, abone personele CRM bildirimi gider.
 * Yalnız CRON_SECRET ile çağrılabilir; anahtar sunucuda kalır (istek kapsayıcının içinden yapılır).
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!cronAuthorized(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const since = new Date(Date.now() - 24 * 3600_000);
  const actions = ["create", "publish", "option", "startSale", "completeSale", "cancelSale"];
  const [history, byStatus, staff, contacts] = await Promise.all([
    prisma.statusHistory.groupBy({ by: ["action"], where: { createdAt: { gte: since }, action: { in: actions } }, _count: { _all: true } }),
    prisma.vehicle.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.findMany({ where: { active: true, phone: { not: null } }, select: { phone: true } }),
    prisma.whatsAppMessage.findMany({ where: { direction: "IN", sentAt: { gte: since } }, select: { waId: true }, distinct: ["waId"] }),
  ]);
  const h = (a: string) => history.find((x) => x.action === a)?._count._all ?? 0;
  const s = (st: string) => byStatus.find((x) => x.status === st)?._count._all ?? 0;
  const staffPhones = new Set(staff.map((u) => u.phone));
  const summary = buildDailySummary({
    created: h("create"), published: h("publish"), optioned: h("option"), saleStarted: h("startSale"), sold: h("completeSale"), cancelled: h("cancelSale"),
    waiting: { review: s("REVIEW"), draft: s("DRAFT"), salePending: s("SALE_PENDING"), optioned: s("OPTIONED") },
    available: s("AVAILABLE"),
    newContacts: contacts.filter((c) => !staffPhones.has(c.waId)).length,
  });
  await notifyStaff({ ...summary, url: "/crm" });
  console.info("[özet] gönderildi", JSON.stringify({ chars: summary.body.length }));
  return NextResponse.json({ ok: true });
}
