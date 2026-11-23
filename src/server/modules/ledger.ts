/**
 * Double-entry ledger. Positive amounts are debits, negative are credits; every transaction sums to zero
 * per currency (enforced by a deferred DB trigger) and rows are immutable (enforced by triggers).
 *
 * Accounts (per currency):
 *   platform:gateway_clearing   ASSET      money held at / owed by the payment gateway
 *   platform:commission         REVENUE    platform commission earned
 *   platform:promotions         EXPENSE    platform-funded discounts
 *   platform:gateway_fees       EXPENSE    processing fees charged by gateways
 *   provider:<id>:pending       LIABILITY  earned but not yet withdrawable
 *   provider:<id>:available     LIABILITY  withdrawable balance
 *   provider:<id>:payout_reserved LIABILITY amount locked by open payout requests
 */
import { db, type Tx } from "../db";
import { AppError } from "../errors";

type PlatformAccount = "gateway_clearing" | "commission" | "promotions" | "gateway_fees";
type ProviderAccount = "pending" | "available" | "payout_reserved";
const KIND: Record<string, string> = {
  gateway_clearing: "ASSET", commission: "REVENUE", promotions: "EXPENSE", gateway_fees: "EXPENSE",
  pending: "LIABILITY", available: "LIABILITY", payout_reserved: "LIABILITY",
};

export async function platformAccount(tx: Tx, name: PlatformAccount, currency: string) {
  const code = `platform:${name}:${currency}`;
  return tx.ledgerAccount.upsert({ where: { code }, update: {}, create: { code, name: `Platform ${name.replace("_", " ")} (${currency})`, kind: KIND[name], currency } });
}

export async function providerAccount(tx: Tx, providerId: string, name: ProviderAccount, currency: string) {
  const code = `provider:${providerId}:${name}:${currency}`;
  return tx.ledgerAccount.upsert({ where: { code }, update: {}, create: { code, name: `Provider ${name.replace("_", " ")} (${currency})`, kind: KIND[name], currency, providerId } });
}

export type Leg = { accountId: string; amountMinor: number };

/** Post a balanced transaction. Idempotent on `idempotencyKey` — reposting returns the existing transaction. */
export async function post(
  tx: Tx,
  t: { type: string; idempotencyKey: string; currency: string; legs: Leg[]; bookingId?: string; paymentId?: string; refundId?: string; payoutId?: string; memo?: string; createdById?: string },
) {
  const existing = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: t.idempotencyKey } });
  if (existing) return existing;
  const legs = t.legs.filter((l) => l.amountMinor !== 0);
  if (legs.length === 0) return null;
  if (legs.some((l) => !Number.isInteger(l.amountMinor))) throw new AppError("LEDGER", "Ledger amounts must be integers");
  if (legs.reduce((s, l) => s + l.amountMinor, 0) !== 0) throw new AppError("LEDGER", "Unbalanced ledger transaction");
  return tx.ledgerTransaction.create({
    data: {
      type: t.type, idempotencyKey: t.idempotencyKey, bookingId: t.bookingId, paymentId: t.paymentId, refundId: t.refundId, payoutId: t.payoutId, memo: t.memo, createdById: t.createdById,
      entries: { create: legs.map((l) => ({ accountId: l.accountId, amountMinor: l.amountMinor, currency: t.currency })) },
    },
  });
}

/** Raw balance (debits − credits). For liability/revenue accounts the "natural" balance is the negation. */
export async function rawBalance(tx: Tx, accountId: string): Promise<number> {
  const r = await tx.ledgerEntry.aggregate({ where: { accountId }, _sum: { amountMinor: true } });
  return r._sum.amountMinor ?? 0;
}

export async function providerBalances(providerId: string, tx: Tx = db) {
  const accounts = await tx.ledgerAccount.findMany({ where: { providerId } });
  const out: Record<string, { pending: number; available: number; reserved: number }> = {};
  for (const a of accounts) {
    const bal = 0 - (await rawBalance(tx, a.id)) || 0;
    const slot = (out[a.currency] ??= { pending: 0, available: 0, reserved: 0 });
    if (a.code.endsWith(`:pending:${a.currency}`)) slot.pending = bal;
    else if (a.code.endsWith(`:available:${a.currency}`)) slot.available = bal;
    else if (a.code.endsWith(`:payout_reserved:${a.currency}`)) slot.reserved = bal;
  }
  return out;
}

/** Lock an account row so concurrent withdrawals serialise. */
export async function lockAccount(tx: Tx, accountId: string) {
  await tx.$queryRaw`SELECT id FROM "LedgerAccount" WHERE id = ${accountId} FOR UPDATE`;
}
