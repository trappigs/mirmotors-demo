import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { canEditDetails } from "@/lib/permissions";
import { deleteStored } from "@/lib/storage";
import { audit } from "@/lib/doc-analysis";

/** Belge görselini kalıcı olarak siler (dosya + kayıt); silme işlemi denetim kaydına yazılır. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const doc = await prisma.vehicleDocument.findUnique({ where: { id }, include: { vehicle: { select: { status: true, optionedById: true } } } });
    if (!doc) return jsonError("Belge bulunamadı", 404);
    if (doc.vehicle && !canEditDetails(doc.vehicle, user) && user.role !== "ADMIN") return jsonError("Bu belgeyi silme yetkiniz yok", 403);
    await prisma.$transaction(async (tx) => {
      await tx.vehicleDocument.delete({ where: { id } });
      await audit(tx, { action: "DELETE", userId: user.id, documentId: id, vehicleId: doc.vehicleId ?? undefined, analysisId: doc.analysisId ?? undefined, note: `${doc.kind} sayfa ${doc.page}` });
    });
    await deleteStored(doc.path, true);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
