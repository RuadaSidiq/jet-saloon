import { Prisma, type Booking, type BookingStatus } from "@prisma/client";
import { db, type Tx } from "../db";
import { AppError, forbidden, notFound } from "../errors";
import { reference } from "../crypto";
import { applyBps } from "../money";
import { audit } from "../audit";
import { notify } from "../notify";
import { computeSlots, expireStaleHolds, localDateOf, planFor } from "./availability";
import { resolveCommission } from "./commission";
import { evaluateCoupon } from "./coupons";
import { getSetting } from "./settings";
import { post, platformAccount, providerAccount } from "./ledger";

/** Allowed booking state transitions. Anything not listed is rejected. */
export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  AWAITING_APPROVAL: ["PENDING_PAYMENT", "REJECTED", "CANCELLED", "EXPIRED"],
  PENDING_PAYMENT: ["CONFIRMED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
  EXPIRED: ["CONFIRMED"], // only when a late payment succeeds and the slot is still free
  NO_SHOW: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus) {
  return TRANSITIONS[from].includes(to);
}

/** Optimistic, guarded transition: succeeds only if the row is still in `from`. */
export async function transition(tx: Tx, b: Pick<Booking, "id" | "status">, to: BookingStatus, actorId: string | null, note?: string, extra: Prisma.BookingUpdateManyMutationInput = {}) {
  if (!canTransition(b.status, to)) throw new AppError("BAD_TRANSITION", `A ${b.status.toLowerCase().replace("_", " ")} booking cannot become ${to.toLowerCase().replace("_", " ")}`);
  const r = await tx.booking.updateMany({ where: { id: b.id, status: b.status }, data: { ...extra, status: to } });
  if (r.count !== 1) throw new AppError("CONFLICT", "This booking was just updated. Please refresh and try again.", 409);
  await tx.bookingStatusHistory.create({ data: { bookingId: b.id, fromStatus: b.status, toStatus: to, actorId, note } });
}

const isExclusionViolation = (e: unknown) =>
  (e instanceof Prisma.PrismaClientKnownRequestError && (e.meta?.code === "23P01" || String(e.message).includes("booking_no_overlap"))) ||
  (e instanceof Prisma.PrismaClientUnknownRequestError && e.message.includes("booking_no_overlap")) ||
  String((e as Error)?.message ?? "").includes("booking_no_overlap");

export type CreateBookingInput = {
  customerId: string;
  providerId: string;
  serviceIds: string[];
  startsAt: string; // ISO UTC
  staffId?: string;
  locationType: "STUDIO" | "HOME";
  homeAddress?: string;
  homeCityId?: string;
  couponCode?: string;
  note?: string;
  idempotencyKey: string;
};

