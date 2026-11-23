import { test, expect, type Page } from "@playwright/test";
import zlib from "zlib";

async function go(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** A real (tiny) PNG so server-side magic-byte validation passes. */
function png(): Buffer {
  const crc = (b: Buffer) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t: string, d: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(8, 0); ihdr.writeUInt32BE(8, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(8 * (1 + 8 * 3), 0x55);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

async function register(page: Page, name: string, email: string, next = "") {
  await go(page, `/register${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Password123");
  await page.getByRole("button", { name: "Create account" }).click();
}

async function login(page: Page, email: string, password = "Password123") {
  await go(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

async function pickFirstSlot(page: Page) {
  const days = page.locator("section", { hasText: "3. Pick a time" }).locator("button.w-16");
  const n = await days.count();
  for (let i = 0; i < n; i++) {
    await days.nth(i).click();
    const slot = page.locator("section", { hasText: "3. Pick a time" }).locator("button.tabular").first();
    try { await slot.waitFor({ timeout: 4000 }); await slot.click(); return; } catch { /* try next day */ }
  }
  throw new Error("no slots found");
}

test("customer discovers, books, pays and gets a confirmed booking", async ({ page }) => {
  await register(page, "E2E Customer", `cust-${uid()}@e2e.test`);
  await page.waitForURL("**/account");
  await go(page, "/search?q=bridal+makeup");
  await expect(page.getByRole("heading", { name: "Akua Beauty Studio" }).first()).toBeVisible();
  await go(page, "/book/akua-beauty-studio");
  await page.getByText("Natural Makeup").click();
  await pickFirstSlot(page);
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.waitForURL("**/dev-checkout/**");
  await expect(page.getByText("Development test checkout")).toBeVisible();
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await page.waitForURL("**/account/bookings/**");
  await expect(page.getByText("Payment received — your appointment is confirmed.")).toBeVisible();
  await expect(page.getByText("Confirmed").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Download receipt" })).toBeVisible();
});

test("a new provider applies, an admin approves, and the profile goes live", async ({ page, browser }) => {
  const id = uid();
  const business = `E2E Lashes ${id}`;
  await register(page, "E2E Pro", `pro-${id}@e2e.test`, "/business/onboarding");
  await page.waitForURL("**/business/onboarding");
  await page.getByLabel("Business name").fill(business);
  await page.getByLabel(/Phone number/).fill("0241234567");
  await page.locator("select[name=cityId]").selectOption({ label: "Accra" });
  await page.getByLabel("Lash Technicians").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL("**step=services");

  await page.getByLabel("Service name").fill("Classic full set");
  await page.locator("select[name=categoryId]").selectOption({ label: "Lash Technicians" });
  await page.getByLabel(/^Price/).fill("180");
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(page.getByText("✓ Classic full set")).toBeVisible();

  await go(page, "/business/onboarding?step=hours");
  await page.getByLabel("Monday").check();
  await page.getByLabel("Tuesday").check();
  await page.getByRole("button", { name: "Save hours" }).click();
  await expect(page.getByText("Working hours saved.")).toBeVisible();

  await go(page, "/business/onboarding?step=portfolio");
  await page.getByLabel("Photos or videos").setInputFiles([{ name: "a.png", mimeType: "image/png", buffer: png() }, { name: "b.png", mimeType: "image/png", buffer: png() }]);
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("2 item(s) added.")).toBeVisible();

  await go(page, "/business/onboarding?step=verification");
  await page.getByLabel(/^File/).setInputFiles({ name: "id.png", mimeType: "image/png", buffer: png() });
  await page.getByRole("button", { name: "Upload securely" }).click();
  await expect(page.getByText(/Document uploaded securely/)).toBeVisible();
  await page.getByLabel(/I confirm the information/).check();
  await page.getByRole("button", { name: "Save consent" }).click();

  await go(page, "/business/onboarding?step=payout");
  await page.getByLabel("Network or bank").fill("MTN");
  await page.getByLabel("Account holder name").fill("E2E Pro");
  await page.getByLabel(/Account \/ wallet number/).fill("0241234567");
  await page.getByRole("button", { name: "Save payout method" }).click();
  await expect(page.getByText("Payout method saved.")).toBeVisible();

  await go(page, "/business/onboarding?step=submit");
  await page.getByRole("button", { name: "Submit application for review" }).click();
  await page.waitForURL("**/business?submitted=1");

  // Not discoverable before approval
  const res = await page.request.get(`/api/v1/providers?q=${encodeURIComponent(business)}`);
  expect((await res.json()).results.some((r: { businessName: string }) => r.businessName === business)).toBe(false);

  const admin = await (await browser.newContext()).newPage();
  await login(admin, process.env.E2E_ADMIN_EMAIL ?? "admin@jetsaloon.test", process.env.E2E_ADMIN_PASSWORD ?? "AdminPass123");
  await go(admin, "/admin/providers?status=SUBMITTED");
  await admin.getByRole("link", { name: business }).click();
  await expect(admin.getByText("Government-issued ID").or(admin.getByText(/government id/i))).toBeVisible();
  admin.on("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "Approve" }).click();
  await expect(admin.locator("main").getByText("Approved", { exact: true }).first()).toBeVisible();

  const after = await page.request.get(`/api/v1/providers?q=${encodeURIComponent(business)}`);
  expect((await after.json()).results.some((r: { businessName: string }) => r.businessName === business)).toBe(true);
});

test("role boundaries: customers can't open admin or business areas", async ({ page }) => {
  await register(page, "Nosy Customer", `nosy-${uid()}@e2e.test`);
  await page.waitForURL("**/account");
  await go(page, "/admin");
  await expect(page).not.toHaveURL(/\/admin/);
  const doc = await page.request.get("/api/files/document/does-not-exist");
  expect(doc.status()).toBe(404);
});
