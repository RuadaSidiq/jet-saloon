"use server";
import { fromZonedTime } from "date-fns-tz";
import type { ActionResult } from "@/server/errors";
import { AppError } from "@/server/errors";
import { requireProvider, requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { saveFile } from "@/server/storage";
import { toMinor } from "@/server/money";
import {
  addPayoutMethod, addTimeOff, deleteService, saveBasics, setWorkingHours, submitApplication, upsertService,
} from "@/server/modules/providers";
import { acceptRequest, cancelBooking, completeAppointment, markNoShow, rejectRequest, startAppointment } from "@/server/modules/bookings";
import { requestPayout } from "@/server/modules/payouts";
import { respondToReview } from "@/server/modules/reviews";
import { bool, run, str } from "./_run";

export async function basicsAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    let avatarUrl: string | undefined;
    const file = fd.get("avatar");
    if (file instanceof File && file.size > 0) avatarUrl = (await saveFile(file, "public", ["image"])).url ?? undefined;
    const p = await saveBasics(u.id, {
      displayName: str(fd, "displayName"), businessName: str(fd, "businessName"), businessType: (str(fd, "businessType") || "INDIVIDUAL") as "INDIVIDUAL",
      phone: str(fd, "phone"), countryId: str(fd, "countryId"), cityId: str(fd, "cityId"), neighbourhoodId: str(fd, "neighbourhoodId") || undefined,
      bio: str(fd, "bio") || undefined, yearsExperience: Number(fd.get("yearsExperience") || 0), offersStudio: bool(fd, "offersStudio"), offersHome: bool(fd, "offersHome"),
      studioAddress: str(fd, "studioAddress") || undefined, categoryIds: fd.getAll("categoryIds").map(String),
    });
    if (avatarUrl) await db.providerProfile.update({ where: { id: p.id }, data: { avatarUrl } });
    const next = str(fd, "next");
    return { ok: true, message: "Saved.", data: next ? { redirect: next } : undefined };
  });
}

function serviceInput(fd: FormData) {
  return {
    name: str(fd, "name"), categoryId: str(fd, "categoryId"), subcategoryId: str(fd, "subcategoryId") || undefined, description: str(fd, "description") || undefined,
    price: str(fd, "price"), promoPrice: str(fd, "promoPrice") || undefined, durationMinutes: Number(fd.get("durationMinutes")), prepMinutes: Number(fd.get("prepMinutes") || 0),
    cleanupMinutes: Number(fd.get("cleanupMinutes") || 0), homeServiceAvailable: bool(fd, "homeServiceAvailable"), homeTravelFee: str(fd, "homeTravelFee") || undefined, active: fd.has("active") ? bool(fd, "active") : true,
  };
}

export async function serviceAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { provider } = await requireProvider();
    let imageUrl: string | undefined;
    const file = fd.get("image");
    if (file instanceof File && file.size > 0) imageUrl = (await saveFile(file, "public", ["image"])).url ?? undefined;
    const id = str(fd, "id") || undefined;
    const existing = id ? await db.service.findFirst({ where: { id, providerId: provider.id } }) : null;
    await upsertService(provider.id, { ...serviceInput(fd), imageUrl: imageUrl ?? existing?.imageUrl ?? undefined }, id);
    return { ok: true, message: "Service saved.", data: { redirect: str(fd, "next") || "/business/services" } };
  });
}

export async function serviceToggleAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { provider } = await requireProvider();
    const s = await db.service.findFirst({ where: { id: str(fd, "id"), providerId: provider.id, deletedAt: null } });
    if (!s) throw new AppError("NOT_FOUND", "Service not found");
    if (str(fd, "op") === "delete") await deleteService(provider.id, s.id);
    else await db.service.update({ where: { id: s.id }, data: { active: !s.active } });
  });
}

/** Hours form posts fields like d1_s1=09:00 d1_e1=13:00 d1_s2=14:00 d1_e2=18:00 for each weekday. */
export async function hoursAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { provider } = await requireProvider();
    const staffId = str(fd, "staffId");
    const toMin = (v: string) => { const [h, m] = v.split(":").map(Number); return h * 60 + m; };
    const rows: { weekday: number; startMinute: number; endMinute: number }[] = [];
    for (let d = 0; d < 7; d++) {
      if (!bool(fd, `d${d}_on`)) continue;
      for (const w of [1, 2]) {
        const s = str(fd, `d${d}_s${w}`), e = str(fd, `d${d}_e${w}`);
        if (s && e) rows.push({ weekday: d, startMinute: toMin(s), endMinute: e === "00:00" ? 1440 : toMin(e) });
      }
    }
    await setWorkingHours(provider.id, staffId, rows);
    return { ok: true, message: "Working hours saved." };
  });
}

export async function timeOffAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { provider } = await requireProvider();
    if (str(fd, "delete")) {
      await db.timeOff.deleteMany({ where: { id: str(fd, "delete"), staff: { providerId: provider.id } } });
      return;
    }
    const tz = provider.timezone;
    const from = fromZonedTime(`${str(fd, "from")}T${str(fd, "fromTime") || "00:00"}:00`, tz);
    const to = fromZonedTime(`${str(fd, "to")}T${str(fd, "toTime") || "23:59"}:00`, tz);
    await addTimeOff(provider.id, str(fd, "staffId"), from, to, str(fd, "reason") || undefined);
    return { ok: true, message: "Time off added. Those times can no longer be booked." };
  });
}

