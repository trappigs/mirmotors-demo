import "server-only";
import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { UPLOAD_LIMITS } from "./constants";

export const STORAGE_ROOT = path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), "storage"));
/** Herkese açık medya (fotoğraf, video): /media/... rotasından servis edilir. */
export const PUBLIC_DIR = path.join(STORAGE_ROOT, "public");
/** Yalnızca CRM (ekspertiz PDF): /api/crm/files/... rotasından oturumla servis edilir. */
export const PRIVATE_DIR = path.join(STORAGE_ROOT, "private");

export type UploadKind = keyof typeof UPLOAD_LIMITS;

export class UploadError extends Error {}

// Dosya imzası (magic bytes) kontrolü: yalnızca uzantı/MIME'a güvenilmez.
function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    return buf.subarray(8, 10).toString("ascii") === "qt" ? "video/quicktime" : "video/mp4";
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm";
  return null;
}

export async function saveUpload(file: File, kind: UploadKind, subdir: string): Promise<string> {
  const limits = UPLOAD_LIMITS[kind];
  if (!file || typeof file.arrayBuffer !== "function") throw new UploadError("Dosya bulunamadı");
  if (file.size === 0) throw new UploadError("Boş dosya yüklenemez");
  if (file.size > limits.maxBytes) {
    throw new UploadError(`Dosya çok büyük (en fazla ${Math.round(limits.maxBytes / 1024 / 1024)} MB)`);
  }
  const ext = path.extname(file.name || "").toLowerCase();
  if (!(limits.exts as readonly string[]).includes(ext)) {
    throw new UploadError(`Geçersiz dosya uzantısı. İzin verilenler: ${limits.exts.join(", ")}`);
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const detected = sniff(buf);
  if (!detected || !(limits.mimes as readonly string[]).includes(detected)) {
    throw new UploadError("Dosya içeriği beklenen türle uyuşmuyor");
  }
  const safeSub = subdir.replace(/[^a-zA-Z0-9_-]/g, "");
  const baseDir = kind === "pdf" ? PRIVATE_DIR : PUBLIC_DIR;
  const dir = path.join(baseDir, safeSub);
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}${ext === ".jpeg" ? ".jpg" : ext}`;
  await writeFile(path.join(dir, name), buf);
  return `${safeSub}/${name}`;
}

export async function deleteStored(relPath: string, isPrivate = false) {
  const base = isPrivate ? PRIVATE_DIR : PUBLIC_DIR;
  const full = path.resolve(base, relPath);
  if (!full.startsWith(base + path.sep)) return;
  await unlink(full).catch(() => {});
}

/** Göreli yolu kök dizin dışına çıkmayacak şekilde çözümler. */
export function resolveSafe(base: string, parts: string[]): string | null {
  const full = path.resolve(base, ...parts);
  if (!full.startsWith(base + path.sep)) return null;
  return full;
}

