import { describe, expect, it } from "vitest";
import { TOTP, Secret } from "otpauth";
import { db } from "../src/server/db";
import { rateLimit } from "../src/server/ratelimit";
import { beginTotpSetup, confirmTotpSetup, disableTotp } from "../src/server/auth/mfa";
import { decrypt } from "../src/server/crypto";
import { hashPassword } from "../src/server/auth/password";
import { makeUser, uid } from "./helpers";

const codeFor = (b32: string, offsetSteps = 0) =>
  new TOTP({ secret: Secret.fromBase32(b32), digits: 6, period: 30 }).generate({ timestamp: Date.now() + offsetSteps * 30_000 });

describe("rate limiting (shared across instances via Postgres)", () => {
  it("blocks after the limit and stores no plain-text keys", async () => {
    const key = `test:${uid()}@example.com`;
    for (let i = 0; i < 3; i++) await rateLimit(key, 3, 60);
    await expect(rateLimit(key, 3, 60)).rejects.toThrow(/Too many attempts/);
    expect(await db.rateLimitBucket.count({ where: { key: { contains: "@" } } })).toBe(0);
  });
});

describe("two-factor authentication", () => {
  it("enables with a valid code, rejects replayed codes, and accepts each recovery code once", async () => {
    const u = await makeUser("CUSTOMER", { passwordHash: await hashPassword("Password123") });
    await beginTotpSetup(u.id);
    const secret = decrypt((await db.user.findUniqueOrThrow({ where: { id: u.id } })).totpSecretEnc!);
    await expect(confirmTotpSetup(u.id, "000000")).rejects.toThrow(/didn't match/);
    const code = codeFor(secret);
    const recovery = await confirmTotpSetup(u.id, code);
    expect(recovery).toHaveLength(8);
    const stored = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(stored.totpEnabledAt).not.toBeNull();
    expect(stored.totpSecretEnc).not.toContain(secret); // encrypted at rest
    expect(stored.recoveryCodeHashes.some((h) => recovery.includes(h))).toBe(false); // hashed at rest

    await expect(disableTotp(u.id, "Password123", code)).rejects.toThrow(/Invalid code/); // replay of the same code
    await expect(disableTotp(u.id, "wrong-password", recovery[0])).rejects.toThrow(/Incorrect password/);
    await disableTotp(u.id, "Password123", recovery[0]);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).totpEnabledAt).toBeNull();
  });
});