export async function createBooking(input: CreateBookingInput) {
  const existing = await db.booking.findUnique({ where: { customerId_idempotencyKey: { customerId: input.customerId, idempotencyKey: input.idempotencyKey } } });
  if (existing) return existing;

  const provider = await db.providerProfile.findUnique({ where: { id: input.providerId }, include: { country: { include: { currency: true } }, city: true, serviceAreas: true } });
  if (!provider || provider.status !== "APPROVED") throw new AppError("PROVIDER_UNAVAILABLE", "This professional is not accepting bookings");
  if (provider.isSample) throw new AppError("SAMPLE_PROFILE", "This is a sample profile for illustration and can't take bookings.");
  if (provider.userId === input.customerId) throw new AppError("SELF_BOOKING", "You cannot book your own services");
  const customer = await db.user.findUnique({ where: { id: input.customerId } });
  if (!customer || customer.status !== "ACTIVE") throw forbidden();

  const ids = [...new Set(input.serviceIds)];
  if (ids.length === 0 || ids.length > 5) throw new AppError("SERVICES", "Choose between 1 and 5 services");
  const services = await db.service.findMany({ where: { id: { in: ids }, providerId: provider.id, active: true, deletedAt: null }, include: { category: true } });
  if (services.length !== ids.length) throw new AppError("SERVICES", "One or more selected services are no longer available");
  const currency = services[0].currency;
  if (services.some((s) => s.currency !== currency)) throw new AppError("SERVICES", "Services must share one currency");

  let travelFeeMinor = 0;
  if (input.locationType === "HOME") {
    if (!provider.offersHome || services.some((s) => !s.homeServiceAvailable)) throw new AppError("LOCATION", "Home service is not available for this selection");
    if (!input.homeAddress || input.homeAddress.trim().length < 5) throw new AppError("LOCATION", "Please enter the address for your home appointment");
    if (provider.serviceAreas.length) {
      const area = provider.serviceAreas.find((a) => a.cityId === input.homeCityId);
      if (!area) throw new AppError("LOCATION", "This professional does not travel to your area");
      travelFeeMinor = area.travelFeeMinor;
    }
    travelFeeMinor = Math.max(travelFeeMinor, ...services.map((s) => s.homeTravelFeeMinor));
  } else if (!provider.offersStudio) throw new AppError("LOCATION", "This professional only offers home service");

  // Fail before reserving a slot if this market can't take online payment yet.
  if (provider.bookingMode === "INSTANT") {
    const { pickGateway } = await import("./payments/registry");
    pickGateway(provider.country, currency);
  }

  const start = new Date(input.startsAt);
  if (isNaN(start.getTime())) throw new AppError("TIME", "Invalid appointment time");
  const plan = planFor(services);
  const subtotalMinor = services.reduce((s, x) => s + (x.promoPriceMinor ?? x.priceMinor), 0);
  const holdMinutes = await getSetting("booking.paymentHoldMinutes");
  const approvalHours = await getSetting("booking.approvalWindowHours");

  try {
    return await db.$transaction(async (tx) => {
      // serialise booking attempts per provider so slot validation + insert is consistent
      await tx.$queryRaw`SELECT id FROM "ProviderProfile" WHERE id = ${provider.id} FOR UPDATE`;
      await expireStaleHolds(tx, {});
      const slots = await computeSlots({ providerId: provider.id, date: localDateOf(start, provider.timezone), plan, staffId: input.staffId }, tx);
      const slot = slots.find((s) => s.startsAt === start.toISOString());
      if (!slot) throw new AppError("SLOT_UNAVAILABLE", "That time is no longer available. Please pick another slot.");
      const staffId = input.staffId && slot.staffIds.includes(input.staffId) ? input.staffId : slot.staffIds[0];

      let discountMinor = 0;
      let discountFundedBy: string | null = null;
      let couponId: string | null = null;
      if (input.couponCode) {
        const c = await evaluateCoupon(tx, { code: input.couponCode, userId: input.customerId, providerId: provider.id, countryId: provider.countryId, currency, subtotalMinor });
        discountMinor = c.discountMinor;
        discountFundedBy = c.fundedBy;
        couponId = c.coupon.id;
      }

      const commission = await resolveCommission({ providerId: provider.id, categoryId: services[0].categoryId, countryId: provider.countryId }, tx);
      // Commission is charged on the service subtotal; travel fees pass through to the provider.
      const commissionMinor = applyBps(subtotalMinor, commission.rateBps);
      const totalMinor = subtotalMinor + travelFeeMinor - discountMinor;
      const providerNetMinor = subtotalMinor + travelFeeMinor - commissionMinor - (discountFundedBy === "PROVIDER" ? discountMinor : 0);
      if (providerNetMinor < 0) throw new AppError("PRICING", "This discount cannot be applied to this booking");

      const mode = provider.bookingMode;
      const now = Date.now();
      const free = totalMinor === 0;
      const status: BookingStatus = mode === "APPROVAL" ? "AWAITING_APPROVAL" : free ? "CONFIRMED" : "PENDING_PAYMENT";
      const holdExpiresAt = status === "CONFIRMED" ? null
        : new Date(Math.min(start.getTime(), now + (mode === "APPROVAL" ? approvalHours * 3600_000 : holdMinutes * 60_000)));

      const booking = await tx.booking.create({
        data: {
          reference: reference("BK"),
          customerId: input.customerId, providerId: provider.id, staffId, status, paymentStatus: free && status === "CONFIRMED" ? "PAID" : "UNPAID",
          locationType: input.locationType, homeAddress: input.locationType === "HOME" ? input.homeAddress!.trim() : null, customerNote: input.note?.slice(0, 1000),
          startsAt: start, endsAt: new Date(start.getTime() + plan.durationMinutes * 60_000),
          blockStart: new Date(start.getTime() - plan.prepMinutes * 60_000),
          blockEnd: new Date(start.getTime() + (plan.durationMinutes + plan.cleanupMinutes) * 60_000),
          timezone: provider.timezone, holdExpiresAt, currency,
          subtotalMinor, travelFeeMinor, discountMinor, discountFundedBy, totalMinor,
          commissionRuleId: commission.ruleId, commissionRateBps: commission.rateBps, commissionMinor, providerNetMinor,
          couponId, idempotencyKey: input.idempotencyKey,
          providerNameSnapshot: provider.businessName, countryCode: provider.country.code, cityName: provider.city?.name,
          items: { create: services.map((s) => ({ serviceId: s.id, nameSnapshot: s.name, categorySnapshot: s.category.name, unitPriceMinor: s.promoPriceMinor ?? s.priceMinor, durationMinutes: s.durationMinutes })) },
          history: { create: { toStatus: status, actorId: input.customerId, note: "Booking created" } },
        },
      });
      if (couponId) await tx.couponRedemption.create({ data: { couponId, userId: input.customerId, bookingId: booking.id } });
      if (status === "CONFIRMED") await recordCapture(tx, booking, null);

      const when = start.toLocaleString("en-GB", { timeZone: provider.timezone, dateStyle: "medium", timeStyle: "short" });
      if (status === "AWAITING_APPROVAL") {
        await notify(provider.userId, "booking.request_received", "New booking request", `${customer.name} requested ${services.map((s) => s.name).join(", ")} on ${when}. Please accept or decline.`, `/business/bookings/${booking.reference}`, tx);
        await notify(input.customerId, "booking.created", "Request sent", `Your request to ${provider.businessName} for ${when} was sent. You will only be charged if they accept.`, `/account/bookings/${booking.reference}`, tx);
      } else if (status === "CONFIRMED") {
        await notifyConfirmed(tx, booking.id);
      }
      return booking;
    }, { timeout: 15_000 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await db.booking.findUnique({ where: { customerId_idempotencyKey: { customerId: input.customerId, idempotencyKey: input.idempotencyKey } } });
      if (again) return again;
    }
    if (isExclusionViolation(e)) throw new AppError("SLOT_UNAVAILABLE", "That time was just booked by someone else. Please pick another slot.");
    throw e;
  }
}

/** Ledger: customer money captured → provider pending + platform commission (minus platform-funded discount). */
export async function recordCapture(tx: Tx, b: Booking, paymentId: string | null) {
  const clearing = await platformAccount(tx, "gateway_clearing", b.currency);
  const commission = await platformAccount(tx, "commission", b.currency);
  const promos = await platformAccount(tx, "promotions", b.currency);
  const pending = await providerAccount(tx, b.providerId, "pending", b.currency);
  const platformDiscount = b.discountFundedBy === "PLATFORM" ? b.discountMinor : 0;
  await post(tx, {
    type: "PAYMENT_CAPTURED", idempotencyKey: `capture:${b.id}`, currency: b.currency, bookingId: b.id, paymentId: paymentId ?? undefined,
    memo: `Booking ${b.reference}`,
    legs: [
      { accountId: clearing.id, amountMinor: b.totalMinor },
      { accountId: promos.id, amountMinor: platformDiscount },
      { accountId: pending.id, amountMinor: -b.providerNetMinor },
      { accountId: commission.id, amountMinor: -b.commissionMinor },
    ],
  });
}

export async function notifyConfirmed(tx: Tx, bookingId: string) {
  const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { provider: true, customer: true, items: true } });
  const when = b.startsAt.toLocaleString("en-GB", { timeZone: b.timezone, dateStyle: "medium", timeStyle: "short" });
  const what = b.items.map((i) => i.nameSnapshot).join(", ");
  await notify(b.customerId, "booking.confirmed", "Booking confirmed", `${what} with ${b.providerNameSnapshot} on ${when}. Ref ${b.reference}.`, `/account/bookings/${b.reference}`, tx);
  await notify(b.provider.userId, "booking.confirmed", "New confirmed booking", `${b.customer.name} booked ${what} on ${when}.`, `/business/bookings/${b.reference}`, tx);
}

