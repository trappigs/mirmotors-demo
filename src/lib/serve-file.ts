import "server-only";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
};

/** Dosyayı HTTP Range desteğiyle (video ileri/geri sarma için) servis eder. */
export async function serveFile(fullPath: string, rangeHeader: string | null, extraHeaders: Record<string, string> = {}) {
  let size: number;
  try {
    const s = await stat(fullPath);
    if (!s.isFile()) return new Response("Bulunamadı", { status: 404 });
    size = s.size;
  } catch {
    return new Response("Bulunamadı", { status: 404 });
  }
  const type = TYPES[path.extname(fullPath).toLowerCase()] ?? "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  };
  if (type === "image/svg+xml") headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'";

  const m = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? parseInt(m[1], 10) : size - parseInt(m[2], 10);
    let end = m[1] && m[2] ? parseInt(m[2], 10) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(createReadStream(fullPath, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(createReadStream(fullPath)) as ReadableStream;
  return new Response(stream, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
}
