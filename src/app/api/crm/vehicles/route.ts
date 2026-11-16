import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { storedFileExists } from "@/lib/storage";
import { checkAiVerification, toVehicleData, vehicleInputSchema } from "@/lib/vehicle-schema";
import { autoListingNo } from "@/lib/listing-rules";
import { duplicatePlateResponse, plateDuplicates } from "@/lib/plates";

const stripUndefined = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Aynı createKey ile daha önce oluşturulmuş taslak (yalnızca kendi taslağı döner). */
async function existingDraft(createKey: string, userId: string) {
  const existing = await prisma.vehicle.findUnique({ where: { createKey }, select: { id: true, createdById: true } });
  if (!existing) return null;
  if (existing.createdById !== userId) return jsonError("Bu taslak başka bir çalışana ait.", 409);
  return NextResponse.json({ id: existing.id, existing: true });
}

/**
 * Yeni araç her zaman TASLAK olarak oluşturulur; yayımlama ayrı bir adımdır.
 * Otomatik taslakta istemci bir createKey gönderir: aynı anahtarla gelen ikinci istek (ağ hatası sonrası tekrar, çift dokunma)
 * yeni araç oluşturmaz, mevcut taslağı döndürür. Stokta aynı plakalı araç varsa personel seçim yapmadan kayıt açılmaz.
 */
export async function POST(req: Request) {
  let createKey: string | undefined;
  let userId = "";
  try {
    const user = await requireApiUser();
    userId = user.id;
    const input = vehicleInputSchema.parse(await req.json());
    createKey = input.createKey;
    const aiError = checkAiVerification(input);
    if (aiError) return jsonError(aiError, 422);

    if (createKey) {
      const existing = await existingDraft(createKey, user.id);
      if (existing) return existing;
    }
    if (input.legalPlate && !input.plateDuplicateAck) {
      const duplicates = await plateDuplicates(prisma, input.legalPlate);
      if (duplicates.length) return duplicatePlateResponse(duplicates);
    }

    // AI taslak videosu yalnızca bir araca bağlanabilir (aynı dosyanın iki ilanda paylaşılmasını önler).
    if (input.draftVideoPath) {
      const used = await prisma.vehicle.findFirst({ where: { videoPath: input.draftVideoPath }, select: { id: true } });
      if (used) return jsonError("Bu taslak videosu başka bir araca bağlanmış. Videoyu yeniden yükleyin.", 409);
      if (!(await storedFileExists(input.draftVideoPath))) return jsonError("Taslak videosu bulunamadı", 422);
    }

    const vehicle = await prisma.$transaction(async (tx) => {
      // AI analiz videosu araca bağlanır ama müşteriye kapalıdır (videoPublic=false); personel ayrıca onaylar.
      const created = await tx.vehicle.create({
        // Tescil gönderilmediyse galeri adına kabul edilir (Mir Motors stoku galeri adına tescillidir; personel değiştirebilir)
        data: { legalRegisteredToCompany: true, ...stripUndefined(toVehicleData(input)), videoPath: input.draftVideoPath ?? null, videoPublic: false, status: "DRAFT", createdById: user.id, createKey: createKey ?? null },
      });
      // İlan numarası otomatik verilir (personel girmez)
      const v = await tx.vehicle.update({ where: { id: created.id }, data: { legalListingNo: autoListingNo(created.id) } });
      await tx.statusHistory.create({
        data: {
          vehicleId: v.id, fromStatus: null, toStatus: "DRAFT", action: "create", userId: user.id,
          note: [
            input.aiDraftMode ? `AI taslağından oluşturuldu (${input.aiDraftMode === "LIVE" ? "canlı AI" : "simülasyon"})` : "Manuel giriş",
            input.plateDuplicateAck ? "aynı plakalı kayıt uyarısı görülerek yeni kayıt açıldı" : null,
          ].filter(Boolean).join(" · "),
        },
      });
      return v;
    });
    return NextResponse.json({ id: vehicle.id }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // createKey benzersizdir: aynı girişin eşzamanlı ikinci isteği mevcut taslağı alır.
      if (createKey && String(e.meta?.target ?? "").includes("createKey")) {
        const existing = await existingDraft(createKey, userId);
        if (existing) return existing;
      }
      // videoPath benzersizdir: aynı taslak videosu eşzamanlı iki kayda bağlanamaz.
      return jsonError("Bu taslak videosu başka bir araca bağlanmış. Videoyu yeniden yükleyin.", 409);
    }
    return handleApiError(e);
  }
}
