import "server-only";
import { prisma } from "./db";
import { PUBLIC_STATUSES } from "./constants";

/**
 * /media/... dosyası müşteriye açık mı? Yalnızca yayındaki (Satışta / Opsiyonlu) aracın fotoğrafı ve
 * personelin onayladığı tanıtım videosu herkese açıktır. Taslak, satış bekleyen ve satılmış araçların medyası
 * ile AI analiz videoları yalnızca oturumlu personele servis edilir.
 */
export async function isPublicMedia(rel: string): Promise<boolean> {
  const status = { in: PUBLIC_STATUSES };
  const [photo, video] = await Promise.all([
    prisma.vehiclePhoto.findFirst({ where: { path: rel, vehicle: { status } }, select: { id: true } }),
    prisma.vehicle.findFirst({ where: { videoPath: rel, videoPublic: true, status }, select: { id: true } }),
  ]);
  return Boolean(photo || video);
}

/** Herkese açık medya kısa süre önbelleklenir: ilan kalkınca CDN'de en fazla birkaç dakika kalır. */
export const PUBLIC_MEDIA_CACHE = "public, max-age=60, s-maxage=300, stale-while-revalidate=60";
/** Personele servis edilen (yayında olmayan) medya hiçbir ara katmanda önbelleklenmez. */
export const PRIVATE_MEDIA_CACHE = "private, no-store";
