import { describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { createBooking } from "../src/server/modules/bookings";
import { initiatePayment } from "../src/server/modules/payments/service";
import { releaseSettlements } from "../src/server/modules/settlement";
import { decidePayout, requestPayout } from "../src/server/modules/payouts";
import { addPayoutMethod } from "../src/server/modules/providers";
import { createReview } from "../src/server/modules/reviews";
import { providerBalances } from "../src/server/modules/ledger";
import { ledgerIsBalanced, makeProvider, makeUser, payViaWebhook, slotAt, uid } from "./helpers";

async function completedPaidBooking(price = 20000) {
  const ctx = await makeProvider({ price });
  const c = await makeUser();
  const b = await createBooking({ customerId: c.id, providerId: ctx.provider.id, serviceIds: [ctx.service.id], startsAt: slotAt(10), locationType: "STUDIO", idempotencyKey: uid() });
  const { reference } = await initiatePayment(b.reference, c.id);
  await payViaWebhook(reference);
  // simulate the appointment having happened in the past
  await db.booking.update({ where: { id: b.id }, data: { status: "COMPLETED", completedAt: new Date(Date.now() - 72 * 3600_000) } });
  return { ...ctx, customer: c, booking: b };
}

describe("settlement & payouts", () => {
  it("only completed bookings past the settlement window become withdrawable", async () => {
    const { provider } = await completedPaidBooking();
    expect((await providerBalances(provider.id)).GHS.available).toBe(0);
    await releaseSettlements();
    const bal = (await providerBalances(provider.id)).GHS;
    expect(bal.available).toBe(17000);
    expect(bal.pending).toBe(0);
    await releaseSettlements(); // idempotent
    expect((await providerBalances(provider.id)).GHS.available).toBe(17000);
  });

  it("concurrent withdrawals can never exceed the available balance", async () => {
    const { provider, user } = await completedPaidBooking();
    await releaseSettlements();
    const m = await addPayoutMethod(provider.id, { type: "MOBILE_MONEY", institution: "MTN", accountName: "Test Holder", accountNumber: "0241234567" });
    const attempts = await Promise.allSettled(Array.from({ length: 5 }, () => requestPayout(provider.id, { amountMinor: 10000, currency: "GHS", methodId: m.id })));
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    const bal = (await providerBalances(provider.id)).GHS;
    expect(bal.available).toBe(7000);
    expect(bal.reserved).toBe(10000);
    void user;
  });

  it("rejected payouts return funds; paid payouts clear the reservation", async () => {
    const { provider, user } = await completedPaidBooking();
    await releaseSettlements();
    const admin = await makeUser("ADMIN");
    const m = await addPayoutMethod(provider.id, { type: "BANK", institution: "GCB", accountName: "Test Holder", accountNumber: "1234567890" });
    const p1 = await requestPayout(provider.id, { amountMinor: 6000, currency: "GHS", methodId: m.id });
    await decidePayout(p1.id, admin.id, "reject", "Account name mismatch");
    expect((await providerBalances(provider.id)).GHS.available).toBe(17000);
    const p2 = await requestPayout(provider.id, { amountMinor: 17000, currency: "GHS", methodId: m.id });
    await expect(decidePayout(p2.id, admin.id, "paid", "TRF-1")).rejects.toThrow(); // must approve first
    await decidePayout(p2.id, admin.id, "approve");
    await decidePayout(p2.id, admin.id, "paid", "TRF-1");
    const bal = (await providerBalances(provider.id)).GHS;
    expect(bal).toEqual({ pending: 0, available: 0, reserved: 0 });
    await expect(requestPayout(provider.id, { amountMinor: 100, currency: "GHS", methodId: m.id })).rejects.toThrow();
    expect(await ledgerIsBalanced()).toBe(true);
    void user;
  });

  it("the ledger is immutable at the database level", async () => {
    const e = await db.ledgerEntry.findFirstOrThrow();
    await expect(db.ledgerEntry.update({ where: { id: e.id }, data: { amountMinor: 1 } })).rejects.toThrow(/immutable/);
    await expect(db.ledgerEntry.delete({ where: { id: e.id } })).rejects.toThrow(/immutable/);
  });

  it("payout account numbers are stored encrypted", async () => {
    const m = await db.payoutMethod.findFirstOrThrow();
    expect(m.accountNumberEnc).not.toMatch(/^\d+$/);
    expect(m.accountNumberLast4).toHaveLength(4);
  });
});

describe("reviews", () => {
  it("only the customer of a completed booking can review, once", async () => {
    const { booking, customer, provider } = await completedPaidBooking();
    const stranger = await makeUser();
    await expect(createReview(stranger.id, booking.reference, 5)).rejects.toThrow(/not found/);
    await createReview(customer.id, booking.reference, 4, "Lovely");
    await expect(createReview(customer.id, booking.reference, 5)).rejects.toThrow(/already/);
    expect((await db.providerProfile.findUniqueOrThrow({ where: { id: provider.id } })).ratingAvg).toBe(4);
  });
});
