// Araç fotoğraflarını yüklemeden önce tarayıcıda hazırlar: HEIC/HEIF (iPhone) → JPEG, büyük fotoğrafları küçültür.
// Saf yardımcılar (boyut hesabı, tür tespiti, tekrar eleme) DOM'suz test edilebilir; DOM kullanan kısım yalnızca preparePhoto'dadır.
// Sunucu yine her dosyayı imzasından doğrular (JPEG/PNG/WEBP); burası yalnızca kolaylık ve hız içindir.

export type PhotoKind = "jpeg" | "png" | "webp" | "heic";

/** Hazırlanan fotoğrafın en uzun kenarı (piksel). */
export const PREP_MAX_EDGE = 2560;
/** Bu boyutun altındaki ve PREP_MAX_EDGE'i aşmayan fotoğraflar yeniden sıkıştırılmaz (kalite korunur). */
export const PREP_REENCODE_BYTES = 1.5 * 1024 * 1024;
export const PREP_JPEG_QUALITY = 0.88;
/** Sunucu sınırları (UPLOAD_LIMITS.photo ve fotoğraf rotasındaki MAX_PHOTOS ile aynı). */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_MAX_COUNT = 40;
/** Tarayıcıda işlenebilecek en büyük ham dosya (telefon belleğini korumak için). */
export const PREP_MAX_INPUT_BYTES = 40 * 1024 * 1024;

/** Dosya seçicinin kabul listesi: iPhone'un HEIC fotoğrafları da seçilebilsin. */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";

/** Dosya adı / MIME türünden fotoğraf türünü tahmin eder (içerik imzası yoksa yedek yol). */
export function kindFromName(name: string, type: string): PhotoKind | null {
  const t = (type || "").toLowerCase();
  if (/^image\/hei[cf](-sequence)?$/.test(t)) return "heic";
  if (t === "image/jpeg" || t === "image/jpg" || t === "image/pjpeg") return "jpeg";
  if (t === "image/png") return "png";
  if (t === "image/webp") return "webp";
  const ext = (name.match(/\.([^.]+)$/)?.[1] ?? "").toLowerCase();
  if (ext === "heic" || ext === "heif") return "heic";
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "png") return "png";
  if (ext === "webp") return "webp";
  return null;
}

/** Dosyanın ilk baytlarından (imza) türünü bulur. Tanınmazsa null. */
export function kindFromBytes(head: Uint8Array): PhotoKind | null {
  if (head.length < 12) return null;
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "png";
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(ascii(8, 12))) return "heic";
  return null;
}

/** En uzun kenarı maxEdge'i aşmayacak şekilde oranı koruyarak hedef boyutu hesaplar. */
export function targetSize(width: number, height: number, maxEdge = PREP_MAX_EDGE): { width: number; height: number; scaled: boolean } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { width: w, height: h, scaled: false };
  const s = maxEdge / longest;
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)), scaled: true };
}

/** Yeniden JPEG'e çevirmek gerekir mi? HEIC her zaman; diğerleri yalnızca büyükse. Küçük dosyaların kalitesi bozulmaz. */
export function needsReencode(kind: PhotoKind, bytes: number, width: number, height: number): boolean {
  if (kind === "heic") return true;
  return bytes > PREP_REENCODE_BYTES || Math.max(width, height) > PREP_MAX_EDGE;
}

/** Uzantıyı .jpg yapar ("IMG_0001.HEIC" → "IMG_0001.jpg"). */
export function toJpgName(name: string): string {
  const base = (name || "").replace(/\.[^./\\]*$/, "").trim();
  return `${base || "foto"}.jpg`;
}

/** Değiştirilmeden yüklenecek dosyanın uzantısını içerik türüyle uyumlu hale getirir (sunucu uzantıyı da denetler). */
export function nameForKind(name: string, kind: Exclude<PhotoKind, "heic">): string {
  const ext = kind === "jpeg" ? ".jpg" : `.${kind}`;
  const current = (name.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();
  const ok = kind === "jpeg" ? current === ".jpg" || current === ".jpeg" : current === ext;
  if (ok) return name;
  const base = (name || "").replace(/\.[^./\\]*$/, "").trim();
  return `${base || "foto"}${ext}`;
}

export const mimeOf = (kind: Exclude<PhotoKind, "heic">) => (kind === "jpeg" ? "image/jpeg" : `image/${kind}`);

type FileLike = { name: string; size: number; lastModified: number };

/** Aynı dosyayı tanımak için anahtar (ad + boyut + değiştirilme zamanı). */
export const fileKey = (f: FileLike) => `${f.name}|${f.size}|${f.lastModified}`;

/** Seçimdeki birebir aynı dosyaları ve zaten kuyrukta olanları eler; sırayı korur. */
export function dedupeFiles<T extends FileLike>(files: readonly T[], existingKeys: Iterable<string> = []): { unique: T[]; duplicates: T[] } {
  const seen = new Set(existingKeys);
  const unique: T[] = [];
  const duplicates: T[] = [];
  for (const f of files) {
    const k = fileKey(f);
    if (seen.has(k)) duplicates.push(f);
    else {
      seen.add(k);
      unique.push(f);
    }
  }
  return { unique, duplicates };
}

/** 40 fotoğraf sınırına göre kaç yeni fotoğraf daha eklenebileceğini döndürür. */
export function remainingSlots(existing: number, queued: number, max = PHOTO_MAX_COUNT): number {
  return Math.max(0, max - existing - queued);
}

/** Diziden bir öğeyi alıp başka sıraya taşır (yeni dizi döndürür). Geçersiz indekste diziyi aynen döndürür. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = list.slice();
  if (from < 0 || from >= out.length || to < 0 || to >= out.length || from === to) return out;
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

/** Aynı anda en fazla n işin çalışmasını sağlar; bekleyenler sırayla (ilk gelen ilk) başlar. */
export function makeLimiter(n: number) {
  let active = 0;
  const waiters: (() => void)[] = [];
  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= n) await new Promise<void>((r) => waiters.push(r));
    else active++;
    try {
      return await fn();
    } finally {
      // Boşalan yer doğrudan sıradakine devredilir (araya başka iş giremez).
      const next = waiters.shift();
      if (next) next();
      else active--;
    }
  };
}

