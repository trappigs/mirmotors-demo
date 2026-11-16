// Tek bir personelin şifresini değiştirir (yerel veya bulut veritabanı). Hiçbir veriyi silmez.
// Kullanım (PowerShell): $env:EMAIL="ahmet@mirmotors.demo"; $env:YENI_SIFRE="..."; npm run personel:sifre
// Şifre komut satırı argümanı olarak verilmez (geçmişe yazılmasın diye ortam değişkeninden okunur).
import { existsSync } from "fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

if (existsSync(".env")) process.loadEnvFile(".env");

async function main() {
  const email = process.env.EMAIL?.trim().toLowerCase();
  const password = process.env.YENI_SIFRE ?? "";
  if (!email) throw new Error("EMAIL ortam değişkeni gerekli.");
  if (password.length < 12) throw new Error("YENI_SIFRE en az 12 karakter olmalı.");
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`Kullanıcı bulunamadı: ${email}`);
    const others = await prisma.user.findMany({ where: { id: { not: user.id } }, select: { email: true, passwordHash: true } });
    for (const o of others) {
      if (await bcrypt.compare(password, o.passwordHash)) throw new Error(`Bu şifre ${o.email} hesabında kullanılıyor; her personelin şifresi farklı olmalı.`);
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 10), failedLogins: 0, failWindowStart: null } });
    console.log(`Şifre güncellendi: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