async function loadForActor(ref: string, actor: { id: string }, as: "customer" | "provider" | "admin") {
  const b = await db.booking.findUnique({ where: { reference: ref }, include: { provider: true, payments: true } });
  if (!b) throw notFound("Booking");
  if (as === "customer" && b.customerId !== actor.id) throw notFound("Booking");
  if (as === "provider" && b.provider.userId !== actor.id) throw notFound("Booking");
  return b;
}

/** Provider accepts an approval-mode request → customer gets a payment window. Nothing was charged before. */
export async function acceptRequest(ref: string, providerUserId: string) {
  const b = await loadForActor(ref, { id: providerUserId }, "provider");
  const hours = await getSetting("booking.approvalWindowHours");
  return db.$transaction(async (tx) => {
    const holdExpiresAt = new Date(Math.min(b.startsAt.getTime(), Date.now() + hours * 3600_000));
    if (b.totalMinor === 0) {
      await transition(tx, b, "PENDING_PAYMENT", providerUserId, "Accepted");
      await transition(tx, { id: b.id, status: "PENDING_PAYMENT" }, "CONFIRMED", null, "No payment due", { paymentStatus: "PAID", holdExpiresAt: null });
      await recordCapture(tx, await tx.booking.findUniqueOrThrow({ where: { id: b.id } }), null);
      await notifyConfirmed(tx, b.id);
      return;
    }
    await transition(tx, b, "PENDING_PAYMENT", providerUserId, "Accepted by provider", { holdExpiresAt });
    await notify(b.customerId, "booking.accepted", "Request accepted — complete payment", `${b.providerNameSnapshot} accepted your request ${b.reference}. Pay to confirm your appointment.`, `/account/bookings/${b.reference}`, tx);
  });
}

