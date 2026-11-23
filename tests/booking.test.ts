import { describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { cancelBooking, createBooking, acceptRequest, rejectRequest, completeAppointment } from "../src/server/modules/bookings";
import { computeSlots, localDateOf, planFor } from "../src/server/modules/availability";
import { initiatePayment, confirmPayment } from "../src/server/modules/payments/service";
import { createCommissionRule } from "../src/server/modules/commission";
import { accountBalance, ledgerIsBalanced, makeProvider, makeUser, payViaWebhook, slotAt, uid } from "./helpers";

const base = (customerId: string, providerId: string, serviceId: string, startsAt = slotAt()) => ({
  customerId, providerId, serviceIds: [serviceId], startsAt, locationType: "STUDIO" as const, idempotencyKey: uid(),
});

describe("availability", () => {
  it("returns slots only within working hours and respects buffers", async () => {
    const { provider, service } = await makeProvider({ cleanup: 30 });
    const date = localDateOf(new Date(slotAt()), "Africa/Accra");
    const slots = await computeSlots({ providerId: provider.id, date, plan: planFor([service]) });
    expect(slots[0].startsAt.slice(11, 16)).toBe("09:00");
    // 60 min + 30 cleanup must end by 17:00 → last start 15:30
    expect(slots.at(-1)!.startsAt.slice(11, 16)).toBe("15:30");
  });

  it("never lets anyone book a sample profile", async () => {
    const { provider, service } = await makeProvider();
    await db.providerProfile.update({ where: { id: provider.id }, data: { isSample: true } });
    const c = await makeUser();
    const date = localDateOf(new Date(slotAt()), "Africa/Accra");
    expect(await computeSlots({ providerId: provider.id, date, plan: planFor([service]) })).toEqual([]);
    await expect(createBooking(base(c.id, provider.id, service.id))).rejects.toThrow(/sample profile/);
  });

  it("offers nothing for unapproved providers", async () => {
    const { provider, service } = await makeProvider();
    await db.providerProfile.update({ where: { id: provider.id }, data: { status: "SUBMITTED" } });
    const c = await makeUser();
    await expect(createBooking(base(c.id, provider.id, service.id))).rejects.toThrow(/not accepting bookings/);
  });
});

describe("booking creation", () => {
  it("is idempotent for repeated requests", async () => {
    const { provider, service } = await makeProvider();
    const c = await makeUser();
    const input = base(c.id, provider.id, service.id);
    const a = await createBooking(input);
    const b = await createBooking(input);
    expect(b.id).toBe(a.id);
    expect(await db.booking.count({ where: { customerId: c.id } })).toBe(1);
  });

  it("lets exactly one of many concurrent attempts win the same slot", async () => {
    const { provider, service } = await makeProvider();
    const customers = await Promise.all(Array.from({ length: 8 }, () => makeUser()));
    const results = await Promise.allSettled(customers.map((c) => createBooking(base(c.id, provider.id, service.id))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) if (r.status === "rejected") expect(String(r.reason.message)).toMatch(/no longer available|just booked/);
  });

  it("database exclusion constraint rejects overlaps even if app checks are bypassed", async () => {
    const { provider, service } = await makeProvider();
    const c = await makeUser();
    const b = await createBooking(base(c.id, provider.id, service.id));
    const { id: _id, reference: _r, idempotencyKey: _k, createdAt: _c, updatedAt: _u, ...copy } = b;
    await expect(db.booking.create({ data: { ...copy, reference: uid(), idempotencyKey: uid() } })).rejects.toThrow(/booking_no_overlap/);
  });

  it("uses a second staff member when the first is busy", async () => {
    const { provider, service } = await makeProvider({ staff: 2 });
    const [c1, c2, c3] = await Promise.all([makeUser(), makeUser(), makeUser()]);
    const a = await createBooking(base(c1.id, provider.id, service.id));
    const b = await createBooking(base(c2.id, provider.id, service.id));
    expect(a.staffId).not.toBe(b.staffId);
    await expect(createBooking(base(c3.id, provider.id, service.id))).rejects.toThrow();
  });

  it("releases the slot when a payment hold expires", async () => {
    const { provider, service } = await makeProvider();
    const [c1, c2] = await Promise.all([makeUser(), makeUser()]);
    const a = await createBooking(base(c1.id, provider.id, service.id));
    await db.booking.update({ where: { id: a.id }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
    const b = await createBooking(base(c2.id, provider.id, service.id));
    expect(b.status).toBe("PENDING_PAYMENT");
    expect((await db.booking.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("EXPIRED");
  });

  it("snapshots price and commission so later edits don't rewrite history", async () => {
    const { provider, service } = await makeProvider({ price: 30000 });
    const c = await makeUser();
    const b = await createBooking(base(c.id, provider.id, service.id));
    await db.service.update({ where: { id: service.id }, data: { priceMinor: 99999, name: "Renamed" } });
    await createCommissionRule({ scope: "PROVIDER", providerId: provider.id, rateBps: 500, effectiveFrom: new Date(), createdById: c.id });
    const after = await db.booking.findUniqueOrThrow({ where: { id: b.id }, include: { items: true } });
    expect(after.items[0].nameSnapshot).toBe("Glam");
    expect(after.items[0].unitPriceMinor).toBe(30000);
    expect(after.commissionRateBps).toBe(1500);
    expect(after.commissionMinor).toBe(4500);
    expect(after.providerNetMinor).toBe(25500);
  });
});

describe("commission resolution", () => {
  it("prefers provider over category over global", async () => {
    const { provider, service, user } = await makeProvider({ price: 10000 });
    const c = await makeUser();
    await createCommissionRule({ scope: "CATEGORY", categoryId: service.categoryId, rateBps: 1200, effectiveFrom: new Date(Date.now() - 1000), createdById: user.id });
    const b1 = await createBooking(base(c.id, provider.id, service.id, slotAt(9)));
    expect(b1.commissionRateBps).toBe(1200);
    await createCommissionRule({ scope: "PROVIDER", providerId: provider.id, rateBps: 800, effectiveFrom: new Date(Date.now() - 500), createdById: user.id });
    const b2 = await createBooking(base(c.id, provider.id, service.id, slotAt(11)));
    expect(b2.commissionRateBps).toBe(800);
    // clean up the category rule so other tests use the global default
    await db.commissionRule.updateMany({ where: { scope: "CATEGORY", categoryId: service.categoryId }, data: { effectiveTo: new Date() } });
  });
});

describe("payments", () => {
  it("confirms only via server verification, posts a balanced ledger, and ignores duplicate webhooks", async () => {
    const { provider, service } = await makeProvider({ price: 20000 });
    const c = await makeUser();
    const b = await createBooking(base(c.id, provider.id, service.id, slotAt(13)));
    const { reference } = await initiatePayment(b.reference, c.id);

    expect(await confirmPayment(reference)).toBe("pending"); // gateway hasn't been paid yet
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("PENDING_PAYMENT");

    expect((await payViaWebhook(reference)).duplicate).toBe(false);
    expect((await payViaWebhook(reference)).duplicate).toBe(true);
    await confirmPayment(reference);

    const after = await db.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.status).toBe("CONFIRMED");
    expect(after.paymentStatus).toBe("PAID");
    expect(await db.ledgerTransaction.count({ where: { bookingId: b.id, type: "PAYMENT_CAPTURED" } })).toBe(1);
    expect(await accountBalance(`provider:${provider.id}:pending:GHS`)).toBe(-17000);
    expect(await ledgerIsBalanced()).toBe(true);
  });

  it("rejects webhooks with a bad signature", async () => {
    const { handleWebhook } = await import("../src/server/modules/payments/service");
    await expect(handleWebhook("dev", JSON.stringify({ event: "charge.success", reference: "x" }), new Headers({ "x-dev-signature": "nope" }))).rejects.toThrow(/signature/i);
  });

  it("does not let another customer pay for (or see) someone else's booking", async () => {
    const { provider, service } = await makeProvider();
    const [owner, intruder] = await Promise.all([makeUser(), makeUser()]);
    const b = await createBooking(base(owner.id, provider.id, service.id, slotAt(14)));
    await expect(initiatePayment(b.reference, intruder.id)).rejects.toThrow(/not found/);
    await expect(cancelBooking(b.reference, intruder, "customer", "x")).rejects.toThrow(/not found/);
  });

  it("failed payment keeps the booking unconfirmed", async () => {
    const { provider, service } = await makeProvider();
    const c = await makeUser();
    const b = await createBooking(base(c.id, provider.id, service.id, slotAt(15)));
    const { reference } = await initiatePayment(b.reference, c.id);
    await payViaWebhook(reference, "failed");
    const after = await db.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.status).toBe("PENDING_PAYMENT");
    expect(after.paymentStatus).toBe("FAILED");
  });
});

describe("approval mode", () => {
  it("never charges until the provider accepts, and a rejection costs nothing", async () => {
    const { provider, service, user } = await makeProvider({ mode: "APPROVAL" });
    const c = await makeUser();
    const b = await createBooking(base(c.id, provider.id, service.id));
    expect(b.status).toBe("AWAITING_APPROVAL");
    await expect(initiatePayment(b.reference, c.id)).rejects.toThrow(/not awaiting payment/);
    await rejectRequest(b.reference, user.id, "Fully booked");
    expect(await db.payment.count({ where: { bookingId: b.id } })).toBe(0);

    const b2 = await createBooking(base(c.id, provider.id, service.id));
    await acceptRequest(b2.reference, user.id);
    expect((await db.booking.findUniqueOrThrow({ where: { id: b2.id } })).status).toBe("PENDING_PAYMENT");
    await expect(acceptRequest(b2.reference, user.id)).rejects.toThrow();
  });
});

describe("cancellation & refunds", () => {
  it("provider cancellation fully refunds and reverses the ledger", async () => {
    const { provider, service, user } = await makeProvider({ price: 20000 });
    const c = await makeUser();
    const b = await createBooking(base(c.id, provider.id, service.id, slotAt(10, 1)));
    const { reference } = await initiatePayment(b.reference, c.id);
    await payViaWebhook(reference);
    const r = await cancelBooking(b.reference, user, "provider", "Emergency");
    expect(r.refunded).toBe(true);
    const after = await db.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.status).toBe("CANCELLED");
    expect(after.paymentStatus).toBe("REFUNDED");
    expect(await accountBalance(`provider:${provider.id}:pending:GHS`)).toBe(0);
    expect(await ledgerIsBalanced()).toBe(true);
  });

  it("rejects invalid transitions", async () => {
    const { provider, service, user } = await makeProvider();
    const c = await makeUser();
    const b = await createBooking(base(c.id, provider.id, service.id, slotAt(16)));
    await expect(completeAppointment(b.reference, user.id)).rejects.toThrow();
  });
});
