import "server-only";
import { NextResponse } from "next/server";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/** Plaka karşılaştırması: boşluk, tire ve harf büyüklüğü farkı aynı plaka sayılır ("34 abc 123" = "34ABC123"). */
export const normalizePlate = (p: string | null | undefined) => (p ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");

export type PlateDuplicate = { id: string; title: string; status: string };

/**
 * Stokta (satılmamış) aynı plakaya sahip araçlar. Satılmış ve arşivlenmiş araç sayılmaz: yeniden stoğa giren araç engellenmez.
 * Karşılaştırma veritabanında da aynı sadeleştirmeyle yapılır (kayıtlı plaka "34 ABC 123" veya "34ABC123" olabilir).
 */
export async function plateDuplicates(db: Db, plate: string | null | undefined, excludeId?: string): Promise<PlateDuplicate[]> {
  const n = normalizePlate(plate);
  if (!n) return [];
  const rows = await db.$queryRaw<{ id: string; brand: string | null; model: string | null; year: number | null; status: string }[]>`
    SELECT id, brand, model, year, status FROM "Vehicle"
    WHERE regexp_replace(upper(coalesce("legalPlate", '')), '[^0-9A-Z]', '', 'g') = ${n}
      AND status NOT IN ('SOLD', 'ARCHIVED') AND id <> ${excludeId ?? ""}
    ORDER BY "createdAt" DESC LIMIT 5`;
  return rows.map((v) => ({ id: v.id, title: [v.brand ?? "Marka girilmedi", v.model, v.year].filter(Boolean).join(" "), status: v.status }));
}

/** Stokta aynı plakalı araç varken personel seçim yapmadan kayıt açılmaz / plaka değişmez (409 + mevcut kayıtlar). */
export const duplicatePlateResponse = (duplicates: PlateDuplicate[]) =>
  NextResponse.json({ error: "Bu plakayla stokta kayıtlı araç var.", code: "DUPLICATE_PLATE", duplicates }, { status: 409 });
