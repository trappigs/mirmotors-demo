import { defineConfig } from "vitest/config";
import path from "path";

// Testler ayrı bir YEREL PostgreSQL veritabanı kullanır (TEST_DATABASE_URL); her çalıştırmada sıfırlanır.
const testDb = process.env.TEST_DATABASE_URL ?? "";

export default defineConfig({
  test: {
    globalSetup: "./tests/global-setup.ts",
    env: { DATABASE_URL: testDb, DATABASE_URL_UNPOOLED: testDb, SESSION_SECRET: "test-secret-0123456789abcdef" },
    fileParallelism: false,
    // Yerel `prisma dev` veritabanında ilk sorgular yavaş olabilir (belge analizi testi ~5 sn sürüyor).
    testTimeout: 20000,
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts") } },
});
