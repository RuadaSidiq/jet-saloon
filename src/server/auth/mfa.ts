import "server-only";
import { TOTP, Secret } from "otpauth";
import QRCode from "qrcode";
import { cookies } from "next/headers";
import { db } from "../db";
import { AppError } from "../errors";
import { decrypt, encrypt, randomToken, sha256 } from "../crypto";
import { verifyPassword } from "./password";
import { audit } from "../audit";
import { rateLimit } from "../ratelimit";

const ISSUER = "Muv";
const PENDING_COOKIE = process.env.NODE_ENV === "production" ? "__Host-muv_mfa" : "muv_mfa";

/** Admins must use 2FA in production (override with ADMIN_MFA_REQUIRED=false only for local/dev). */
export const adminMfaRequired = () => (process.env.ADMIN_MFA_REQUIRED ?? (process.env.NODE_ENV === "production" ? "true" : "false")) === "true";

function totpFor(secretB32: string, label: string) {
  return new TOTP({ issuer: ISSUER, label, algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secretB32) });
}

/** Step 1 of setup: create (or replace an unconfirmed) secret and return a QR code to scan. */
export async function beginTotpSetup(userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (u.totpEnabledAt) throw new AppError("MFA_ON", "Two-factor authentication is already on");
  const secret = new Secret({ size: 20 }).base32;
  await db.user.update({ where: { id: userId }, data: { totpSecretEnc: encrypt(secret), totpLastStep: null } });
  const uri = totpFor(secret, u.email).toString();
  return { qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }), secret };
}

/** Validate a 6-digit code with ±1 step tolerance and replay protection. */
async function checkTotp(userId: string, code: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!u.totpSecretEnc) return false;
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const delta = totpFor(decrypt(u.totpSecretEnc), u.email).validate({ token: clean, window: 1 });
  if (delta === null) return false;
  const step = Math.floor(Date.now() / 30_000) + delta;
  if (u.totpLastStep != null && step <= u.totpLastStep) return false; // already used
  const r = await db.user.updateMany({ where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] }, data: { totpLastStep: step } });
  return r.count === 1;
}

/** Step 2 of setup: confirm with a code; returns one-time recovery codes (shown once, stored hashed). */
export async function confirmTotpSetup(userId: string, code: string) {
  await rateLimit(`mfa-setup:${userId}`, 10, 900);
  if (!(await checkTotp(userId, code))) throw new AppError("MFA_CODE", "That code didn't match. Check your authenticator app's time and try again.");
  const codes = Array.from({ length: 8 }, () => randomToken(6).replace(/[^A-Za-z0-9]/g, "").slice(0, 10).toUpperCase().padEnd(10, "X"));
  await db.user.update({ where: { id: userId }, data: { totpEnabledAt: new Date(), recoveryCodeHashes: codes.map((c) => sha256(c)) } });
  await audit({ actorId: userId, action: "mfa.enabled", entityType: "User", entityId: userId });
  return codes.map((c) => `${c.slice(0, 5)}-${c.slice(5)}`);
}

export async function disableTotp(userId: string, password: string, code: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (u.role === "ADMIN" && adminMfaRequired()) throw new AppError("MFA_REQUIRED", "Administrators must keep two-factor authentication on");
  if (!(await verifyPassword(password, u.passwordHash))) throw new AppError("BAD_CREDENTIALS", "Incorrect password");
  if (!(await checkTotp(userId, code)) && !(await redeemRecoveryCode(userId, code))) throw new AppError("MFA_CODE", "Invalid code");
  await db.user.update({ where: { id: userId }, data: { totpEnabledAt: null, totpSecretEnc: null, totpLastStep: null, recoveryCodeHashes: [] } });
  await audit({ actorId: userId, action: "mfa.disabled", entityType: "User", entityId: userId });
}

async function redeemRecoveryCode(userId: string, code: string) {
  const h = sha256(code.replace(/[\s-]/g, "").toUpperCase());
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!u.recoveryCodeHashes.includes(h)) return false;
  await db.user.update({ where: { id: userId }, data: { recoveryCodeHashes: u.recoveryCodeHashes.filter((x) => x !== h) } });
  await audit({ actorId: userId, action: "mfa.recovery_code_used", entityType: "User", entityId: userId });
  return true;
}

/** Login step 1 (password OK, 2FA on): issue a short-lived pending token in an HttpOnly cookie. */
export async function startMfaChallenge(userId: string) {
  const token = randomToken();
  await db.verificationToken.create({ data: { userId, type: "MFA_LOGIN", tokenHash: sha256(token), expiresAt: new Date(Date.now() + 10 * 60_000) } });
  (await cookies()).set(PENDING_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
}

/** Login step 2: verify the code (or a recovery code) for the pending challenge. Returns the user id. */
export async function completeMfaChallenge(code: string) {
  const c = await cookies();
  const token = c.get(PENDING_COOKIE)?.value;
  if (!token) throw new AppError("MFA_EXPIRED", "Your sign-in session expired. Please sign in again.");
  const t = await db.verificationToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.type !== "MFA_LOGIN" || t.usedAt || t.expiresAt < new Date()) throw new AppError("MFA_EXPIRED", "Your sign-in session expired. Please sign in again.");
  await rateLimit(`mfa-login:${t.userId}`, 6, 900);
  const ok = (await checkTotp(t.userId, code)) || (await redeemRecoveryCode(t.userId, code));
  if (!ok) {
    await audit({ actorId: t.userId, action: "auth.mfa_failed", entityType: "User", entityId: t.userId });
    throw new AppError("MFA_CODE", "Invalid code. Try again.");
  }
  await db.verificationToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
  c.delete(PENDING_COOKIE);
  return t.userId;
}
