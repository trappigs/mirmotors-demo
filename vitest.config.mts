import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globalSetup: "./tests/global-setup.ts",
    env: { DATABASE_URL: "file:./test.db", SESSION_SECRET: "test-secret-0123456789abcdef" },
    fileParallelism: false,
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
