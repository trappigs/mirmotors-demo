import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Galeride daha önce girilmiş marka / seri / model üçlüleri: katalogda olmayan yeni değerler de
 * diğer personele öneri olarak çıksın diye. Önbelleğe alınmaz (yeni girilen hemen görünür).
 */
export async function GET() {
  try {
    await requireApiUser();
    const rows = await prisma.vehicle.findMany({
      where: { brand: { not: null } },
      distinct: ["brand", "model", "packageName"],
      select: { brand: true, model: true, packageName: true },
      take: 5000,
    });
    // Otomatik test kayıtları öneri listesine karışmaz
    const isTest = (s: string | null) => !!s && /\bE2E\b|\(test\)/i.test(s);
    const items = rows
      .filter((r) => r.brand?.trim() && !isTest(r.model) && !isTest(r.packageName))
      .map((r) => ({ brand: r.brand!.trim(), model: r.model?.trim() || null, packageName: r.packageName?.trim() || null }));
    return NextResponse.json(items, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleApiError(e);
  }
}
