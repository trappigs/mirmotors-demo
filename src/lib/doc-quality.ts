import "server-only";
import type { QualityIssue } from "./ai/document-sanitize";

/**
 * Eşikler sentetik ve örnek belgelerle ölçüldü (1000 px'e ölçeklenmiş gri görüntüde):
 * - Kenar keskinliği (kenar piksellerinde ortalama |Laplace|): net tarama 118–138, telefon fotoğrafı 43–45,
 *   1,5 px bulanık 38 (okunabilir), 2,5 px bulanık 13, 4 px bulanık 5. Birkaç satırlık boş ağırlıklı sayfa 135 → yanlış alarm yok.
 * - Parlaklık: temiz belgeler 127–200, karanlık örnek 90.
 * Gerçek galeri fotoğraflarıyla gözden geçirilmelidir.
 */
const MIN_EDGE = 1200; // en uzun kenar (px)
const MIN_BRIGHTNESS = 100;
const MIN_EDGE_SHARPNESS = 20;

/**
 * Belge görselinin okunabilirliğini sunucuda ölçer: düşük çözünürlük, karanlık ve bulanıklık.
 * Kesik kenar ve parlama gibi içerik sorunlarını AI ayrıca bildirir.
 */
export async function measureImage(buf: Buffer): Promise<{ width: number; height: number; issues: QualityIssue[] }> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(buf).metadata();
  const width = meta.width ?? 0, height = meta.height ?? 0;
  const issues: QualityIssue[] = [];
  if (Math.max(width, height) < MIN_EDGE) issues.push("LOW_RES");

  const { data, info } = await sharp(buf).rotate().greyscale().resize(1000, 1000, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  let sum = 0, edges = 0, lapAbs = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      sum += data[i];
      const grad = Math.abs(data[i + 1] - data[i - 1]) + Math.abs(data[i + w] - data[i - w]);
      if (grad > 40) {
        edges++;
        lapAbs += Math.abs(data[i - 1] + data[i + 1] + data[i - w] + data[i + w] - 4 * data[i]);
      }
    }
  }
  if (sum / ((w - 2) * (h - 2)) < MIN_BRIGHTNESS) issues.push("DARK");
  if (!edges || lapAbs / edges < MIN_EDGE_SHARPNESS) issues.push("BLURRY");
  return { width, height, issues };
}

export const QUALITY_LABELS: Record<QualityIssue, string> = {
  LOW_RES: "düşük çözünürlük",
  DARK: "karanlık",
  BLURRY: "bulanık",
  CROPPED: "kenarı kesik",
  GLARE: "parlama / yansıma",
};
