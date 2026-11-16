import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { canEditDetails } from "@/lib/permissions";
import { CONFLICT_FIELDS, conflictValue, parseReview, type ConflictField } from "@/lib/doc-review";
import { audit } from "@/lib/doc-analysis";

type Ctx = { params: Promise<{ id: string }> };

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resolveConflict"), field: z.enum(Object.keys(CONFLICT_FIELDS) as [ConflictField, ...ConflictField[]]), choice: z.enum(["RUHSAT", "EKSPERTIZ", "MANUAL"]) }),
  z.object({ action: z.literal("confirmIdentity") }),
  z.object({ action: z.literal("detachEkspertiz") }),
  z.object({ action: z.literal("ackDuplicates") }),
  z.object({ action: z.literal("ownerChecked"), value: z.boolean().nullable() }),
  z.object({ action: z.literal("confirmAi"), value: z.boolean() }),
]);

/**
 * Belge incelemesindeki konuları personel çözer: çelişkide doğru kaynağı seçme, aynı araç onayı, farklı araca ait ekspertizi ayırma,
 * stokta mükerrer uyarısını inceleme, tescil sahibini kontrol etme ve AI bilgilerini onaylama. Her işlem geçmişe yazılır.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const input = body.parse(await req.json());
    const result = await prisma.$transaction(async (tx) => {
      const v = await tx.vehicle.findUnique({ where: { id } });
      if (!v) return { error: "Araç bulunamadı", status: 404 } as const;
      if (!canEditDetails(v, user)) return { error: "Bu araçta değişiklik yetkiniz yok", status: 409 } as const;
      const review = parseReview(v.docReview);
      if (!review) return { error: "Bu araçta belge incelemesi yok", status: 422 } as const;
      const data: Record<string, unknown> = {};
      let note = "";

      switch (input.action) {
        case "resolveConflict": {
          const c = review.conflicts.find((x) => x.field === input.field && !x.resolved) ?? review.conflicts.find((x) => x.field === input.field);
          if (!c) return { error: "Çelişki bulunamadı", status: 404 } as const;
          if (input.field === "vinLast6" && review.identity === "DIFFERENT" && input.choice !== "MANUAL") {
            return { error: "Şasi uyuşmazlığında belge değeri otomatik seçilemez; ekspertizi ayırın veya elle girin.", status: 422 } as const;
          }
          c.resolved = input.choice;
          if (input.choice !== "MANUAL") {
            const raw = input.choice === "RUHSAT" ? c.ruhsat : c.ekspertiz;
            data[CONFLICT_FIELDS[input.field].column] = conflictValue(input.field, raw);
          }
          note = `Çelişki çözüldü: ${c.label} → ${input.choice === "MANUAL" ? "elle girilecek" : input.choice === "RUHSAT" ? (c.labels?.[0] ?? "ruhsat") : (c.labels?.[1] ?? "ekspertiz")}`;
          break;
        }
        case "confirmIdentity":
          if (review.identity === "DIFFERENT") return { error: "Şasi uyuşmuyor: belgeler aynı araç olarak onaylanamaz. Ekspertizi ayırın.", status: 422 } as const;
          review.identityResolved = true;
          note = "Belgelerin aynı araca ait olduğu personel tarafından onaylandı";
          break;
        case "detachEkspertiz": {
          const docs = await tx.vehicleDocument.findMany({ where: { vehicleId: id, kind: "EKSPERTIZ" }, select: { id: true } });
          await tx.vehicleDocument.updateMany({ where: { vehicleId: id, kind: "EKSPERTIZ" }, data: { vehicleId: null } });
          for (const d of docs) await audit(tx, { action: "DETACH", userId: user.id, documentId: d.id, vehicleId: id, note: "Farklı araca ait ekspertiz ayrıldı" });
          await tx.vehiclePart.updateMany({ where: { vehicleId: id }, data: { reportState: "UNKNOWN" } });
          review.identityResolved = true;
          review.conflicts = review.conflicts.map((c) => (c.resolved ? c : { ...c, resolved: "RUHSAT" as const }));
          note = `Farklı araca ait ekspertiz ayrıldı (${docs.length} sayfa)`;
          break;
        }
        case "ackDuplicates":
          review.duplicatesAcknowledged = true;
          note = "Stoktaki benzer kayıt uyarısı incelendi";
          break;
        case "ownerChecked":
          review.ownerChecked = input.value !== null;
          data.legalRegisteredToCompany = input.value;
          note = `Tescil sahibi elle kontrol edildi: ${input.value === null ? "bilinmiyor" : input.value ? "işletme adına" : "işletme adına değil"}`;
          break;
        case "confirmAi":
          review.aiConfirmed = input.value;
          note = input.value ? "AI'nın doldurduğu bilgiler personel tarafından kontrol edildi" : "AI onayı geri alındı";
          break;
      }
      await tx.vehicle.update({ where: { id }, data: { ...data, docReview: JSON.stringify(review) } });
      await tx.statusHistory.create({ data: { vehicleId: id, fromStatus: v.status, toStatus: v.status, action: "docReview", userId: user.id, note } });
      return { review } as const;
    });
    if ("error" in result) return jsonError(result.error!, result.status);
    revalidatePath(`/araclar/${id}`);
    return NextResponse.json({ ok: true, review: result.review });
  } catch (e) {
    return handleApiError(e);
  }
}