export async function rejectRequest(ref: string, providerUserId: string, reason: string) {
  const b = await loadForActor(ref, { id: providerUserId }, "provider");
  await db.$transaction(async (tx) => {
    await transition(tx, b, "REJECTED", providerUserId, reason, { cancellationReason: reason });
    await notify(b.customerId, "booking.rejected", "Request declined", `${b.providerNameSnapshot} could not take booking ${b.reference}. You have not been charged.`, `/account/bookings/${b.reference}`, tx);
  });
}

export async function startAppointment(ref: string, providerUserId: string) {
  const b = await loadForActor(ref, { id: providerUserId }, "provider");
  if (b.startsAt.getTime() - Date.now() > 60 * 60_000) throw new AppError("TOO_EARLY", "You can start an appointment up to 1 hour before its time");
  await db.$transaction((tx) => transition(tx, b, "IN_PROGRESS", providerUserId));
}

export async function completeAppointment(ref: string, providerUserId: string) {
  const b = await loadForActor(ref, { id: providerUserId }, "provider");
  if (b.startsAt > new Date()) throw new AppError("TOO_EARLY", "An appointment can only be completed after it has started");
  await db.$transaction(async (tx) => {
    await transition(tx, b, "COMPLETED", providerUserId, undefined, { completedAt: new Date() });
    await notify(b.customerId, "booking.completed", "How was your appointment?", `Your appointment with ${b.providerNameSnapshot} is complete. Leave a review to help others.`, `/account/bookings/${b.reference}`, tx);
  });
}

export async function markNoShow(ref: string, providerUserId: string) {
  const b = await loadForActor(ref, { id: providerUserId }, "provider");
  if (b.startsAt.getTime() + 15 * 60_000 > Date.now()) throw new AppError("TOO_EARLY", "You can mark a no-show 15 minutes after the start time");
  await db.$transaction(async (tx) => transition(tx, b, "NO_SHOW", providerUserId, undefined, { completedAt: new Date() }));
}

/**
 * Cancellation. Refund policy:
 *  - provider or admin cancels a paid booking → full refund
 *  - customer cancels ≥ provider.freeCancelHours before start → full refund; later → no automatic refund
 */
