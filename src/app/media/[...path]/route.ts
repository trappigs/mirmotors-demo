import { PUBLIC_DIR, resolveSafe, serveBlob, storageDriver } from "@/lib/storage";
import { serveFile } from "@/lib/serve-file";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (storageDriver() === "blob") {
    // Dosya adları benzersiz (uuid) ve değişmez: CDN uzun süre önbellekleyebilir.
    return serveBlob(path, false, req.headers.get("range"), { "Cache-Control": "public, max-age=3600, s-maxage=31536000, immutable" });
  }
  const full = resolveSafe(PUBLIC_DIR, path);
  if (!full) return new Response("Bulunamadı", { status: 404 });
  return serveFile(full, req.headers.get("range"), { "Cache-Control": "public, max-age=3600" });
}
