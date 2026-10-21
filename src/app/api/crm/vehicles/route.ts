import { existsSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { PUBLIC_DIR } from "@/lib/storage";
import { checkAiVerification, toVehicleData, vehicleInputSchema } from "@/lib/vehicle-schema";

// Yeni araç her zaman TASLAK olarak oluşturulur; yayımlama ayrı bir adımdır.
export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    const input = vehicleInputSchema.parse(await req.json());
    const aiError = checkAiVerification(input);
    if (aiError) return jsonError(aiError, 422);

    // AI taslak videosu yalnızca bir araca bağlanabilir (aynı dosyanın iki ilanda paylaşılmasını önler).
    if (input.draftVideoPath) {
      const used = await prisma.vehicle.findFirst({ where: { videoPath: input.draftVideoPath }, select: { id: true } });
      if (used) return jsonError("Bu taslak videosu başka bir araca bağlanmış. Videoyu yeniden yükleyin.", 409);
      if (!existsSync(path.join(PUBLIC_DIR, input.draftVideoPath))) return jsonError("Taslak videosu bulunamadı", 422);
    }

    const vehicle = await prisma.$transaction(async (tx) => {
      const v = await tx.vehicle.create({ data: { ...toVehicleData(input), videoPath: input.draftVideoPath ?? null, status: "DRAFT", createdById: user.id } });
      await tx.statusHistory.create({
        data: {
          vehicleId: v.id, fromStatus: null, toStatus: "DRAFT", action: "create", userId: user.id,
          note: input.aiDraftMode ? `AI taslağından oluşturuldu (${input.aiDraftMode === "LIVE" ? "canlı AI" : "simülasyon"})` : "Manuel giriş",
        },
      });
      return v;
    });
    return NextResponse.json({ id: vehicle.id }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
