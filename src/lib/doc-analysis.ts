import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { readStored } from "./storage";
import { recomputeBodySummary } from "./body-parts-db";
import { BODY_PART_KEYS, BODY_PART_LABELS, PART_STATE_INFO, isBodyPartKey } from "./body-parts";
import { CONFLICT_FIELDS, DOC_KIND_LABELS, parseReview, type ConflictField, type DocReview, type Identity } from "./doc-review";
import { DAMAGE_RECORD_LABELS, LIEN_LABELS, warrantyText } from "./listing-rules";
import { DOC_MODEL, DocReadError, documentAiStatus, documentSimulation, readDocuments, type DocumentRead } from "./ai/document-read";
import { QUALITY_LABELS } from "./doc-quality";
import type { QualityIssue } from "./ai/document-sanitize";
import { autoListingNo } from "./listing-rules";
import { normalizeColor } from "./constants";
import { plateDuplicates } from "./plates";

/** AUTO: yüklenen belge türlerinden (ruhsat / ekspertiz / kontrol formu, herhangi bir birleşim) belirlenir. Diğerleri eski istemciler için. */
export const METHODS = ["AUTO", "RUHSAT", "RUHSAT_EKSPERTIZ", "EKSPERTIZ", "ADD"] as const;
export type Method = (typeof METHODS)[number];
export type DocImageKind = "RUHSAT" | "EKSPERTIZ" | "FORM";
export const LIMITS = {
  maxPages: 10, // bir analizdeki toplam görsel (PDF sayfaları dahil)
  maxRuhsatPages: 2,
  maxFormPages: 2,
  maxAttempts: 3, // ilk deneme + en fazla 2 yeniden deneme (kullanıcı başlatır)
  staleMs: 6 * 60 * 1000, // "Analiz ediliyor" bundan uzun sürerse zaman aşımı sayılır
  dailyLive: Number(process.env.OPENAI_DAILY_ANALYSIS_LIMIT ?? 40), // günlük gerçek AI analizi sınırı (maliyet koruması)
};

type Tx = Prisma.TransactionClient;

export async function audit(db: Tx | typeof prisma, a: { action: string; userId: string; documentId?: string; analysisId?: string; vehicleId?: string; note?: string }) {
  await db.documentAudit.create({ data: a });
}

/** Stokta (satılmamış) aynı plakaya veya şasi son 6 haneye sahip araçlar. */
export async function stockDuplicates(db: Tx | typeof prisma, plate: string | null, vin: string | null, excludeId?: string) {
  if (!plate && !vin) return [];
  // Plaka yazım farkı (boşluk, küçük harf) aynı plaka sayılır
  const plateIds = (await plateDuplicates(db, plate, excludeId)).map((d) => d.id);
  const or = [...(plateIds.length ? [{ id: { in: plateIds } }] : []), ...(vin ? [{ legalVin: vin }] : [])];
  if (!or.length) return [];
  const rows = await db.vehicle.findMany({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      status: { notIn: ["SOLD", "ARCHIVED"] },
      OR: or,
    },
    select: { id: true, brand: true, model: true, year: true, status: true, legalPlate: true, legalVin: true },
    take: 5,
  });
  return rows.map((v) => ({
    id: v.id,
    title: [v.brand ?? "Marka girilmedi", v.model, v.year].filter(Boolean).join(" "),
    status: v.status,
    match: [plateIds.includes(v.id) ? "plaka" : null, vin && v.legalVin === vin ? "şasi" : null].filter(Boolean).join(" + "),
  }));
}

/** Analiz işinin güncel durumu (çok uzun süren "Analiz ediliyor" zaman aşımına düşer). */
export async function getAnalysis(id: string) {
  const a = await prisma.docAnalysis.findUnique({ where: { id }, include: { documents: { orderBy: [{ kind: "asc" }, { page: "asc" }] } } });
  if (a && (a.status === "ANALYZING" || a.status === "COMPARING" || a.status === "UPLOADED") && Date.now() - a.updatedAt.getTime() > LIMITS.staleMs) {
    await prisma.docAnalysis.updateMany({ where: { id, status: a.status }, data: { status: "ERROR", error: "Zaman aşımı: analiz tamamlanamadı. Yeniden deneyebilirsiniz." } });
    return prisma.docAnalysis.findUnique({ where: { id }, include: { documents: { orderBy: [{ kind: "asc" }, { page: "asc" }] } } });
  }
  return a;
}

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Analizi çalıştırır (arka planda, `after()` içinde). Yalnızca "Yüklendi" durumundaki işi sahiplenir; iptal edilen işin sonucu yazılmaz.
 * Geçici hatada (429/5xx/biçim) bir kez otomatik yeniden dener; sonra "Hata" olur, personel en fazla LIMITS.maxAttempts'e kadar elle tekrar başlatabilir.
 */
