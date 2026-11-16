import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";

const text = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable());
const schema = z.object({ title: text(200), authorizationNo: text(60), mersis: text(20), address: text(300) });

/** İşletme bilgileri (ticari unvan, yetki belgesi no…): yalnızca yönetici değiştirir; her ilana otomatik eklenir. */
export async function PUT(req: Request) {
  try {
    const user = await requireApiUser();
    if (user.role !== "ADMIN") return jsonError("İşletme bilgilerini yalnızca yönetici değiştirebilir.", 403);
    const data = schema.parse(await req.json());
    await prisma.companySettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...data, updatedById: user.id },
      update: { ...data, updatedById: user.id },
    });
    revalidatePath("/", "layout"); // site alt bilgisi ve ilan sayfaları
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
