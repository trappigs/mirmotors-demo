import { NextResponse, after } from "next/server";
import { createHash } from "crypto";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { canEditDetails } from "@/lib/permissions";
import { optimizeStoredImage, readStored, saveUpload, storageDriver, verifyDirectUpload } from "@/lib/storage";
import { measureImage } from "@/lib/doc-quality";
import { documentAiStatus } from "@/lib/ai/document-read";
import { LIMITS, METHODS, audit, runAnalysis, type Method } from "@/lib/doc-analysis";

export const maxDuration = 300;

type Kind = "RUHSAT" | "FORM";
/**
 * Yeni yüklemede yalnızca ruhsat ve Mir Motors kontrol formu kabul edilir. Dış ekspertiz raporu artık yüklenmez
 * (eski kayıtlardaki ekspertiz görselleri ve okumaları korunur; okuma kodu eski analizler için duruyor).
 */
const KINDS: Kind[] = ["RUHSAT", "FORM"];
const NO_EKSPERTIZ = "Ekspertiz raporu artık yüklenmiyor; kaporta, hasar ve yasal bilgiler için Mir Motors araç kontrol formunu yükleyin.";
const ALLOWED: Record<Method, Kind[]> = { AUTO: KINDS, RUHSAT: ["RUHSAT"], EKSPERTIZ: [], RUHSAT_EKSPERTIZ: [], ADD: KINDS };

/**
 * Belge analizi başlatır. Görseller tarayıcıda maskelenmiş (kişisel veriler kapatılmış) ve JPEG'e çevrilmiş gelir
 * (PDF sayfaları ve HEIC dahil). Sunucu: dosya imzası/boyut doğrulaması, yeniden kodlama (meta veri silinir), kalite ölçümü,
 * aynı dosyanın tekrar yüklenmesi kontrolü. Analiz arka planda (after) yürür; yanıt hemen döner, durum GET ile izlenir.
 * - Yerel: multipart; alanlar "ruhsat" / "form" (sayfa sırasıyla; form sayfalarının sırası içerikten belirlenir), "method", "vehicleId", "masked=1", "simulation=1".
 * - Vercel Blob: JSON { method, vehicleId, masked, simulation, files: [{ kind, path }] } (dosyalar tarayıcıdan doğrudan yüklenir).
 */