export async function runAnalysis(id: string) {
  const claimed = await prisma.docAnalysis.updateMany({ where: { id, status: "UPLOADED" }, data: { status: "ANALYZING", attempts: { increment: 1 }, error: null } });
  if (claimed.count !== 1) return;
  const started = Date.now();
  const a = await prisma.docAnalysis.findUniqueOrThrow({ where: { id }, include: { documents: { orderBy: [{ kind: "asc" }, { page: "asc" }] } } });
  const ai = documentAiStatus();
  let usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  try {
    let read: DocumentRead;
    if (ai.live && a.mode === "LIVE") {
      const used = await prisma.docAnalysis.count({ where: { mode: "LIVE", createdAt: { gte: today() }, attempts: { gt: 0 }, id: { not: id } } });
      if (used >= LIMITS.dailyLive) throw new DocReadError(`Günlük AI analiz sınırına ulaşıldı (${LIMITS.dailyLive}). Yarın tekrar deneyin veya bilgileri elle girin.`, false);
      const images = await Promise.all(a.documents.map(async (d) => ({ kind: d.kind as DocImageKind, page: d.page, data: await readStored(d.path, true) })));
      let out;
      try {
        out = await readDocuments(images);
      } catch (e) {
        if (!(e instanceof DocReadError && e.retryable)) throw e;
        if (e.usage) usage = e.usage;
        out = await readDocuments(images); // tek otomatik yeniden deneme
      }
      read = out.read;
      usage = { inputTokens: usage.inputTokens + out.usage.inputTokens, outputTokens: usage.outputTokens + out.usage.outputTokens, costUsd: usage.costUsd + out.usage.costUsd };
    } else {
      read = documentSimulation([...new Set(a.documents.map((d) => d.kind as DocImageKind))], a.documents.filter((d) => d.kind === "FORM").length);
    }
    // Sunucunun ölçtüğü kalite sorunlarını AI'nın bildirdikleriyle birleştir
    for (const d of a.documents) {
      const issues = (JSON.parse(d.quality ?? "[]") as QualityIssue[]).filter(Boolean);
      if (!issues.length) continue;
      const kind = d.kind as DocImageKind;
      const existing = read.quality.find((q) => q.document === kind && q.page === d.page);
      if (existing) existing.issues = [...new Set([...existing.issues, ...issues])];
      else read.quality.push({ document: kind, page: d.page, issues });
    }
    for (const q of read.quality) {
      if (q.issues.length) read.warnings.push(`${DOC_KIND_LABELS[q.document]} ${q.document === "FORM" ? "görsel" : "sayfa"} ${q.page}: ${q.issues.map((i) => QUALITY_LABELS[i]).join(", ")} — değerleri belgeyle tek tek karşılaştırın.`);
    }

    const cmp = await prisma.docAnalysis.updateMany({ where: { id, status: "ANALYZING" }, data: { status: "COMPARING" } });
    if (cmp.count !== 1) return; // iptal edildi

    const vehicleId = await prisma.$transaction(async (tx) => {
      const cur = await tx.docAnalysis.findUniqueOrThrow({ where: { id }, select: { status: true } });
      if (cur.status !== "COMPARING") return null;
      const vid = a.method === "ADD" && a.vehicleId ? await applyToExisting(tx, a.vehicleId, id, read, a.createdById) : await createReviewVehicle(tx, id, read, a.mode, a.createdById, a.documents.some((d) => d.kind === "RUHSAT"));
      await tx.vehicleDocument.updateMany({ where: { analysisId: id }, data: { vehicleId: vid } });
      await tx.docAnalysis.update({
        where: { id },
        data: { status: "REVIEW", vehicleId: vid, result: JSON.stringify(read), durationMs: Date.now() - started, ...usage, model: a.mode === "LIVE" ? DOC_MODEL : null },
      });
      await audit(tx, { action: "ANALYZE", userId: a.createdById, analysisId: id, vehicleId: vid, note: `${a.mode === "LIVE" ? DOC_MODEL : "simülasyon"} · ${usage.inputTokens}+${usage.outputTokens} token · ~$${usage.costUsd.toFixed(4)}` });
      for (const d of a.documents) await audit(tx, { action: "LINK", userId: a.createdById, documentId: d.id, analysisId: id, vehicleId: vid });
      return vid;
    }, { timeout: 20_000 });
    if (!vehicleId) return;
  } catch (e) {
    const msg = e instanceof DocReadError ? e.message : e instanceof Error && e.name === "TimeoutError" ? "AI yanıtı zaman aşımına uğradı." : "Analiz sırasında beklenmeyen bir hata oluştu.";
    if (e instanceof DocReadError && e.usage) usage = { inputTokens: usage.inputTokens + e.usage.inputTokens, outputTokens: usage.outputTokens + e.usage.outputTokens, costUsd: usage.costUsd + e.usage.costUsd };
    if (!(e instanceof DocReadError)) console.error("doc-analysis", id, e instanceof Error ? e.name : "hata"); // belge içeriği loglanmaz
    await prisma.docAnalysis.updateMany({
      where: { id, status: { in: ["ANALYZING", "COMPARING"] } },
      data: { status: "ERROR", error: msg, durationMs: Date.now() - started, inputTokens: { increment: usage.inputTokens }, outputTokens: { increment: usage.outputTokens }, costUsd: { increment: usage.costUsd } },
    });
  }
}

