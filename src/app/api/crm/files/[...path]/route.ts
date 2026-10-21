import { getCurrentUser } from "@/lib/auth";
import { PRIVATE_DIR, resolveSafe } from "@/lib/storage";
import { serveFile } from "@/lib/serve-file";

export const dynamic = "force-dynamic";

// Ekspertiz PDF'leri yalnızca oturum açmış personel tarafından görüntülenebilir.
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Yetkisiz", { status: 401 });
  const { path } = await params;
  const full = resolveSafe(PRIVATE_DIR, path);
  if (!full) return new Response("Bulunamadı", { status: 404 });
  return serveFile(full, req.headers.get("range"), { "Cache-Control": "private, no-store" });
}
