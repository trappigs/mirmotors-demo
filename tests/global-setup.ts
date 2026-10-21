import { execSync } from "child_process";
import { rmSync } from "fs";

// Testler ayrı bir SQLite dosyası (prisma/test.db) kullanır; her çalıştırmada sıfırdan oluşturulur.
export default function setup() {
  rmSync("prisma/test.db", { force: true });
  rmSync("prisma/test.db-journal", { force: true });
  execSync("npx prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: "file:./test.db", PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    stdio: "ignore",
  });
}
