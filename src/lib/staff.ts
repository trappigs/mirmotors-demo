import "server-only";
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { handleApiError, jsonError } from "./api";

/** Şifre kuralı: en az 10 karakter, en az bir harf ve bir rakam. */
export const PASSWORD_MIN = 10;
export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Şifre en az ${PASSWORD_MIN} karakter olmalı.`;
  if (pw.length > 128) return "Şifre en fazla 128 karakter olabilir.";
  if (!/\p{L}/u.test(pw) || !/\d/.test(pw)) return "Şifrede en az bir harf ve bir rakam bulunmalı.";
  return null;
}

/** Geçici şifre: karışmayan harf/rakamlardan (0/O, 1/l yok), 12 karakter, harf ve rakam içerir. */
export function generateTempPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  for (;;) {
    let s = "";
    for (let i = 0; i < 12; i++) s += all[randomInt(all.length)];
    if (!passwordProblem(s)) return s;
  }
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);

/**
 * Türkiye cep telefonu → 905XXXXXXXXX (yalnız rakam; WhatsApp'ın gönderen kimliği "wa_id" ile aynı biçim —
 * asistan personeli bu alanla eşleştirir). Boş → null. Geçersizse hata metni.
 */
export function normalizePhone(input: string | null | undefined): { phone: string | null; error?: string } {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (!digits) return { phone: null };
  const local = digits.startsWith("90") && digits.length === 12 ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
  if (!/^5\d{9}$/.test(local)) return { phone: null, error: "Cep telefonu 05XX XXX XX XX biçiminde olmalı." };
  return { phone: `90${local}` };
}

/** 905321234567 (veya eski +905321234567) → 0532 123 45 67 */
export function formatPhone(phone: string | null): string {
  const m = phone?.match(/^\+?90(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone ?? "";
}

const name = z.string().trim().min(2, "Ad en az 2 karakter olmalı.").max(80);
const email = z.string().trim().toLowerCase().email("Geçerli bir e-posta girin.").max(120);
const role = z.enum(["ADMIN", "SALES"], { message: "Rol Yönetici veya Satış Personeli olmalı." });
const phone = z.string().trim().max(30).optional().nullable();

export const createStaffSchema = z.object({ name, email, role, phone });
export const updateStaffSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), name, email, role, phone }),
  z.object({ action: z.literal("deactivate") }),
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("resetPassword") }),
]);

/** E-posta / telefon tekrarını anlaşılır mesaja çevirir; diğer hatalar genel işleyiciye gider. */
export function staffError(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = String((e.meta?.target as string[] | string | undefined) ?? "");
    return jsonError(target.includes("phone") ? "Bu telefon numarası başka bir personelde kayıtlı." : "Bu e-posta başka bir personelde kayıtlı.", 409);
  }
  return handleApiError(e);
}

export const STAFF_ACTION_LABELS: Record<string, string> = {
  CREATE: "Hesap açıldı",
  UPDATE: "Bilgileri güncellendi",
  DEACTIVATE: "Pasif yapıldı",
  ACTIVATE: "Yeniden aktif yapıldı",
  RESET_PASSWORD: "Şifresi sıfırlandı",
  CHANGE_PASSWORD: "Kendi şifresini değiştirdi",
};