export async function cancelBooking(ref: string, actor: { id: string }, as: "customer" | "provider" | "admin", reason: string) {
  const b = await loadForActor(ref, actor, as);
  const { issueRefund } = await import("./refunds");
  if (as === "customer" && b.status === "IN_PROGRESS") throw new AppError("BAD_TRANSITION", "An appointment in progress cannot be cancelled");
  const hoursBefore = (b.startsAt.getTime() - Date.now()) / 3600_000;
  const paid = b.paymentStatus === "PAID";
  const refundFull = paid && (as !== "customer" || hoursBefore >= b.provider.freeCancelHours);
  await db.$transaction(async (tx) => {
    await transition(tx, b, "CANCELLED", actor.id, reason, { cancelledById: actor.id, cancellationReason: reason });
    const msg = (who: string) => `Booking ${b.reference} was cancelled by ${who}. ${reason}`;
    if (as !== "customer") await notify(b.customerId, "booking.cancelled", "Booking cancelled", msg(as === "admin" ? "support" : b.providerNameSnapshot) + (refundFull ? " A full refund is on its way." : ""), `/account/bookings/${b.reference}`, tx);
    if (as !== "provider") await notify(b.provider.userId, "booking.cancelled", "Booking cancelled", msg(as === "admin" ? "support" : "the customer"), `/business/bookings/${b.reference}`, tx);
  });
  await audit({ actorId: actor.id, action: "booking.cancel", entityType: "Booking", entityId: b.id, metadata: { as, reason, refundFull } });
  if (refundFull) {
    const payment = b.payments.find((p) => p.status === "SUCCEEDED");
    if (payment) await issueRefund({ paymentId: payment.id, amountMinor: b.totalMinor, reason: `Cancellation: ${reason}`, actorId: actor.id });
  }
  return { refunded: refundFull };
}

export async function requestReschedule(ref: string, actor: { id: string }, as: "customer" | "provider", note: string) {
  const b = await loadForActor(ref, actor, as);
  if (!["CONFIRMED", "PENDING_PAYMENT", "AWAITING_APPROVAL"].includes(b.status)) throw new AppError("BAD_STATE", "This booking can no longer be rescheduled");
  await db.booking.update({ where: { id: b.id }, data: { rescheduleRequestedAt: new Date(), rescheduleNote: `${as}: ${note}`.slice(0, 500) } });
  await notify(as === "customer" ? b.provider.userId : b.customerId, "booking.reschedule_requested", "Reschedule requested", `A new time was requested for booking ${b.reference}: ${note}`, as === "customer" ? `/business/bookings/${b.reference}` : `/account/bookings/${b.reference}`);
}

/** Move a booking to a new validated slot (same services, same staff where possible). */
export async function rescheduleBooking(ref: string, actor: { id: string }, as: "customer" | "provider", newStartIso: string) {
  const b = await loadForActor(ref, actor, as);
  if (!["CONFIRMED", "PENDING_PAYMENT", "AWAITING_APPROVAL"].includes(b.status)) throw new AppError("BAD_STATE", "This booking can no longer be rescheduled");
  const start = new Date(newStartIso);
  const items = await db.bookingItem.findMany({ where: { bookingId: b.id }, include: { service: true } });
  const plan = { durationMinutes: items.reduce((s, i) => s + i.durationMinutes, 0), prepMinutes: items.reduce((s, i) => s + i.service.prepMinutes, 0), cleanupMinutes: items.reduce((s, i) => s + i.service.cleanupMinutes, 0) };
  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ProviderProfile" WHERE id = ${b.providerId} FOR UPDATE`;
      const slots = await computeSlots({ providerId: b.providerId, date: localDateOf(start, b.timezone), plan, excludeBookingId: b.id }, tx);
      const slot = slots.find((s) => s.startsAt === start.toISOString());
      if (!slot) throw new AppError("SLOT_UNAVAILABLE", "That time is not available");
      const staffId = slot.staffIds.includes(b.staffId) ? b.staffId : slot.staffIds[0];
      await tx.booking.update({
        where: { id: b.id },
        data: { staffId, startsAt: start, endsAt: new Date(start.getTime() + plan.durationMinutes * 60_000), blockStart: new Date(start.getTime() - plan.prepMinutes * 60_000), blockEnd: new Date(start.getTime() + (plan.durationMinutes + plan.cleanupMinutes) * 60_000), rescheduleRequestedAt: null, rescheduleNote: null, reminderSentAt: null },
      });
      await tx.bookingStatusHistory.create({ data: { bookingId: b.id, fromStatus: b.status, toStatus: b.status, actorId: actor.id, note: `Rescheduled from ${b.startsAt.toISOString()} to ${start.toISOString()}` } });
      const when = start.toLocaleString("en-GB", { timeZone: b.timezone, dateStyle: "medium", timeStyle: "short" });
      await notify(as === "customer" ? b.provider.userId : b.customerId, "booking.rescheduled", "Booking rescheduled", `Booking ${b.reference} moved to ${when}.`, undefined, tx);
    });
  } catch (e) {
    if (isExclusionViolation(e)) throw new AppError("SLOT_UNAVAILABLE", "That time was just taken");
    throw e;
  }
}
