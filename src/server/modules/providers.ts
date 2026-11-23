import { z } from "zod";
import type { ProviderStatus } from "@prisma/client";
import { db } from "../db";
import { AppError, notFound } from "../errors";
import { encrypt } from "../crypto";
import { audit } from "../audit";
import { notify } from "../notify";
import { toMinor } from "../money";

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60) || "pro";

async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base);
  for (let i = 0; i < 50; i++) {
    const slug = i ? `${root}-${i + 1}` : root;
    const hit = await db.providerProfile.findUnique({ where: { slug } });
    if (!hit || hit.id === excludeId) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

const EDITABLE: ProviderStatus[] = ["DRAFT", "INFO_REQUESTED", "REJECTED", "APPROVED"];

/** Step 1: personal + business basics. Creates the draft profile on first save. */
export const basicsSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  businessName: z.string().trim().min(2).max(80),
  businessType: z.enum(["INDIVIDUAL", "STUDIO", "SALON", "MOBILE"]),
  phone: z.string().trim().min(6).max(20),
  countryId: z.string().min(1, "Choose a country"),
  cityId: z.string().min(1, "Choose a city"),
  neighbourhoodId: z.string().optional(),
  bio: z.string().trim().max(2000).optional(),
  yearsExperience: z.coerce.number().int().min(0).max(70),
  offersStudio: z.boolean(),
  offersHome: z.boolean(),
  studioAddress: z.string().trim().max(300).optional(),
  categoryIds: z.array(z.string()).min(1, "Choose at least one category").max(6),
});

export async function saveBasics(userId: string, raw: z.infer<typeof basicsSchema>) {
  const d = basicsSchema.parse(raw);
  if (!d.offersStudio && !d.offersHome) throw new AppError("DELIVERY", "Choose at least one: studio or home service");
  const country = await db.country.findUnique({ where: { id: d.countryId } });
  if (!country?.active) throw new AppError("COUNTRY", "We are not yet operating in that country");
  const city = await db.city.findFirst({ where: { id: d.cityId, countryId: country.id } });
  if (!city) throw new AppError("CITY", "Choose a valid city");
  const { normalisePhone } = await import("./accounts");
  const phone = await normalisePhone(d.phone, country.id);
  const cats = await db.category.findMany({ where: { id: { in: d.categoryIds }, active: true, parentId: null } });
  if (cats.length !== d.categoryIds.length) throw new AppError("CATEGORY", "Choose valid categories");

  const existing = await db.providerProfile.findUnique({ where: { userId } });
  if (existing && !EDITABLE.includes(existing.status)) throw new AppError("LOCKED", "Your application is under review and can't be edited right now");
  const data = {
    displayName: d.displayName, businessName: d.businessName, businessType: d.businessType, bio: d.bio, yearsExperience: d.yearsExperience,
    countryId: country.id, cityId: city.id, neighbourhoodId: d.neighbourhoodId || null, offersStudio: d.offersStudio, offersHome: d.offersHome,
    studioAddress: d.studioAddress, contactPhone: phone, timezone: country.timezone,
  };
  return db.$transaction(async (tx) => {
    const p = existing
      ? await tx.providerProfile.update({ where: { id: existing.id }, data })
      : await tx.providerProfile.create({ data: { ...data, userId, slug: await uniqueSlug(d.businessName), staff: { create: { name: d.displayName, isOwner: true } } } });
    await tx.providerCategory.deleteMany({ where: { providerId: p.id } });
    await tx.providerCategory.createMany({ data: cats.map((c) => ({ providerId: p.id, categoryId: c.id })) });
    await tx.user.update({ where: { id: userId }, data: { phone, role: "PROVIDER", countryId: country.id, cityId: city.id } });
    return p;
  });
}

export const serviceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  categoryId: z.string(),
  subcategoryId: z.string().optional(),
  description: z.string().trim().max(1500).optional(),
  price: z.string().trim(),
  promoPrice: z.string().trim().optional(),
  durationMinutes: z.coerce.number().int().min(5).max(720),
  prepMinutes: z.coerce.number().int().min(0).max(240).default(0),
  cleanupMinutes: z.coerce.number().int().min(0).max(240).default(0),
  homeServiceAvailable: z.boolean().default(false),
  homeTravelFee: z.string().trim().optional(),
  active: z.boolean().default(true),
  imageUrl: z.string().optional(),
});