export async function staffAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { provider } = await requireProvider();
    if (str(fd, "toggle")) {
      const s = await db.staff.findFirst({ where: { id: str(fd, "toggle"), providerId: provider.id, isOwner: false } });
      if (s) await db.staff.update({ where: { id: s.id }, data: { active: !s.active } });
      return;
    }
    const name = str(fd, "name");
    if (name.length < 2) return { ok: false, error: "Enter a name" };
    await db.staff.create({ data: { providerId: provider.id, name } });
    return { ok: true, message: "Team member added. Set their working hours below." };
  });
}

export async function portfolioAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { provider } = await requireProvider();
    if (str(fd, "delete")) {
      await db.portfolioItem.deleteMany({ where: { id: str(fd, "delete"), providerId: provider.id } });
      return;
    }
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return { ok: false, error: "Choose at least one photo or video" };
    if ((await db.portfolioItem.count({ where: { providerId: provider.id } })) + files.length > 40) return { ok: false, error: "Portfolio limit is 40 items" };
    for (const f of files) {
      const s = await saveFile(f, "public", ["image", "video"]);
      await db.portfolioItem.create({ data: { providerId: provider.id, url: s.url!, mediaType: s.mime.startsWith("video") ? "VIDEO" : "IMAGE", caption: str(fd, "caption") || null } });
    }
    return { ok: true, message: `${files.length} item(s) added.` };
  });
}

export async function documentAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { provider } = await requireProvider();
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file" };
    const type = str(fd, "type");
    if (!["GOVERNMENT_ID", "BUSINESS_REGISTRATION", "CERTIFICATE", "OTHER"].includes(type)) return { ok: false, error: "Choose a document type" };
    const s = await saveFile(file, "private", ["image", "document"]);
    await db.providerDocument.create({ data: { providerId: provider.id, type, storageKey: s.key, fileName: file.name.slice(0, 120), mimeType: s.mime, sizeBytes: s.size } });
    return { ok: true, message: "Document uploaded securely. Only verification staff can see it." };
  });
}

export async function payoutMethodAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { provider } = await requireProvider();
    await addPayoutMethod(provider.id, { type: str(fd, "type") as "BANK", institution: str(fd, "institution"), accountName: str(fd, "accountName"), accountNumber: str(fd, "accountNumber") });
    return { ok: true, message: "Payout method saved." };
  });
}

export async function consentAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { provider } = await requireProvider();
    await db.providerProfile.update({ where: { id: provider.id }, data: { verificationConsent: bool(fd, "consent") } });
  });
}

export async function submitApplicationAction() {
  return run(async () => {
    const u = await requireUser();
    await submitApplication(u.id);
    return { ok: true, data: { redirect: "/business?submitted=1" } };
  });
}

export async function bookingSettingsAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { provider } = await requireProvider();
    const n = (k: string, min: number, max: number) => { const v = Number(fd.get(k)); if (!Number.isInteger(v) || v < min || v > max) throw new AppError("RANGE", `${k} must be between ${min} and ${max}`); return v; };
    await db.providerProfile.update({
      where: { id: provider.id },
      data: {
        bookingMode: str(fd, "bookingMode") === "APPROVAL" ? "APPROVAL" : "INSTANT", minNoticeMinutes: n("minNoticeMinutes", 0, 10080), maxAdvanceDays: n("maxAdvanceDays", 1, 365),
        slotStepMinutes: n("slotStepMinutes", 5, 120), freeCancelHours: n("freeCancelHours", 0, 168), cancellationPolicy: str(fd, "cancellationPolicy").slice(0, 2000) || null,
      },
    });
    return { ok: true, message: "Booking settings saved." };
  });
}

export async function serviceAreaAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { provider } = await requireProvider();
    if (str(fd, "delete")) { await db.serviceArea.deleteMany({ where: { id: str(fd, "delete"), providerId: provider.id } }); return; }
    const city = await db.city.findFirst({ where: { id: str(fd, "cityId"), countryId: provider.countryId } });
    if (!city) return { ok: false, error: "Choose a city" };
    const cur = await db.currency.findFirstOrThrow({ where: { countries: { some: { id: provider.countryId } } } });
    const fee = str(fd, "fee") ? toMinor(str(fd, "fee"), cur.minorUnits) : 0;
    await db.serviceArea.upsert({ where: { providerId_cityId: { providerId: provider.id, cityId: city.id } }, update: { travelFeeMinor: fee }, create: { providerId: provider.id, cityId: city.id, travelFeeMinor: fee } });
    return { ok: true, message: "Service area saved." };
  });
}

export async function providerBookingAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { user } = await requireProvider();
    const ref = str(fd, "ref");
    const op = str(fd, "op");
    if (op === "accept") await acceptRequest(ref, user.id);
    else if (op === "reject") await rejectRequest(ref, user.id, str(fd, "reason") || "Not available");
    else if (op === "start") await startAppointment(ref, user.id);
    else if (op === "complete") await completeAppointment(ref, user.id);
    else if (op === "noshow") await markNoShow(ref, user.id);
    else if (op === "cancel") await cancelBooking(ref, user, "provider", str(fd, "reason") || "Cancelled by provider");
    else return { ok: false, error: "Unknown action" };
    return { ok: true, message: "Booking updated." };
  });
}

export async function payoutRequestAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { provider } = await requireProvider();
    const currency = str(fd, "currency");
    const cur = await db.currency.findUniqueOrThrow({ where: { code: currency } });
    let amountMinor: number;
    try { amountMinor = toMinor(str(fd, "amount"), cur.minorUnits); } catch { return { ok: false, error: "Enter a valid amount" }; }
    const p = await requestPayout(provider.id, { amountMinor, currency, methodId: str(fd, "methodId") });
    return { ok: true, message: `Withdrawal ${p.reference} requested.` };
  });
}

export async function reviewResponseAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    await respondToReview(u.id, str(fd, "reviewId"), str(fd, "response"));
    return { ok: true, message: "Response posted." };
  });
}
