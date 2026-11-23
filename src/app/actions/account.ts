"use server";
import type { ActionResult } from "@/server/errors";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { changePassword, normalisePhone } from "@/server/modules/accounts";
import { saveFile } from "@/server/storage";
import { bool, run, str } from "./_run";

export async function profileAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    const name = str(fd, "name");
    if (name.length < 2) return { ok: false, error: "Enter your name" };
    const countryId = str(fd, "countryId") || u.countryId;
    const phoneRaw = str(fd, "phone");
    const phone = phoneRaw && countryId ? await normalisePhone(phoneRaw, countryId) : null;
    const cityId = str(fd, "cityId") || null;
    if (cityId && !(await db.city.findFirst({ where: { id: cityId, countryId: countryId ?? undefined } }))) return { ok: false, error: "Choose a valid city" };
    let avatarUrl = u.avatarUrl;
    const file = fd.get("avatar");
    if (file instanceof File && file.size > 0) avatarUrl = (await saveFile(file, "public", ["image"])).url;
    await db.user.update({ where: { id: u.id }, data: { name, phone, phoneVerifiedAt: phone !== u.phone ? null : u.phoneVerifiedAt, countryId, cityId, avatarUrl } });
    return { ok: true, message: "Profile saved." };
  });
}

export async function prefsAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    await db.user.update({ where: { id: u.id }, data: { notificationPrefs: { email: bool(fd, "email"), sms: bool(fd, "sms"), inApp: true, marketing: bool(fd, "marketing") }, showProfileToProviders: bool(fd, "showProfile") } });
    return { ok: true, message: "Preferences saved." };
  });
}

export async function passwordAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    await changePassword(u.id, String(fd.get("current") ?? ""), String(fd.get("next") ?? ""));
    return { ok: true, message: "Password changed." };
  });
}

export async function addressAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    if (str(fd, "delete")) {
      await db.address.deleteMany({ where: { id: str(fd, "delete"), userId: u.id } });
      return;
    }
    const line1 = str(fd, "line1");
    if (line1.length < 4) return { ok: false, error: "Enter an address" };
    await db.address.create({ data: { userId: u.id, label: str(fd, "label") || "Home", line1, cityName: str(fd, "cityName"), notes: str(fd, "notes") || null } });
    return { ok: true, message: "Address saved." };
  });
}

export async function markNotificationsReadAction() {
  return run(async () => {
    const u = await requireUser();
    await db.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
  });
}

export async function newsletterAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const email = str(fd, "email").toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email" };
    await db.newsletterSubscriber.upsert({ where: { email }, update: {}, create: { email } });
    return { ok: true, message: "You're subscribed." };
  });
}
