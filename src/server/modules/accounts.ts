import { z } from "zod";
import { db } from "../db";
import { AppError } from "../errors";
import { randomToken, sha256 } from "../crypto";
import { hashPassword, isStrongEnough, verifyPassword } from "../auth/password";
import { rateLimit } from "../ratelimit";
import { notify } from "../notify";
import { audit } from "../audit";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().refine(isStrongEnough, "Use at least 8 characters, including a letter and a number"),
  countryCode: z.string().length(2).optional(),
  referralCode: z.string().trim().max(20).optional(),
});

const referral = () => randomToken(6).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase().padEnd(8, "X");

export async function registerUser(input: z.infer<typeof registerSchema>, ip = "unknown") {
  await rateLimit(`register:${ip}`, 10, 3600);
  const data = registerSchema.parse(input);
  if (await db.user.findUnique({ where: { email: data.email } })) throw new AppError("EMAIL_TAKEN", "An account with this email already exists. Try signing in.");
  const country = data.countryCode ? await db.country.findUnique({ where: { code: data.countryCode.toUpperCase() } }) : null;
  const referrer = data.referralCode ? await db.user.findUnique({ where: { referralCode: data.referralCode.toUpperCase() } }) : null;
  const user = await db.user.create({
    data: { name: data.name, email: data.email, passwordHash: await hashPassword(data.password), countryId: country?.id, referralCode: referral(), referredById: referrer?.id },
  });
  await sendVerificationEmail(user.id);
  return user;
}

export async function authenticate(emailRaw: string, password: string, ip = "unknown") {
  const email = emailRaw.trim().toLowerCase();
  await rateLimit(`login:${ip}`, 20, 900);
  await rateLimit(`login:${email}`, 8, 900);
  const user = await db.user.findUnique({ where: { email } });
  // Constant-ish time: always run a bcrypt compare.
  const ok = await verifyPassword(password, user?.passwordHash ?? "$2a$12$abcdefghijklmnopqrstuuJ0cE9sQ8yYb0j3Vt8ZtS4l0yq3gq1aW");
  if (!user || !ok) {
    if (user?.role === "ADMIN") await audit({ actorId: user.id, action: "auth.login_failed", entityType: "User", entityId: user.id, ip });
    throw new AppError("BAD_CREDENTIALS", "Incorrect email or password");
  }
  if (user.status !== "ACTIVE") throw new AppError("SUSPENDED", "This account is not active. Please contact support.");
  return user;
}

async function issueToken(userId: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET", ttlMin: number) {
  const token = randomToken();
  await db.verificationToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  await db.verificationToken.create({ data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMin * 60_000) } });
  return token;
}

export async function sendVerificationEmail(userId: string) {
  await rateLimit(`verify-mail:${userId}`, 5, 3600);
  const token = await issueToken(userId, "EMAIL_VERIFY", 60 * 48);
  await notify(userId, "account.verify_email", "Confirm your email", "Please confirm your email address to secure your account.", `/verify-email?token=${token}`);
}

async function consumeToken(token: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET") {
  const t = await db.verificationToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.type !== type || t.usedAt || t.expiresAt < new Date()) throw new AppError("BAD_TOKEN", "This link is invalid or has expired");
  const r = await db.verificationToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
  if (!r.count) throw new AppError("BAD_TOKEN", "This link has already been used");
  return t;
}

export async function verifyEmail(token: string) {
  const t = await consumeToken(token, "EMAIL_VERIFY");
  await db.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } });
}

export async function requestPasswordReset(emailRaw: string, ip = "unknown") {
  await rateLimit(`reset:${ip}`, 5, 3600);
  const user = await db.user.findUnique({ where: { email: emailRaw.trim().toLowerCase() } });
  if (!user) return; // do not reveal whether the email exists
  const token = await issueToken(user.id, "PASSWORD_RESET", 60);
  await notify(user.id, "account.password_reset", "Reset your password", "Use the link below to choose a new password. It expires in 1 hour.", `/reset-password?token=${token}`);
}

export async function resetPassword(token: string, password: string) {
  if (!isStrongEnough(password)) throw new AppError("WEAK", "Use at least 8 characters, including a letter and a number");
  const t = await consumeToken(token, "PASSWORD_RESET");
  await db.user.update({ where: { id: t.userId }, data: { passwordHash: await hashPassword(password) } });
  await db.session.deleteMany({ where: { userId: t.userId } }); // sign out everywhere
  await audit({ actorId: t.userId, action: "account.password_reset", entityType: "User", entityId: t.userId });
}

export async function changePassword(userId: string, current: string, next: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(current, u.passwordHash))) throw new AppError("BAD_CREDENTIALS", "Your current password is incorrect");
  if (!isStrongEnough(next)) throw new AppError("WEAK", "Use at least 8 characters, including a letter and a number");
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  const { destroyOtherSessions } = await import("../auth/session");
  await destroyOtherSessions(userId); // sign out every other device
  await audit({ actorId: userId, action: "account.password_changed", entityType: "User", entityId: userId });
}

/** Validate a phone number against the country's configured pattern; returns E.164. */
export async function normalisePhone(raw: string, countryId: string) {
  const c = await db.country.findUniqueOrThrow({ where: { id: countryId } });
  let digits = raw.replace(/[^\d+]/g, "");
  const cc = c.phoneCountryCode.replace("+", "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith(cc)) digits = digits.slice(cc.length);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!new RegExp(`^${c.phonePattern}$`).test(digits)) throw new AppError("PHONE", `Enter a valid ${c.name} phone number`);
  return `+${cc}${digits}`;
}