export async function upsertService(providerId: string, raw: z.infer<typeof serviceSchema>, serviceId?: string) {
  const d = serviceSchema.parse(raw);
  const provider = await db.providerProfile.findUniqueOrThrow({ where: { id: providerId }, include: { country: { include: { currency: true } } } });
  const cur = provider.country.currency;
  const parse = (v?: string) => (v ? toMinor(v, cur.minorUnits) : undefined);
  const cat = await db.category.findFirst({ where: { id: d.categoryId, parentId: null, active: true } });
  if (!cat) throw new AppError("CATEGORY", "Choose a category");
  if (d.subcategoryId && !(await db.category.findFirst({ where: { id: d.subcategoryId, parentId: cat.id } }))) throw new AppError("CATEGORY", "Choose a valid subcategory");
  let priceMinor: number, promoPriceMinor: number | null;
  try {
    priceMinor = parse(d.price)!;
    promoPriceMinor = parse(d.promoPrice) ?? null;
  } catch {
    throw new AppError("PRICE", "Enter prices as numbers, e.g. 250 or 250.50");
  }
  if (promoPriceMinor != null && promoPriceMinor >= priceMinor) throw new AppError("PRICE", "The promotional price must be lower than the regular price");
  const data = {
    name: d.name, categoryId: cat.id, subcategoryId: d.subcategoryId || null, description: d.description, priceMinor, promoPriceMinor, currency: cur.code,
    durationMinutes: d.durationMinutes, prepMinutes: d.prepMinutes, cleanupMinutes: d.cleanupMinutes, homeServiceAvailable: d.homeServiceAvailable && provider.offersHome,
    homeTravelFeeMinor: parse(d.homeTravelFee) ?? 0, active: d.active, imageUrl: d.imageUrl || null,
  };
  if (serviceId) {
    const s = await db.service.findFirst({ where: { id: serviceId, providerId, deletedAt: null } });
    if (!s) throw notFound("Service");
    // Bookings keep their own snapshot (BookingItem), so editing never rewrites history.
    return db.service.update({ where: { id: s.id }, data });
  }
  return db.service.create({ data: { ...data, providerId } });
}

/** Soft-delete: booked services stay referenced by historical bookings. */
export async function deleteService(providerId: string, serviceId: string) {
  const s = await db.service.findFirst({ where: { id: serviceId, providerId, deletedAt: null } });
  if (!s) throw notFound("Service");
  const upcoming = await db.bookingItem.count({ where: { serviceId, booking: { status: { in: ["AWAITING_APPROVAL", "PENDING_PAYMENT", "CONFIRMED", "IN_PROGRESS"] } } } });
  if (upcoming) throw new AppError("IN_USE", "This service has upcoming bookings. Deactivate it instead, or wait until they're finished.");
  await db.service.update({ where: { id: s.id }, data: { deletedAt: new Date(), active: false } });
}

export const hoursSchema = z.array(z.object({ weekday: z.number().int().min(0).max(6), startMinute: z.number().int().min(0).max(1439), endMinute: z.number().int().min(1).max(1440) })).max(42);

/** Replace a staff member's weekly hours. Multiple windows per day model breaks (e.g. 9–13, 14–18). */
export async function setWorkingHours(providerId: string, staffId: string, raw: z.infer<typeof hoursSchema>) {
  const rows = hoursSchema.parse(raw);
  const staff = await db.staff.findFirst({ where: { id: staffId, providerId } });
  if (!staff) throw notFound("Staff member");
  for (const r of rows) if (r.startMinute >= r.endMinute) throw new AppError("HOURS", "Each opening window must end after it starts");
  for (let d = 0; d < 7; d++) {
    const day = rows.filter((r) => r.weekday === d).sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < day.length; i++) if (day[i].startMinute < day[i - 1].endMinute) throw new AppError("HOURS", "Opening windows on the same day must not overlap");
  }
  await db.$transaction([db.workingHours.deleteMany({ where: { staffId } }), db.workingHours.createMany({ data: rows.map((r) => ({ ...r, staffId })) })]);
}

export async function addTimeOff(providerId: string, staffId: string, startsAt: Date, endsAt: Date, reason?: string) {
  const staff = await db.staff.findFirst({ where: { id: staffId, providerId } });
  if (!staff) throw notFound("Staff member");
  if (!(startsAt < endsAt)) throw new AppError("DATES", "End must be after start");
  return db.timeOff.create({ data: { staffId, startsAt, endsAt, reason } });
}

export async function addPayoutMethod(providerId: string, d: { type: "MOBILE_MONEY" | "BANK"; institution: string; accountName: string; accountNumber: string }) {
  const provider = await db.providerProfile.findUniqueOrThrow({ where: { id: providerId }, include: { country: true } });
  if (!provider.country.payoutChannels.includes(d.type)) throw new AppError("PAYOUT_METHOD", "This payout method is not available in your country");
  const num = d.accountNumber.replace(/\s/g, "");
  if (!/^\d{6,20}$/.test(num)) throw new AppError("PAYOUT_METHOD", "Enter a valid account or mobile money number (digits only)");
  if (d.accountName.trim().length < 3) throw new AppError("PAYOUT_METHOD", "Enter the account holder's name");
  await db.payoutMethod.updateMany({ where: { providerId }, data: { isDefault: false } });
  return db.payoutMethod.create({ data: { providerId, type: d.type, institution: d.institution, accountName: d.accountName.trim(), accountNumberEnc: encrypt(num), accountNumberLast4: num.slice(-4), isDefault: true } });
}

