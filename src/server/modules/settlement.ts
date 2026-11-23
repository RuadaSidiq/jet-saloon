import { db } from "../db";
import { post, providerAccount } from "./ledger";
import { getSetting } from "./settings";

/**
 * Release provider earnings from pending → available once the booking is completed and the
 * settlement delay (dispute/refund window) has passed. The amount released is whatever remains in
 * pending for that booking according to the ledger, so refunds are automatically accounted for.
 */
export async function releaseSettlements(now = new Date()) {
  const delayH = await getSetting("finance.settlementDelayHours");
  const due = await db.booking.findMany({
    where: { status: "COMPLETED", settledAt: null, paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] }, completedAt: { lte: new Date(now.getTime() - delayH * 3600_000) } },
    take: 200,
  });
  let released = 0;
  for (const b of due) {
    await db.$transaction(async (tx) => {
      const pending = await providerAccount(tx, b.providerId, "pending", b.currency);
      const available = await providerAccount(tx, b.providerId, "available", b.currency);
      const agg = await tx.ledgerEntry.aggregate({ where: { accountId: pending.id, transaction: { bookingId: b.id } }, _sum: { amountMinor: true } });
      const remaining = -(agg._sum.amountMinor ?? 0);
      if (remaining > 0) {
        await post(tx, { type: "SETTLEMENT_RELEASED", idempotencyKey: `settle:${b.id}`, currency: b.currency, bookingId: b.id, legs: [{ accountId: pending.id, amountMinor: remaining }, { accountId: available.id, amountMinor: -remaining }] });
      }
      const r = await tx.booking.updateMany({ where: { id: b.id, settledAt: null }, data: { settledAt: now } });
      if (r.count) released++;
    });
  }
  return released;
}
