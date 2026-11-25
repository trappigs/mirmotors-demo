import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import data from "@/data/arac-katalogu.json";

/**
 * Araç kataloğu (marka → seri → motor adları): yalnızca CRM'deki öneri kutuları için, oturum açmış personele.
 * Müşteri sitesinde katalog olarak gösterilmez. Tarayıcı bir gün önbellekte tutar.
 */
export async function GET() {
  try {
    await requireApiUser();
    return NextResponse.json(data.katalog, { headers: { "Cache-Control": "private, max-age=86400" } });
  } catch (e) {
    return handleApiError(e);
  }
}
