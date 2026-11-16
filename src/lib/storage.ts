import "server-only";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import path from "path";
import { del, get, head, put } from "@vercel/blob";
import { UPLOAD_LIMITS } from "./constants";

/**
 * Dosya depolama. İki sürücü vardır:
 * - "local": storage/ klasörü (yerel geliştirme, BLOB_READ_WRITE_TOKEN yoksa).
 * - "blob": Vercel Blob, ÖZEL (private) mağaza. Dosyalar doğrudan tarayıcıdan yüklenir (Vercel istek gövdesi
 *   4,5 MB ile sınırlı); sunucu yüklemeden sonra dosya türünü ve boyutunu doğrulayıp kaydı oluşturur.
 *   Herkese açık medya /media/... rotasından, ekspertiz PDF'leri yalnızca oturumla /api/crm/files/... rotasından servis edilir.
 *
 * Veritabanında her iki sürücüde de aynı göreli yol tutulur: "<alt-klasör>/<uuid>.<uzantı>".
 * Blob'da anahtar "public/<göreli>" veya "private/<göreli>" olur. "/demo-cars/..." ile başlayan yollar
 * statik seed görselleridir (public/ klasörü); silinmez.
 */
export const STORAGE_ROOT = path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), "storage"));
/** Herkese açık medya (fotoğraf, video): /media/... rotasından servis edilir. */
export const PUBLIC_DIR = path.join(STORAGE_ROOT, "public");
/** Yalnızca CRM (ekspertiz PDF): /api/crm/files/... rotasından oturumla servis edilir. */
export const PRIVATE_DIR = path.join(STORAGE_ROOT, "private");

export type UploadKind = keyof typeof UPLOAD_LIMITS;
export type StorageDriver = "local" | "blob";

export class UploadError extends Error {}

export function storageDriver(): StorageDriver {
  return process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local";
}

export const isStaticSeedPath = (rel: string) => rel.startsWith("/demo-cars/");

/** Ekspertiz PDF'i ve belge fotoğrafları (ruhsat, ekspertiz) özel depolamadadır; yalnızca oturumlu personele servis edilir. */
export const isPrivateKind = (kind: UploadKind) => kind === "pdf" || kind === "doc";

const blobKey = (rel: string, isPrivate: boolean) => `${isPrivate ? "private" : "public"}/${rel}`;

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

const safeSubdir = (subdir: string) => subdir.replace(/[^a-zA-Z0-9_-]/g, "");

function checkExt(name: string, kind: UploadKind) {
  const limits = UPLOAD_LIMITS[kind];
  const ext = path.extname(name || "").toLowerCase();
  if (!(limits.exts as readonly string[]).includes(ext)) {
    throw new UploadError(`Geçersiz dosya uzantısı. İzin verilenler: ${limits.exts.join(", ")}`);
  }
  return ext === ".jpeg" ? ".jpg" : ext;
}

const tooBig = (kind: UploadKind) =>
  new UploadError(`Dosya çok büyük (en fazla ${Math.round(UPLOAD_LIMITS[kind].maxBytes / 1024 / 1024)} MB)`);

/** Yerel sürücü: dosyayı sunucuya gönderilen form verisinden kaydeder. */
export async function saveUpload(file: File, kind: UploadKind, subdir: string): Promise<string> {
  if (storageDriver() === "blob") throw new UploadError("Bu ortamda dosyalar doğrudan yüklenir; sayfayı yenileyip tekrar deneyin.");
  const limits = UPLOAD_LIMITS[kind];
  if (!file || typeof file.arrayBuffer !== "function") throw new UploadError("Dosya bulunamadı");
  if (file.size === 0) throw new UploadError("Boş dosya yüklenemez");
  if (file.size > limits.maxBytes) throw tooBig(kind);
  const ext = checkExt(file.name, kind);
  const buf = Buffer.from(await file.arrayBuffer());
  const detected = sniff(buf);
  if (!detected || !(limits.mimes as readonly string[]).includes(detected)) {
    throw new UploadError("Dosya içeriği beklenen türle uyuşmuyor");
  }
  const safeSub = safeSubdir(subdir);
  const dir = path.join(isPrivateKind(kind) ? PRIVATE_DIR : PUBLIC_DIR, safeSub);
  await mkdir(dir, { recursive: true });
  const optimized = kind === "photo" || kind === "doc" ? await optimizeImage(buf, detected, kind) : null;
  const name = `${randomUUID()}${optimized ? optimized.ext : ext}`;
  await writeFile(path.join(dir, name), optimized ? optimized.data : buf);
  return `${safeSub}/${name}`;
}