/** Belge alan adı → araç sütunu (farklı olanlar). */
const UNCERTAIN_COLUMN: Record<string, string> = { plate: "legalPlate", vinLast6: "legalVin", enginePowerHp: "enginePower" };

const AI_FIELD_LABELS: Record<string, string> = {
  brand: "Marka", model: "Model", packageName: "Tip / paket", year: "Model yılı", km: "Kilometre", fuel: "Yakıt", transmission: "Vites",
  color: "Renk", engineCc: "Motor hacmi (cc)", enginePowerHp: "Motor gücü (hp)", plate: "Plaka", vinLast6: "Şasi no (son 6)",
  firstRegistration: "İlk tescil tarihi", vehicleClass: "Araç cinsi", vehicleType: "Araç tipi (D.2)", tradeName: "Ticari adı (D.3)", inspectionUntil: "Muayene geçerlilik", bodyType: "Kasa tipi", seats: "Koltuk sayısı", tramerAmount: "Tramer (raporda)", ownerIsCompany: "Tescil sahibi",
};

function aiFields(read: DocumentRead, ruhsatRead: boolean): DocReview["aiFields"] {
  const v = read.vehicle as Record<string, unknown>;
  const out: DocReview["aiFields"] = Object.keys(AI_FIELD_LABELS)
    .filter((k) => v[k] !== null && v[k] !== undefined)
    .map((k) => {
      const src = read.sources.find((s) => s.field === k) ?? read.sources.find((s) => k.startsWith(s.field) || s.field.startsWith(k));
      const raw = v[k];
      const value = k === "ownerIsCompany" ? (raw ? "İşletme (ticari unvan)" : "Şahıs") : k === "vinLast6" && read.vehicle.vinPartial ? `${raw} (kısmi okuma)` : String(raw);
      const fallback = read.origin?.[k] ?? (ruhsatRead && !["km", "transmission", "tramerAmount"].includes(k) ? "RUHSAT" : "EKSPERTIZ");
      return { field: k, label: AI_FIELD_LABELS[k], value, document: read.origin?.[k] ?? src?.document ?? fallback, page: src?.page ?? null, evidence: src?.text ?? "", location: src?.location ?? null };
    });
  // Kontrol formundan okunan ilan bilgileri (personel beyanı; onaydan önce kesinleşmez)
  const f = read.form;
  if (f) {
    const add = (field: string, label: string, value: string | null | undefined, page = 1) => {
      if (value) out.push({ field, label, value, document: "FORM", page, evidence: "", location: null });
    };
    add("price", "Satış fiyatı", f.vehicle.price ? `${new Intl.NumberFormat("tr-TR").format(f.vehicle.price)} TL` : null);
    add("drivetrain", "Çekiş", f.vehicle.drivetrain);
    add("stockCode", "Stok kodu", f.vehicle.stockCode);
    add("damageRecord", "Hasar kaydı", f.legal.damageRecord ? DAMAGE_RECORD_LABELS[f.legal.damageRecord] : null);
    add("damageNote", "Hasarın niteliği", f.legal.damageNote);
    add("tramerAmount", "Tramer tutarı (formda)", f.legal.tramerAmount !== null ? `${new Intl.NumberFormat("tr-TR").format(f.legal.tramerAmount)} TL` : null);
    add("legalLien", "Rehin / haciz", f.legal.legalLien ? LIEN_LABELS[f.legal.legalLien] : null);
    add("warrantyStatus", "Garanti", f.legal.warrantyStatus ? warrantyText(f.legal) : null);
    if (f.parts) {
      const known = BODY_PART_KEYS.filter((k) => f.parts![k] !== "UNKNOWN");
      const marked = known.filter((k) => f.parts![k] !== "ORIGINAL").map((k) => `${BODY_PART_LABELS[k]}: ${PART_STATE_INFO[f.parts![k]].label}`);
      add("parts", "Kaporta (formdaki işaretler)", `${known.length}/13 parça işaretli${marked.length ? ` · ${marked.join(", ")}` : known.length ? " · tümü orijinal" : ""}`);
    }
    add("authority", "Satış yetkisi (beyan)", [f.legal.registeredToCompany && "Mir Motors adına tescilli", f.legal.ownerConsent && "Sahibinden satış/ilan izni alındı"].filter(Boolean).join(" · "), 2);
    add("equipment", "Donanım", f.equipment?.length ? `${f.equipment.length} donanım: ${f.equipment.join(", ")}` : null, 2);
  }
  return out;
}

