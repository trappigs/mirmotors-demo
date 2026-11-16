"use client";
// Tarayıcıda belge hazırlığı: PDF sayfalarını, HEIC (iPhone) ve diğer görselleri JPEG sayfalarına çevirir.
// Böylece maskeleme ve AI okuması her sayfa için aynı yoldan yürür; PDF/HEIC dosyası sunucuya hiç gönderilmez.

export type DocPage = { blob: Blob; url: string; width: number; height: number; label: string };

export const MAX_PDF_PAGES = 6;
const MAX_EDGE = 2400;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/** Takılan adımda kullanıcıyı sonsuz beklemede bırakmamak için zaman aşımı. */
function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
}

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isHeic = (f: File) => /image\/hei[cf]/.test(f.type) || /\.(heic|heif)$/i.test(f.name);

async function sniffHead(f: File) {
  return new Uint8Array(await f.slice(0, 16).arrayBuffer());
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Görsel oluşturulamadı"))), "image/jpeg", quality));
}

async function imageToPage(src: Blob, label: string): Promise<DocPage> {
  const bmp = await createImageBitmap(src, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await canvasToJpeg(canvas);
  return { blob, url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height, label };
}

/** Dosyayı sayfa görsellerine çevirir. İçerik imzası denetlenir; uzantıya güvenilmez. */
export async function fileToPages(file: File): Promise<DocPage[]> {
  if (file.size > MAX_INPUT_BYTES) throw new Error(`${file.name}: dosya çok büyük (en fazla 25 MB)`);
  const head = await sniffHead(file);
  const ascii = String.fromCharCode(...head);
  if (isPdf(file)) {
    if (!ascii.startsWith("%PDF-")) throw new Error(`${file.name}: PDF dosyası değil`);
    const pdfjs = await withTimeout(import("pdfjs-dist"), 20_000, "PDF okuyucu yüklenemedi");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    // Gömülü komut dosyaları ve dış bağlantılar devre dışı; yalnızca sayfa görüntüsü üretilir.
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), enableXfa: false, stopAtErrors: true,
      standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/", iccUrl: "/pdfjs/iccs/", cMapUrl: "/pdfjs/cmaps/", cMapPacked: true });
    const doc = await withTimeout(task.promise, 20_000, `${file.name}: PDF açılamadı`);
    if (doc.numPages > MAX_PDF_PAGES) throw new Error(`${file.name}: en fazla ${MAX_PDF_PAGES} sayfalık PDF yüklenebilir (${doc.numPages} sayfa)`);
    const pages: DocPage[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(3, MAX_EDGE / Math.max(base.width, base.height)) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await withTimeout(page.render({ canvas, viewport }).promise, 30_000, `${file.name}: sayfa ${i} çizilemedi`);
      const blob = await canvasToJpeg(canvas);
      pages.push({ blob, url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height, label: `${file.name} · sayfa ${i}` });
    }
    await task.destroy();
    return pages;
  }
  if (isHeic(file)) {
    const heic2any = (await import("heic2any")).default;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    return [await imageToPage(Array.isArray(out) ? out[0] : out, file.name)];
  }
  const isJpeg = head[0] === 0xff && head[1] === 0xd8;
  const isPng = head[0] === 0x89 && ascii.slice(1, 4) === "PNG";
  const isWebp = ascii.slice(0, 4) === "RIFF" && ascii.slice(8, 12) === "WEBP";
  if (!isJpeg && !isPng && !isWebp) throw new Error(`${file.name}: desteklenmeyen dosya (JPG, PNG, WEBP, HEIC veya PDF)`);
  return [await imageToPage(file, file.name)];
}

/** Görselin üzerine siyah dikdörtgenler çizerek yeni JPEG üretir (kişisel veri maskeleme). */
export async function applyMask(page: DocPage, rects: { x: number; y: number; w: number; h: number }[]): Promise<DocPage> {
  const bmp = await createImageBitmap(page.blob);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  ctx.fillStyle = "#000";
  for (const r of rects) ctx.fillRect(r.x * canvas.width, r.y * canvas.height, r.w * canvas.width, r.h * canvas.height);
  const blob = await canvasToJpeg(canvas);
  return { ...page, blob, url: URL.createObjectURL(blob) };
}
