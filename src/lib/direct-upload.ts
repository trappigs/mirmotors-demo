import { upload } from "@vercel/blob/client";

type Payload = { target: "vehicle"; kind: "photo" | "video" | "pdf"; vehicleId: string } | { target: "aiDraft" };

/**
 * Dosyayı tarayıcıdan doğrudan Vercel Blob'a (özel mağaza) yükler ve veritabanına yazılacak göreli yolu döndürür.
 * Yükleme jetonu /api/crm/uploads rotasından alınır; kayıt, ilgili API rotasında doğrulamadan sonra oluşturulur.
 */
export async function directUpload(file: File, subdir: string, payload: Payload): Promise<string> {
  const ext = (file.name.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase().replace(".jpeg", ".jpg");
  const rel = `${subdir}/${crypto.randomUUID()}${ext}`;
  const area = payload.target === "vehicle" && payload.kind === "pdf" ? "private" : "public";
  try {
    await upload(`${area}/${rel}`, file, {
      access: "private",
      handleUploadUrl: "/api/crm/uploads",
      clientPayload: JSON.stringify(payload),
      contentType: file.type || undefined,
      multipart: file.size > 20 * 1024 * 1024,
    });
  } catch (e) {
    // Sunucu jetonu reddettiğinde (yetki, araç durumu, dosya türü/adı) SDK yalnızca genel bir hata verir.
    if (/client token/i.test((e as Error).message)) {
      throw new Error("Yükleme izni verilmedi: dosya türünü/boyutunu ve bu araçta değişiklik yetkinizi kontrol edin.");
    }
    throw new Error(`Dosya yüklenemedi: ${(e as Error).message}`);
  }
  return rel;
}