function vehicleDataFrom(read: DocumentRead) {
  const v = read.vehicle;
  const findings = [read.findings.engine && `Motor: ${read.findings.engine}`, read.findings.mechanical && `Mekanik: ${read.findings.mechanical}`, read.findings.electrical && `Elektrik/elektronik: ${read.findings.electrical}`]
    .filter(Boolean).join(" ");
  const f = read.form;
  return {
    brand: v.brand, model: v.model, packageName: v.packageName, year: v.year, km: v.km, fuel: v.fuel, transmission: v.transmission, color: normalizeColor(v.color) || null,
    engineCc: v.engineCc, enginePower: v.enginePowerHp, legalPlate: v.plate, legalVin: v.vinLast6, legalVinPartial: v.vinPartial,
    // Ruhsattaki tescil sahibi önceliklidir; ruhsat yoksa formdaki beyan
    // Ruhsat okunamadıysa (ör. yalnızca sol sayfa) galeri adına kabul edilir: Mir Motors stoku galeri adına tescillidir (işletme kararı).
    // Ruhsatta açıkça şahıs adı okunursa false kalır ve personel kontrol eder.
    legalRegisteredToCompany: v.ownerIsCompany ?? f?.legal.registeredToCompany ?? true,
    firstRegistration: v.firstRegistration, vehicleClass: v.vehicleClass, vehicleType: v.vehicleType ?? null, tradeName: v.tradeName ?? null, inspectionUntil: v.inspectionUntil ?? null, bodyType: v.bodyType, seats: v.seats,
    tramerAmount: f?.legal.tramerAmount ?? v.tramerAmount, damageNote: read.damageNote,
    expertiseSummary: [read.expertiseSummary, findings].filter(Boolean).join(" ") || null,
    // Kontrol formu: fiyat, çekiş, stok kodu, hasar kaydı, rehin/haciz, garanti, satış izni, donanım (okunmayan alan boş kalır)
    price: f?.vehicle.price ?? null, drivetrain: f?.vehicle.drivetrain ?? null, stockCode: f?.vehicle.stockCode ?? null,
    damageRecord: f?.legal.damageRecord ?? null, legalLien: f?.legal.legalLien ?? null,
    warrantyStatus: f?.legal.warrantyStatus ?? null, warrantyUntil: f?.legal.warrantyUntil ?? null, warrantyKm: f?.legal.warrantyKm ?? null,
    legalOwnerConsent: f?.legal.ownerConsent === true ? true : undefined,
    equipment: f?.equipment?.length ? JSON.stringify(f.equipment) : undefined,
  };
}

