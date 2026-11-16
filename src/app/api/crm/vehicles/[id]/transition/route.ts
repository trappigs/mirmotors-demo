import { NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireApiUser, type CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { transitionVehicle, type TransitionAction } from "@/lib/vehicle-status";
import { notifyStaff } from "@/lib/push";

const bodySchema = z.object({
  action: z.enum(["completeReview", "publish", "unpublish", "option", "releaseOption", "startSale", "cancelSale", "completeSale", "archive", "restore"]),
  note: z.string().max(1000).optional(),
  agreedPrice: z.coerce.number().int().positive().optional(),
  notaryCompleted: z.boolean().optional(),
  notaryDate: z.coerce.date().optional(),
  sellerId: z.string().min(1).max(64).optional(),
});

/** Bildirim gönderilen işlemler ve başlıkları. */
const PUSH_TITLES: Partial<Record<TransitionAction, string>> = {
  option: "Araç opsiyonlandı",
  releaseOption: "Opsiyon kaldırıldı",
  completeSale: "Araç satıldı",
  publish: "Yeni ilan yayında",
};

/** İşlem başarılı olduktan sonra diğer personele bildirim (yanıtı bekletmez, hata işlemi etkilemez). */
async function sendTransitionPush(action: TransitionAction, vehicleId: string, user: CurrentUser) {
  const title = PUSH_TITLES[action];
  if (!title) return;
  const v = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { brand: true, model: true, year: true } });
  const car = [v?.brand ?? "Marka girilmedi", v?.model, v?.year].filter(Boolean).join(" ");
  await notifyStaff(
    // Başlık + gövde: "Araç opsiyonlandı" / "BMW 5 Serisi 2022 · Ahmet". Müşteri bilgisi bildirime yazılmaz.
    { title, body: `${car} · ${user.name}`, url: `/crm/vehicles/${vehicleId}` },
    { exceptUserId: user.id },
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const { action, ...input } = body;

    let result;
    try {
      result = await transitionVehicle(prisma, { id: user.id, role: user.role }, id, action, input);
    } catch (e) {
      // Eşzamanlılık çakışması vb.: eşzamanlı başka bir işlem kazandı.
      console.warn("transition conflict", e);
      result = { ok: false as const, status: 409, error: "Araç üzerinde eşzamanlı bir işlem yapıldı. Sayfayı yenileyip tekrar deneyin." };
    }
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    // Müşteri sitesi dinamik render edilir; yine de olası önbellekleri anında temizle.
    revalidatePath("/");
    revalidatePath("/araclar");
    revalidatePath(`/araclar/${id}`);
    // Bildirim, işlem kaydedildikten ve yanıt gönderildikten sonra çalışır (DB işleminin dışında).
    after(() => sendTransitionPush(action, id, user).catch((e) => console.warn("push atlandı", (e as Error).message)));
    return NextResponse.json({ ok: true, status: result.status });
  } catch (e) {
    return handleApiError(e);
  }
}
