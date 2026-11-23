import { defineConfig } from "vitest/config";
import path from "path";

// Each run uses a fresh, uniquely named database, so tests never need to wipe existing data.
const adminUrl = process.env.TEST_DATABASE_ADMIN_URL ?? "postgresql://postgres:postgres@localhost:5432/postgres";
const testDb = `jetsaloon_test_${Date.now()}`;
const testUrl = adminUrl.replace(/\/[^/?]+(\?|$)/, `/${testDb}$1`);
process.env.JS_TEST_DB = testDb;
process.env.JS_TEST_URL = testUrl;

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: testUrl,
      ENCRYPTION_KEY: "1".repeat(64),
      PAYMENTS_DEV_GATEWAY: "true",
      DEV_GATEWAY_SECRET: "test-secret",
      APP_URL: "http://localhost:3000",
      NODE_ENV: "test",
    },
  },
});
