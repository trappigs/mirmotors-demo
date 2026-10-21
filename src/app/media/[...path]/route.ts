import { PUBLIC_DIR, resolveSafe } from "@/lib/storage";
import { serveFile } from "@/lib/serve-file";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const full = resolveSafe(PUBLIC_DIR, path);
  if (!full) return new Response("Bulunamadı", { status: 404 });
  return serveFile(full, req.headers.get("range"), { "Cache-Control": "public, max-age=3600" });
}
