"use client";
// Tek fotoğrafın yüklenmesi (ilerleme bildirimli). Fotoğraf rotası dizi kabul eder; burada her istekte tek dosya gönderilir.
import { apiCall } from "@/lib/client-api";
import { directUpload } from "@/lib/direct-upload";

/** Blob modu: dosyayı doğrudan depoya aktarır, veritabanına yazılacak göreli yolu döndürür (henüz kayıt yok). */
export function transferPhotoToBlob(file: File, vehicleId: string, onProgress: (pct: number) => void): Promise<string> {
  return directUpload(file, vehicleId, { target: "vehicle", kind: "photo", vehicleId }, { onProgress });
}

/** Blob modu: aktarılmış dosyayı araca kaydeder. Sunucu dosyayı yeniden doğrular. */
export async function registerBlobPhoto(vehicleId: string, rel: string): Promise<void> {
  await apiCall(`/api/crm/vehicles/${vehicleId}/photos`, { method: "POST", json: { paths: [rel] } });
}

/** Yerel mod: dosyayı tek multipart istekle gönderir; yükleme yüzdesi XMLHttpRequest ile izlenir. */
export function uploadLocalPhoto(file: File, vehicleId: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/crm/vehicles/${vehicleId}/photos`);
    xhr.responseType = "text";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: { error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        // gövde JSON değilse genel mesaj kullanılır
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(data.error || (xhr.status === 413 ? "Dosya çok büyük" : `Yükleme başarısız (${xhr.status})`)));
    };
    xhr.onerror = () => reject(new Error("Bağlantı hatası: internetinizi kontrol edip tekrar deneyin"));
    xhr.ontimeout = () => reject(new Error("Yükleme zaman aşımına uğradı"));
    xhr.timeout = 5 * 60 * 1000;
    const fd = new FormData();
    fd.append("files", file, file.name);
    xhr.send(fd);
  });
}
