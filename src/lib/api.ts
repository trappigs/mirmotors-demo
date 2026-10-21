import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth";
import { UploadError } from "./storage";

export const jsonError = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** API hatalarını tutarlı JSON yanıtlarına çevirir. */
export function handleApiError(e: unknown) {
  if (e instanceof AuthError) return jsonError(e.message, e.status);
  if (e instanceof UploadError) return jsonError(e.message, 422);
  if (e instanceof ZodError) return jsonError(e.issues.map((i) => i.message).join(" · "), 422);
  console.error(e);
  return jsonError("Beklenmeyen bir hata oluştu", 500);
}