export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    let method: string, vehicleId: string | null, masked: boolean, simulation: boolean;
    const items: { kind: Kind; page: number; path: string; buf: Buffer }[] = [];

    if (storageDriver() === "blob") {
      const body = (await req.json().catch(() => ({}))) as { method?: string; vehicleId?: string; masked?: boolean; simulation?: boolean; files?: { kind?: string; path?: unknown }[] };
      ({ method = "", vehicleId = null } = body as { method: string; vehicleId: string | null });
      masked = body.masked === true;
      simulation = body.simulation === true;
      const files = Array.isArray(body.files) ? body.files : [];
      if (files.length > LIMITS.maxPages) return jsonError(`En fazla ${LIMITS.maxPages} sayfa/görsel yüklenebilir`);
      const pages: Record<Kind, number> = { RUHSAT: 0, FORM: 0 };
      for (const f of files) {
        if (f.kind === "EKSPERTIZ") return jsonError(NO_EKSPERTIZ);
        if (!KINDS.includes(f.kind as Kind)) return jsonError("Geçersiz belge türü");
        const kind = f.kind as Kind;
        const rel = await verifyDirectUpload(f.path, "doc", "docs");
        const original = await readStored(rel, true);
        await optimizeStoredImage(rel, "doc");
        items.push({ kind, page: ++pages[kind], path: rel, buf: original });
      }
    } else {
      const form = await req.formData().catch(() => null);
      if (!form) return jsonError("Belge seçilmedi");
      method = String(form.get("method") ?? "");
      vehicleId = (form.get("vehicleId") as string) || null;
      masked = form.get("masked") === "1";
      simulation = form.get("simulation") === "1";
      // Dosyalar kaydedilmeden önce: maskeleme onayı ve yöntem
      if (!masked) return jsonError("Kişisel verilerin maskelendiği onaylanmadan belgeler AI'a gönderilmez.", 422);
      if (!METHODS.includes(method as Method)) return jsonError("Geçersiz yöntem");
      if (form.getAll("ekspertiz").some((f) => f instanceof File && f.size > 0)) return jsonError(NO_EKSPERTIZ);
      for (const kind of KINDS) {
        const files = form.getAll(kind.toLowerCase()).filter((f): f is File => f instanceof File && f.size > 0);
        let page = 0;
        for (const f of files) {
          if (items.length >= LIMITS.maxPages) return jsonError(`En fazla ${LIMITS.maxPages} sayfa/görsel yüklenebilir`);
          const buf = Buffer.from(await f.arrayBuffer());
          items.push({ kind, page: ++page, path: await saveUpload(f, "doc", "docs"), buf });
        }
      }
    }

    if (!METHODS.includes(method as Method)) return jsonError("Geçersiz yöntem");
    const m = method as Method;
    if (items.length === 0) return jsonError("Belge seçilmedi");
    if (!masked) return jsonError("Kişisel verilerin maskelendiği onaylanmadan belgeler AI'a gönderilmez.", 422);
    if (m === "EKSPERTIZ" || m === "RUHSAT_EKSPERTIZ") return jsonError(NO_EKSPERTIZ);
    if (items.some((i) => !ALLOWED[m].includes(i.kind))) return jsonError("Bu yöntemde yalnızca ilgili belge türü yüklenebilir");
    if (items.filter((i) => i.kind === "RUHSAT").length > LIMITS.maxRuhsatPages) return jsonError(`Ruhsat için en fazla ${LIMITS.maxRuhsatPages} görsel`);
    if (items.filter((i) => i.kind === "FORM").length > LIMITS.maxFormPages) return jsonError(`Kontrol formu için en fazla ${LIMITS.maxFormPages} görsel (formun 2 sayfası)`);
    if (m === "ADD") {
      const v = vehicleId ? await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { status: true, optionedById: true } }) : null;
      if (!v) return jsonError("Araç bulunamadı", 404);
      if (!canEditDetails(v, user)) return jsonError("Bu araçta değişiklik yetkiniz yok", 409);
    } else vehicleId = null;

    // Aynı belge tekrar yüklendi mi? (dosya özeti)
    const hashes = items.map((i) => createHash("sha256").update(i.buf).digest("hex"));
    const seen = await prisma.vehicleDocument.findMany({
      where: { sha256: { in: hashes } },
      select: { vehicleId: true, analysisId: true, createdAt: true, analysis: { select: { status: true, createdById: true } } },
    });
    const linked = seen.find((s) => s.vehicleId && s.vehicleId !== vehicleId);
    if (linked) return NextResponse.json({ error: "Bu belge daha önce başka bir araca yüklenmiş. Aynı araç için yeni taslak oluşturulmadı.", vehicleId: linked.vehicleId, duplicate: true }, { status: 409 });
    const pending = seen.find((s) => s.analysisId && !s.vehicleId && s.analysis && !["ERROR", "CANCELLED"].includes(s.analysis.status) && Date.now() - s.createdAt.getTime() < 15 * 60 * 1000);
    if (pending) return NextResponse.json({ id: pending.analysisId, duplicate: true });

    const qualities = await Promise.all(items.map((i) => measureImage(i.buf).catch(() => ({ issues: [] as string[] }))));
    const live = documentAiStatus().live && !simulation;
    const analysis = await prisma.docAnalysis.create({
      data: {
        method: m,
        vehicleId,
        mode: live ? "LIVE" : "SIMULATION",
        createdById: user.id,
        documents: {
          create: items.map((i, n) => ({ kind: i.kind, page: i.page, path: i.path, sha256: hashes[n], masked: true, quality: JSON.stringify(qualities[n].issues), createdById: user.id })),
        },
      },
      include: { documents: { select: { id: true } } },
    });
    for (const d of analysis.documents) await audit(prisma, { action: "UPLOAD", userId: user.id, documentId: d.id, analysisId: analysis.id, vehicleId: vehicleId ?? undefined });
    after(() => runAnalysis(analysis.id));
    return NextResponse.json({ id: analysis.id }, { status: 202 });
  } catch (e) {
    return handleApiError(e);
  }
}
