"use server";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/server/errors";
import { authenticate, registerUser, requestPasswordReset, resetPassword, sendVerificationEmail } from "@/server/modules/accounts";
import { createSession, destroySession } from "@/server/auth/session";
import { completeMfaChallenge, startMfaChallenge } from "@/server/auth/mfa";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { clientIp, run, str } from "./_run";

const safeNext = (n: string, fallback: string) => (n.startsWith("/") && !n.startsWith("//") ? n : fallback);
const home = (role: string) => (role === "ADMIN" ? "/admin" : role === "PROVIDER" ? "/business" : "/account");

export async function loginAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const ip = await clientIp();
    const user = await authenticate(str(fd, "email"), String(fd.get("password") ?? ""), ip);
    const next = safeNext(str(fd, "next"), home(user.role));
    if (user.totpEnabledAt) {
      await startMfaChallenge(user.id);
      return { ok: true, data: { redirect: `/login/verify?next=${encodeURIComponent(next)}` } };
    }
    await createSession(user.id);
    if (user.role === "ADMIN") await audit({ actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id, ip });
    return { ok: true, data: { redirect: next } };
  });
}

export async function registerAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const user = await registerUser({ name: str(fd, "name"), email: str(fd, "email"), password: String(fd.get("password") ?? ""), countryCode: str(fd, "country") || undefined, referralCode: str(fd, "ref") || undefined }, await clientIp());
    await createSession(user.id);
    return { ok: true, data: { redirect: safeNext(str(fd, "next"), "/account") } };
  });
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function forgotAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    await requestPasswordReset(str(fd, "email"), await clientIp());
    return { ok: true, message: "If an account exists for that email, we've sent a reset link." };
  });
}

export async function resetAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    await resetPassword(str(fd, "token"), String(fd.get("password") ?? ""));
    return { ok: true, data: { redirect: "/login?reset=1" } };
  });
}

export async function resendVerificationAction() {
  return run(async () => {
    const u = await requireUser();
    await sendVerificationEmail(u.id);
    return { ok: true, message: "Verification email sent." };
  });
}

export async function mfaVerifyAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const userId = await completeMfaChallenge(str(fd, "code"));
    await createSession(userId);
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (u.role === "ADMIN") await audit({ actorId: u.id, action: "auth.login", entityType: "User", entityId: u.id, ip: await clientIp(), metadata: { mfa: true } });
    return { ok: true, data: { redirect: safeNext(str(fd, "next"), home(u.role)) } };
  });
}
