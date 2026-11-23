import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { TOTP, Secret } from "otpauth";

/**
 * Production-mode security checks (run against `next start`): CSP + headers, admin 2FA enforcement,
 * TOTP setup and sign-in. Skipped unless E2E_PROD=1.
 */
test.skip(!process.env.E2E_PROD, "production-mode only");

test("security headers and strict CSP are present, and pages still hydrate", async ({ page, request }) => {
  const res = await request.get("/");
  const csp = res.headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(csp).not.toContain("unsafe-eval");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(res.headers()["strict-transport-security"]).toContain("max-age=");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  const violations: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && /Content Security Policy/i.test(m.text())) violations.push(m.text()); });
  await page.goto("/login"); await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => Object.keys(document.querySelector("form")!).some((k) => k.startsWith("__react")))).toBe(true);
  expect(violations).toEqual([]);
});

test("admins are forced to set up 2FA, then must use a code to sign in", async ({ page }) => {
  const db = new PrismaClient();
  const email = `mfa-admin-${Date.now()}@e2e.test`;
  await db.user.create({ data: { email, name: "MFA Admin", passwordHash: await bcrypt.hash("Password123", 12), role: "ADMIN", isSuperAdmin: true, referralCode: `MFA${Date.now()}` } });

  const login = async () => {
    await page.goto("/login"); await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill("Password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login") || u.pathname.startsWith("/login/verify"));
  };
  await login();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/account\/security\?required=1/);

  await page.getByRole("button", { name: "Set up two-factor authentication" }).click();
  const secret = (await page.locator("code").first().textContent())!.trim();
  const totp = new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 });
  await page.getByPlaceholder("123456").fill(totp.generate());
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Two-factor authentication is on.")).toBeVisible();
  await expect(page.locator("ul.font-mono li")).toHaveCount(8);

  await page.goto("/admin"); await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  // sign out, sign back in: password alone is not enough
  await page.context().clearCookies();
  await login();
  await page.waitForURL(/\/login\/verify/);
  await page.getByLabel("Verification code").fill("000000");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page.getByText("Invalid code")).toBeVisible();
  const fresh = totp.generate({ timestamp: Date.now() + 30_000 }); // next step: never used before
  await page.getByLabel("Verification code").fill(fresh);
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await page.waitForURL(/\/admin/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await db.$disconnect();
});