function newReview(analysisId: string, read: DocumentRead, dups: DocReview["stockDuplicates"], ruhsatRead: boolean): DocReview {
  return {
    analysisIds: [analysisId],
    identity: read.identity,
    identityNote: read.identityNote,
    identityResolved: read.identity === "SAME" || read.identity === "SINGLE",
    conflicts: read.conflicts.map((c) => ({ ...c, resolved: null })),
    aiFields: aiFields(read, ruhsatRead),
    missing: read.missing,
    uncertain: read.uncertain ?? [],
    stockDuplicates: dups,
    duplicatesAcknowledged: dups.length === 0,
    ownerCheckRequired: ruhsatRead && read.vehicle.ownerIsCompany === false,
    ownerChecked: false,
    aiConfirmed: false,
    warnings: read.warnings,
    findings: read.findings,
  };
}

/** Belgeden yeni araç: "Kontrol Bekliyor" (REVIEW) durumunda; ekspertiz parçaları yalnızca rapor tarafına. */
async function createReviewVehicle(tx: Tx, analysisId: string, read: DocumentRead, mode: string | null, userId: string, ruhsatRead: boolean) {
  const data = vehicleDataFrom(read);
  const dups = await stockDuplicates(tx, data.legalPlate, data.legalVin);
  const created = await tx.vehicle.create({
    data: {
      ...data,
      equipment: data.equipment ?? "[]",
      status: "REVIEW",
      createdById: userId,
      aiDraftMode: mode === "LIVE" ? "LIVE" : "SIMULATION",
      docReview: JSON.stringify(newReview(analysisId, read, dups, ruhsatRead)),
    },
  });
  const v = await tx.vehicle.update({ where: { id: created.id }, data: { legalListingNo: autoListingNo(created.id) } });
  await tx.statusHistory.create({
    data: { vehicleId: v.id, fromStatus: null, toStatus: "REVIEW", action: "create", userId, note: `Belgeden oluşturuldu (${mode === "LIVE" ? "canlı AI" : "simülasyon"}) — Kontrol Bekliyor` },
  });
  await writeReportParts(tx, v.id, read, userId);
  return v.id;
}

/**
 * Kaporta: ekspertiz raporu → rapor tarafı (reportState); kontrol formu → personel beyanı (state).
 * İkisi farklıysa mevcut "ekspertiz raporuyla çelişki" uyarısı ve yayın engeli devreye girer; hangisinin doğru olduğuna AI/kod karar vermez.
 * Formdan gelen beyan yalnızca henüz "Bilinmiyor" olan parçaya yazılır (personelin girdiği değer ezilmez); okunamayan parça yazılmaz.
 */
async function writeReportParts(tx: Tx, vehicleId: string, read: DocumentRead, userId: string) {
  const current = new Map((await tx.vehiclePart.findMany({ where: { vehicleId }, select: { part: true, state: true } })).map((p) => [p.part, p.state]));
  for (const k of BODY_PART_KEYS) {
    const report = read.parts[k] !== "UNKNOWN" ? read.parts[k] : undefined;
    const staff = read.form?.parts && read.form.parts[k] !== "UNKNOWN" && (current.get(k) ?? "UNKNOWN") === "UNKNOWN" ? read.form.parts[k] : undefined;
    if (!isBodyPartKey(k) || (!report && !staff)) continue;
    await tx.vehiclePart.upsert({
      where: { vehicleId_part: { vehicleId, part: k } },
      create: { vehicleId, part: k, state: staff ?? "UNKNOWN", reportState: report ?? "UNKNOWN", updatedById: userId },
      update: { ...(report ? { reportState: report } : {}), ...(staff ? { state: staff } : {}), updatedById: userId },
    });
  }
  await recomputeBodySummary(tx, vehicleId);
}

/**
 * Mevcut araca sonradan belge (ör. ekspertiz) ekleme: yalnızca BOŞ alanlar doldurulur, personelin girdiği değerler ezilmez.
 * Mevcut kayıtla farklı olan kimlik alanları çelişki olarak incelemeye düşer; şasi uyuşmazsa hiçbir bilgi aktarılmaz.
 */