/** En uzun kenar: ilan fotoğrafı site için 1920 px; belge fotoğrafı yazıların okunur kalması için 2400 px. */
const MAX_EDGE: Record<"photo" | "doc", number> = { photo: 1920, doc: 2400 };

/**
 * Yüklenen görseli optimize eder: telefon yönünü (EXIF) uygular, en uzun kenarı sınırlar, konum dahil tüm
 * meta veriyi siler ve JPEG/WEBP olarak sıkıştırır (şeffaf PNG beyaz zemine oturtulur). İçerik değiştirilmez.
 * İşlenemezse (bozuk dosya) yükleme reddedilir.
 */
async function optimizeImage(buf: Buffer, mime: string, kind: "photo" | "doc"): Promise<{ data: Buffer; ext: string; mime: string }> {
  const sharp = (await import("sharp")).default;
  try {
    const edge = MAX_EDGE[kind];
    const img = sharp(buf, { failOn: "error" }).rotate().resize(edge, edge, { fit: "inside", withoutEnlargement: true });
    if (mime === "image/webp") return { data: await img.webp({ quality: 82 }).toBuffer(), ext: ".webp", mime };
    return { data: await img.flatten({ background: "#ffffff" }).jpeg({ quality: kind === "doc" ? 86 : 82, mozjpeg: true }).toBuffer(), ext: ".jpg", mime: "image/jpeg" };
  } catch {
    throw new UploadError("Görsel okunamadı; dosya bozuk olabilir");
  }
}

/** Kayıtlı dosyanın tamamını okur (yerel veya Blob). */
export async function readStored(rel: string, isPrivate: boolean): Promise<Buffer> {
  if (storageDriver() === "blob") {
    const res = await get(blobKey(rel, isPrivate), { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) throw new UploadError("Dosya okunamadı");
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  }
  const full = resolveSafe(isPrivate ? PRIVATE_DIR : PUBLIC_DIR, rel.split("/"));
  if (!full) throw new UploadError("Geçersiz dosya yolu");
  return readFile(full);
}

/**
 * Blob sürücüsü: tarayıcıdan doğrudan yüklenen görseli sunucuda optimize edip aynı anahtara yeniden yazar
 * (yerel yüklemedeki gibi konum bilgisi silinir, boyut küçülür). Yol değişmez.
 */
export async function optimizeStoredImage(rel: string, kind: "photo" | "doc"): Promise<void> {
  if (storageDriver() !== "blob") return;
  const isPrivate = isPrivateKind(kind);
  const buf = await readStored(rel, isPrivate);
  const mime = sniff(buf);
  if (!mime) throw new UploadError("Görsel okunamadı");
  const out = await optimizeImage(buf, mime, kind);
  await put(blobKey(rel, isPrivate), out.data, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: out.mime });
}

// --- Doğrudan (istemci) yükleme: Blob sürücüsü ---

const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/;

/**
 * İstemcinin yükleyeceği Blob anahtarını doğrular (yükleme jetonu verilmeden önce ve kayıt sırasında).
 * Anahtar biçimi: "public|private/<alt-klasör>/<uuid>.<uzantı>"; tür ile depolama alanı eşleşmelidir.
 */
export function parseDirectUploadKey(key: string, kind: UploadKind, subdir: string): string {
  const [area, sub, file, ...rest] = key.split("/");
  if (rest.length || !file || !UUID_FILE.test(file)) throw new UploadError("Geçersiz dosya adı");
  if (area !== (isPrivateKind(kind) ? "private" : "public")) throw new UploadError("Geçersiz depolama alanı");
  if (sub !== safeSubdir(subdir)) throw new UploadError("Geçersiz klasör");
  checkExt(file, kind);
  return `${sub}/${file}`;
}

/** Doğrudan yükleme jetonu için kısıtlar (tür ve boyut, Blob tarafında da uygulanır). */
export function directUploadConstraints(kind: UploadKind) {
  const limits = UPLOAD_LIMITS[kind];
  return { allowedContentTypes: [...limits.mimes], maximumSizeInBytes: limits.maxBytes };
}

