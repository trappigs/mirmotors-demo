import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { mediaChangeBlock } from "@/lib/permissions";
import { directUploadConstraints, parseDirectUploadKey, storageDriver, UploadError } from "@/lib/storage";

const payloadSchema = z.discriminatedUnion("target", [
  z.object({ target: z.literal("vehicle"), kind: z.enum(["photo", "video", "pdf"]), vehicleId: z.string().min(1).max(64) }),
  z.object({ target: z.literal("aiDraft") }),
]);

/**
 * Vercel Blob doğrudan yükleme jetonu. Yalnızca oturumlu personel, yalnızca değiştirme yetkisi olan araç için,
 * tür/boyut kısıtlı ve kısa ömürlü jeton alır. Dosya kayda, yükleme bitince ilgili API rotasında
 * (boyut + dosya imzası doğrulandıktan sonra) bağlanır; bu yüzden onUploadCompleted kullanılmaz.
 */
export async function POST(req: Request) {
  try {
    if (storageDriver() !== "blob") return jsonError("Doğrudan yükleme bu ortamda kapalı", 404);
    const user = await requireApiUser();
    const body = (await req.json()) as HandleUploadBody;
    if (body.type !== "blob.generate-client-token") return jsonError("Geçersiz istek");
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload: z.infer<typeof payloadSchema>;
        try {
          payload = payloadSchema.parse(JSON.parse(clientPayload ?? "null"));
        } catch {
          throw new UploadError("Geçersiz yükleme isteği");
        }
        if (payload.target === "aiDraft") {
          parseDirectUploadKey(pathname, "video", "drafts");
          return token("video");
        }
        const vehicle = await prisma.vehicle.findUnique({ where: { id: payload.vehicleId } });
        if (!vehicle) throw new UploadError("Araç bulunamadı");
        const blocked = mediaChangeBlock(vehicle, user);
        if (blocked) throw new UploadError(blocked);
        parseDirectUploadKey(pathname, payload.kind, vehicle.id);
        return token(payload.kind);
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return handleApiError(e);
  }
}

function token(kind: "photo" | "video" | "pdf") {
  return {
    ...directUploadConstraints(kind),
    addRandomSuffix: false,
    allowOverwrite: false,
    validUntil: Date.now() + 10 * 60 * 1000,
  };
}