/** What is still missing before an application can be submitted. */
export async function applicationChecklist(providerId: string) {
  const p = await db.providerProfile.findUniqueOrThrow({
    where: { id: providerId },
    include: { country: true, services: { where: { deletedAt: null } }, portfolio: true, documents: true, payoutMethods: true, staff: { include: { workingHours: true } } },
  });
  return [
    { key: "basics", label: "Business details", done: !!p.cityId && !!p.contactPhone },
    { key: "services", label: "At least one service", done: p.services.length > 0 },
    { key: "hours", label: "Working hours", done: p.staff.some((s) => s.workingHours.length > 0) },
    { key: "portfolio", label: "At least 2 portfolio photos", done: p.portfolio.length >= 2 },
    { key: "documents", label: "Identity document", done: !p.country.requiresIdDocument || p.documents.some((d) => d.type === "GOVERNMENT_ID") },
    { key: "payout", label: "Payout method", done: p.payoutMethods.length > 0 },
    { key: "consent", label: "Verification consent", done: p.verificationConsent },
  ];
}

export async function submitApplication(userId: string) {
  const p = await db.providerProfile.findUnique({ where: { userId } });
  if (!p) throw notFound("Application");
  if (!["DRAFT", "INFO_REQUESTED", "REJECTED"].includes(p.status)) throw new AppError("BAD_STATE", "This application has already been submitted");
  const missing = (await applicationChecklist(p.id)).filter((c) => !c.done);
  if (missing.length) throw new AppError("INCOMPLETE", `Please complete: ${missing.map((m) => m.label).join(", ")}`);
  await setProviderStatus(p.id, "SUBMITTED", userId, "Submitted by applicant");
  await db.providerProfile.update({ where: { id: p.id }, data: { submittedAt: new Date() } });
  await notify(userId, "provider.application_submitted", "Application received", "Thanks! Our team will review your application, usually within 2 business days.", "/business");
}

const ADMIN_TRANSITIONS: Record<string, ProviderStatus[]> = {
  UNDER_REVIEW: ["SUBMITTED"],
  APPROVED: ["SUBMITTED", "UNDER_REVIEW", "SUSPENDED"],
  REJECTED: ["SUBMITTED", "UNDER_REVIEW"],
  INFO_REQUESTED: ["SUBMITTED", "UNDER_REVIEW"],
  SUSPENDED: ["APPROVED"],
};

async function setProviderStatus(providerId: string, to: ProviderStatus, actorId: string, note?: string) {
  const p = await db.providerProfile.findUniqueOrThrow({ where: { id: providerId } });
  await db.$transaction([
    db.providerProfile.update({ where: { id: p.id }, data: { status: to, statusReason: note ?? null, ...(to === "APPROVED" && !p.approvedAt ? { approvedAt: new Date() } : {}) } }),
    db.providerReviewLog.create({ data: { providerId: p.id, fromStatus: p.status, toStatus: to, note, actorId } }),
  ]);
  return p;
}

/** Admin verification decision. Rejections and info requests must include an explanation. */
export async function decideApplication(providerId: string, actorId: string, to: "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "INFO_REQUESTED" | "SUSPENDED", note?: string) {
  const p = await db.providerProfile.findUnique({ where: { id: providerId } });
  if (!p) throw notFound("Provider");
  if (!ADMIN_TRANSITIONS[to].includes(p.status)) throw new AppError("BAD_STATE", `Cannot move a ${p.status.toLowerCase()} provider to ${to.toLowerCase()}`);
  if (["REJECTED", "INFO_REQUESTED", "SUSPENDED"].includes(to) && !note?.trim()) throw new AppError("REASON", "Please explain the decision to the provider");
  await setProviderStatus(p.id, to, actorId, note);
  await audit({ actorId, action: `provider.${to.toLowerCase()}`, entityType: "ProviderProfile", entityId: p.id, metadata: { note: note ?? null, from: p.status } });
  const msgs: Partial<Record<typeof to, [Parameters<typeof notify>[1], string, string]>> = {
    APPROVED: ["provider.approved", "You're approved!", p.status === "SUSPENDED" ? "Your account has been reactivated." : "Your profile is now live and customers can book you."],
    REJECTED: ["provider.rejected", "Application not approved", `Reason: ${note}. You can update your application and resubmit.`],
    INFO_REQUESTED: ["provider.info_requested", "More information needed", `${note}`],
    SUSPENDED: ["provider.suspended", "Account suspended", `Your provider account was suspended: ${note}`],
  };
  const m = msgs[to];
  if (m) await notify(p.userId, m[0], m[1], m[2], "/business");
}