export function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}

// ---- Tarayıcı (DOM) kısmı ----

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p, new Promise<T>((_, rej) => (t = setTimeout(() => rej(new Error(msg)), ms)))]).finally(() => clearTimeout(t));
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

/** Görseli çözer; EXIF yönünü uygular. createImageBitmap yoksa veya seçenekleri desteklemiyorsa <img> ile çözer. */
async function decode(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // Eski Safari seçenekli çağrıyı desteklemeyebilir; <img> yoluna geç.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Fotoğraf açılamadı"));
      img.src = url;
    });
    // Güncel tarayıcılar <img> çiziminde EXIF yönünü kendiliğinden uygular.
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function toJpegBlob(source: CanvasImageSource, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Fotoğraf işlenemedi (tarayıcı belleği yetersiz olabilir)"));
  ctx.fillStyle = "#fff"; // saydam PNG'ler siyah değil beyaz zeminle kaydedilsin
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise((res, rej) =>
    canvas.toBlob((b) => {
      // iOS'ta tuvali hemen serbest bırak (bellek)
      canvas.width = 0;
      canvas.height = 0;
      if (b) res(b);
      else rej(new Error("Fotoğraf işlenemedi (tarayıcı belleği yetersiz olabilir)"));
    }, "image/jpeg", PREP_JPEG_QUALITY),
  );
}

/** HEIC/HEIF'i JPEG'e çevirir: önce tarayıcının kendi çözücüsü (yeni Safari), olmazsa heic2any. */
async function heicToDecoded(file: File): Promise<Decoded> {
  try {
    return await decode(file);
  } catch {
    // Tarayıcı HEIC çözemiyor (Chrome/Android, eski Safari): heic2any ile dönüştür.
  }
  const heic2any = (await withTimeout(import("heic2any"), 30_000, "HEIC dönüştürücü yüklenemedi")).default;
  const out = await withTimeout(heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 }), 90_000, "HEIC fotoğraf dönüştürülemedi (zaman aşımı)");
  return decode(Array.isArray(out) ? out[0] : out);
}

/**
 * Fotoğrafı yüklemeye hazırlar. Küçük JPEG/PNG/WEBP olduğu gibi döner; HEIC ve büyük fotoğraflar
 * en uzun kenarı 2560 piksel olan JPEG'e çevrilir. Hata mesajları personel için Türkçe ve kısadır.
 */
export async function preparePhoto(file: File): Promise<File> {
  if (file.size === 0) throw new Error("Dosya boş");
  if (file.size > PREP_MAX_INPUT_BYTES) throw new Error(`Dosya çok büyük (${formatMB(file.size)})`);
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const kind = kindFromBytes(head) ?? (kindFromName(file.name, file.type) === "heic" ? "heic" : null);
  if (!kind) throw new Error("Desteklenmeyen dosya (JPG, PNG, WEBP veya HEIC olmalı)");

  let decoded: Decoded;
  try {
    decoded = kind === "heic" ? await heicToDecoded(file) : await decode(file);
  } catch (e) {
    throw new Error(kind === "heic" ? `iPhone (HEIC) fotoğrafı çevrilemedi: ${(e as Error).message}` : "Fotoğraf açılamadı (dosya bozuk olabilir)");
  }

  try {
    if (kind !== "heic" && !needsReencode(kind, file.size, decoded.width, decoded.height)) {
      // Küçük fotoğraf: dokunmadan yükle (yalnızca uzantı/tür içerikle uyumlu hale getirilir).
      const name = nameForKind(file.name, kind);
      const type = mimeOf(kind);
      return name === file.name && file.type === type ? file : new File([file], name, { type, lastModified: file.lastModified });
    }
    const size = targetSize(decoded.width, decoded.height);
    const blob = await toJpegBlob(decoded.source, size.width, size.height);
    // Yeniden sıkıştırma dosyayı büyüttüyse ve boyut zaten uygunsa orijinali kullan.
    if (kind === "jpeg" && !size.scaled && blob.size >= file.size && file.size <= PHOTO_MAX_BYTES) {
      return new File([file], nameForKind(file.name, "jpeg"), { type: "image/jpeg", lastModified: file.lastModified });
    }
    if (blob.size > PHOTO_MAX_BYTES) throw new Error(`Fotoğraf küçültüldükten sonra da çok büyük (${formatMB(blob.size)})`);
    return new File([blob], toJpgName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
  } finally {
    decoded.close();
  }
}
