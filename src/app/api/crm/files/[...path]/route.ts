import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/doc-analysis";
import { PRIVATE_DIR, resolveSafe, serveBlob, storageDriver } from "@/lib/storage";
import { serveFile } from "@/lib/serve-file";

export const dynamic = "force-dynamic";

// Ekspertiz PDF'leri yalnızca oturum açmış personel tarafından görüntülenebilir.
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Yetkisiz", { status: 401 });
  const { path } = await params;
  const headers = { "Cache-Control": "private, no-store" };
  // Ruhsat / ekspertiz görüntülemesi denetim kaydına yazılır (KVKK: kim, ne zaman baktı)
  if (path[0] === "docs") {
    const doc = await prisma.vehicleDocument.findUnique({ where: { path: path.join("/") }, select: { id: true, vehicleId: true } });
    if (!doc) return new Response("Bulunamadı", { status: 404, headers });
    await audit(prisma, { action: "VIEW", userId: user.id, documentId: doc.id, vehicleId: doc.vehicleId ?? undefined });
  }
  if (storageDriver() === "blob") return serveBlob(path, true, req.headers.get("range"), headers);
  const full = resolveSafe(PRIVATE_DIR, path);
  if (!full) return new Response("Bulunamadı", { status: 404 });
  return serveFile(full, req.headers.get("range"), headers);
}