/**
 * İstemcinin yüklediği dosyayı kayda bağlamadan önce doğrular: anahtar biçimi, boyut ve dosya imzası.
 * Uymayan dosya Blob'dan silinir. Dönen değer veritabanına yazılacak göreli yoldur.
 */
export async function verifyDirectUpload(rel: unknown, kind: UploadKind, subdir: string): Promise<string> {
  if (storageDriver() !== "blob") throw new UploadError("Doğrudan yükleme bu ortamda kapalı");
  if (typeof rel !== "string") throw new UploadError("Dosya bulunamadı");
  const isPrivate = isPrivateKind(kind);
  const relPath = parseDirectUploadKey(blobKey(rel, isPrivate), kind, subdir);
  const key = blobKey(relPath, isPrivate);
  const meta = await head(key).catch(() => null);
  if (!meta) throw new UploadError("Yüklenen dosya bulunamadı");
  const reject = async (e: UploadError): Promise<never> => {
    await del(key).catch(() => {});
    throw e;
  };
  if (meta.size === 0) return reject(new UploadError("Boş dosya yüklenemez"));
  if (meta.size > UPLOAD_LIMITS[kind].maxBytes) return reject(tooBig(kind));
  const res = await get(key, { access: "private", headers: { range: "bytes=0-15" }, useCache: false });
  if (!res || res.statusCode !== 200) return reject(new UploadError("Yüklenen dosya okunamadı"));
  const buf = Buffer.from(await new Response(res.stream).arrayBuffer()).subarray(0, 16);
  const detected = sniff(buf);
  if (!detected || !(UPLOAD_LIMITS[kind].mimes as readonly string[]).includes(detected)) {
    return reject(new UploadError("Dosya içeriği beklenen türle uyuşmuyor"));
  }
  return relPath;
}

/** Göreli yoldaki dosya var mı (AI taslak videosunun araca bağlanması için). */
export async function storedFileExists(rel: string, isPrivate = false): Promise<boolean> {
  if (storageDriver() === "blob") return !!(await head(blobKey(rel, isPrivate)).catch(() => null));
  const full = resolveSafe(isPrivate ? PRIVATE_DIR : PUBLIC_DIR, rel.split("/"));
  return !!full && existsSync(full);
}

export async function deleteStored(relPath: string, isPrivate = false) {
  if (isStaticSeedPath(relPath)) return;
  if (storageDriver() === "blob") {
    await del(blobKey(relPath, isPrivate)).catch(() => {});
    return;
  }
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

/** Blob'daki dosyayı Range desteğiyle akıtır (yalnızca blob sürücüsü). */
export async function serveBlob(parts: string[], isPrivate: boolean, rangeHeader: string | null, extraHeaders: Record<string, string>) {
  if (parts.length !== 2 || !UUID_FILE.test(parts[1]) || /[^a-zA-Z0-9_-]/.test(parts[0])) {
    return new Response("Bulunamadı", { status: 404 });
  }
  const range = rangeHeader && /^bytes=\d*-\d*$/.test(rangeHeader) ? rangeHeader : null;
  const res = await get(blobKey(parts.join("/"), isPrivate), { access: "private", headers: range ? { range } : undefined }).catch(() => null);
  if (!res || res.statusCode !== 200) return new Response("Bulunamadı", { status: 404 });
  const headers: Record<string, string> = {
    "Content-Type": res.blob.contentType,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  };
  const contentRange = res.headers.get("content-range");
  const length = res.headers.get("content-length");
  if (length) headers["Content-Length"] = length;
  if (contentRange) headers["Content-Range"] = contentRange;
  return new Response(res.stream, { status: contentRange ? 206 : 200, headers });
}

/**
 * Tek dosyalık yükleme rotaları için: yerelde form verisindeki "file" alanını kaydeder,
 * Blob'da istemcinin doğrudan yüklediği dosyanın yolunu ({ path }) doğrular.
 */
export async function receiveUpload(req: Request, kind: UploadKind, subdir: string, missingMessage: string): Promise<string> {
  if (storageDriver() === "blob") {
    const { path: rel } = (await req.json().catch(() => ({}))) as { path?: unknown };
    if (typeof rel !== "string") throw new UploadError(missingMessage);
    return verifyDirectUpload(rel, kind, subdir);
  }
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw new UploadError(missingMessage);
  return saveUpload(file, kind, subdir);
}
