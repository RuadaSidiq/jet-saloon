"use server";
import type { ActionResult } from "@/server/errors";
import { requireUser } from "@/server/auth/guards";
import { beginTotpSetup, confirmTotpSetup, disableTotp } from "@/server/auth/mfa";
import { destroyOtherSessions } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { run, str } from "./_run";

export async function beginMfaAction() {
  return run(async () => {
    const u = await requireUser();
    const r = await beginTotpSetup(u.id);
    return { ok: true, data: r };
  });
}

export async function confirmMfaAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    const codes = await confirmTotpSetup(u.id, str(fd, "code"));
    await destroyOtherSessions(u.id);
    return { ok: true, data: { codes } };
  });
}

export async function disableMfaAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    await disableTotp(u.id, String(fd.get("password") ?? ""), str(fd, "code"));
    return { ok: true, message: "Two-factor authentication turned off." };
  });
}

export async function signOutOthersAction() {
  return run(async () => {
    const u = await requireUser();
    await destroyOtherSessions(u.id);
    await audit({ actorId: u.id, action: "auth.signed_out_others", entityType: "User", entityId: u.id });
    return { ok: true, message: "Signed out of all other devices." };
  });
}
