import { defineConfig, devices } from "@playwright/test";

/** E2E runs against a running dev/staging server with demo data and the dev payment gateway enabled. */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "off" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