async function applyToExisting(tx: Tx, vehicleId: string, analysisId: string, read: DocumentRead, userId: string) {
  const v = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
  const data = vehicleDataFrom(read);
  let identity: Identity = read.identity === "DIFFERENT" ? "DIFFERENT" : "SAME";
  let note = read.identityNote;
  if (v.legalVin && data.legalVin) {
    if (v.legalVin !== data.legalVin) {
      identity = "DIFFERENT";
      note = `Yeni belgedeki şasi (…${data.legalVin}) araç kaydındakiyle (…${v.legalVin}) uyuşmuyor. Bilgiler aktarılmadı.`;
    }
  } else if (v.legalPlate && data.legalPlate && v.legalPlate !== data.legalPlate) {
    identity = "REVIEW";
    note = "Yeni belgedeki plaka araç kaydından farklı; plaka değişmiş olabilir. Aynı araç olduğunu doğrulayın.";
  }
  const conflicts: DocReview["conflicts"] = [];
  const updates: Record<string, unknown> = {};
  if (identity !== "DIFFERENT") {
    const current = v as unknown as Record<string, unknown>;
    for (const [k, val] of Object.entries(data)) {
      if (val === null || val === undefined || val === "") continue;
      // Boş sayılanlar: null/"" ve varsayılan değerler (donanım "[]", satış izni false)
      const empty = current[k] === null || current[k] === undefined || current[k] === "" || (k === "equipment" && current[k] === "[]") || (k === "legalOwnerConsent" && current[k] === false);
      if (empty) updates[k] = val;
    }
    for (const [field, meta] of Object.entries(CONFLICT_FIELDS) as [ConflictField, (typeof CONFLICT_FIELDS)[ConflictField]][]) {
      const have = current[meta.column], got = (data as Record<string, unknown>)[meta.column];
      if (have != null && got != null && String(have) !== String(got)) {
        conflicts.push({ field, label: meta.label, ruhsat: String(have), ekspertiz: String(got), resolved: null, labels: ["Araç kaydı", "Yeni belge"] });
      }
    }
    if ("legalVin" in updates) updates.legalVinPartial = data.legalVinPartial;
  }
  const dups = await stockDuplicates(tx, (updates.legalPlate as string) ?? v.legalPlate, (updates.legalVin as string) ?? v.legalVin, vehicleId);
  const prev = parseReview(v.docReview);
  const add = newReview(analysisId, read, dups, false);
  const review: DocReview = {
    ...add,
    analysisIds: [...(prev?.analysisIds ?? []), analysisId],
    identity,
    identityNote: note,
    identityResolved: identity === "SAME",
    conflicts: [...(prev?.conflicts.filter((c) => c.resolved) ?? []), ...read.conflicts.map((c) => ({ ...c, resolved: null })), ...conflicts],
    aiFields: identity === "DIFFERENT" ? [] : add.aiFields,
    // Emin olunamayan değerlerden yalnızca araca gerçekten yazılanlar (mevcut değer korunduysa sorulmaz)
    uncertain: identity === "DIFFERENT" ? [] : (add.uncertain ?? []).filter((u) => Object.hasOwn(updates, Object.hasOwn(UNCERTAIN_COLUMN, u.field) ? UNCERTAIN_COLUMN[u.field] : u.field)),
    ownerCheckRequired: prev?.ownerCheckRequired ?? false,
    ownerChecked: prev?.ownerChecked ?? false,
  };
  await tx.vehicle.update({
    where: { id: vehicleId },
    data: { ...updates, docReview: JSON.stringify(review), ...(v.status === "DRAFT" ? { status: "REVIEW" } : {}) },
  });
  await tx.statusHistory.create({
    data: { vehicleId, fromStatus: v.status, toStatus: v.status === "DRAFT" ? "REVIEW" : v.status, action: "edit", userId, note: `Belge eklendi ve okundu; ${Object.keys(updates).length} boş alan dolduruldu (mevcut değerler korunur)` },
  });
  if (identity !== "DIFFERENT") await writeReportParts(tx, vehicleId, read, userId);
  return vehicleId;
}
