// Veritabanını SIFIRLAYAN komutlar (npm run setup / demo / db:reset) yalnızca yerel veritabanında çalışır.
// Bulut (Neon/Vercel) veritabanı yanlışlıkla silinmesin diye localhost dışındaki adreslerde durur.
import { existsSync } from "fs";
import { isLocalDatabaseUrl } from "./db-url.mjs";

if (existsSync(".env")) process.loadEnvFile(".env"); // var olan ortam değişkenlerini ezmez

if (!isLocalDatabaseUrl(process.env.DATABASE_URL)) {
  console.error(
    "DURDURULDU: DATABASE_URL yerel bir veritabanı değil. Bu komut tüm verileri siler ve yalnızca localhost'ta çalışır.\n" +
      "Bulut veritabanına ilk demo verisini yüklemek için: npm run db:seed:cloud (yalnızca boş veritabanına yükler).",
  );
  process.exit(1);
}
