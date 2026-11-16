import { NextResponse, after } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { LIMITS, getAnalysis, runAnalysis } from "@/lib/doc-analysis";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

/** Analiz durumu (Yüklendi → Analiz ediliyor → Karşılaştırılıyor → Kontrol bekliyor / Tamamlandı / Hata / İptal). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireApiUser();
    const a = await getAnalysis((await params).id);
    if (!a) return jsonError("Analiz bulunamadı", 404);
    return NextResponse.json({
      id: a.id, status: a.status, method: a.method, mode: a.mode, model: a.model, error: a.error, attempts: a.attempts,
      canRetry: a.status === "ERROR" && a.attempts < LIMITS.maxAttempts, vehicleId: a.vehicleId,
      durationMs: a.durationMs, costUsd: a.costUsd, pages: a.documents.length,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** { action: "retry" | "cancel" } — yeniden deneme sınırlıdır; iptal edilen işin sonucu yazılmaz. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    await requireApiUser();
    const { id } = await params;
    const { action } = (await req.json().catch(() => ({}))) as { action?: string };
    if (action === "cancel") {
      const r = await prisma.docAnalysis.updateMany({ where: { id, status: { in: ["UPLOADED", "ANALYZING", "COMPARING", "ERROR"] } }, data: { status: "CANCELLED", error: "Personel tarafından iptal edildi." } });
      return r.count === 1 ? NextResponse.json({ ok: true }) : jsonError("Bu analiz iptal edilemez", 409);
    }
    if (action === "retry") {
      const r = await prisma.docAnalysis.updateMany({ where: { id, status: "ERROR", attempts: { lt: LIMITS.maxAttempts } }, data: { status: "UPLOADED", error: null } });
      if (r.count !== 1) return jsonError(`Yeniden deneme yapılamaz (en fazla ${LIMITS.maxAttempts} deneme).`, 409);
      after(() => runAnalysis(id));
      return NextResponse.json({ ok: true }, { status: 202 });
    }
    return jsonError("Geçersiz işlem");
  } catch (e) {
    return handleApiError(e);
  }
}
