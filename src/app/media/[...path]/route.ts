import { getCurrentUser } from "@/lib/auth";
import { PRIVATE_MEDIA_CACHE, PUBLIC_MEDIA_CACHE, isPublicMedia } from "@/lib/media-access";
import { PUBLIC_DIR, resolveSafe, serveBlob, storageDriver } from "@/lib/storage";
import { serveFile } from "@/lib/serve-file";

export const dynamic = "force-dynamic";

/**
 * Araç fotoğrafı ve videosu. Müşteriye yalnızca yayındaki aracın medyası açıktır; satılan / satış bekleyen /
 * taslak aracın medyası ve onaylanmamış videolar 404 döner (personel CRM'de görmeye devam eder).
 */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = path.join("/");
  const isPublic = await isPublicMedia(rel);
  if (!isPublic && !(await getCurrentUser())) return new Response("Bulunamadı", { status: 404, headers: { "Cache-Control": "no-store" } });
  const cache = { "Cache-Control": isPublic ? PUBLIC_MEDIA_CACHE : PRIVATE_MEDIA_CACHE, Vary: "Cookie" };

  if (storageDriver() === "blob") return serveBlob(path, false, req.headers.get("range"), cache);
  const full = resolveSafe(PUBLIC_DIR, path);
  if (!full) return new Response("Bulunamadı", { status: 404 });
  return serveFile(full, req.headers.get("range"), cache);
}
