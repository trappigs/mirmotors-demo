// .env yoksa .env.example'dan oluşturur ve rastgele bir SESSION_SECRET üretir (tek komutla kurulum için).
import { existsSync, readFileSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";

if (!existsSync(".env")) {
  const env = readFileSync(".env.example", "utf8").replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET="${randomBytes(32).toString("hex")}"`);
  writeFileSync(".env", env);
  console.log(".env oluşturuldu (.env.example'dan).");
}
