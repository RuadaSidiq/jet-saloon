import { db } from "../db";
import { AppError, notFound } from "../errors";
import { reference, decrypt } from "../crypto";
import { audit } from "../audit";
import { notify } from "../notify";
import { lockAccount, post, providerAccount, rawBalance } from "./ledger";

/** Provider requests a withdrawal. Balance check + reservation happen under a row lock, so concurrent requests can't overdraw. */
export async function requestPayout(providerId: string, a: { amountMinor: number; currency: string; methodId: string }) {
  const provider = await db.providerProfile.findUniqueOrThrow({ where: { id: providerId }, include: { country: true } });
  if (provider.status !== "APPROVED") throw new AppError("PAYOUT", "Your account must be active to withdraw");
  const method = await db.payoutMethod.findFirst({ where: { id: a.methodId, providerId } });
  if (!method) throw notFound("Payout method");
  if (!Number.isInteger(a.amountMinor) || a.amountMinor <= 0) throw new AppError("PAYOUT", "Enter a valid amount");
  if (provider.country.currencyCode === a.currency && a.amountMinor < provider.country.minPayoutMinor) throw new AppError("PAYOUT", "Amount is below the minimum withdrawal");

  const payout = await db.$transaction(async (tx) => {
    const available = await providerAccount(tx, providerId, "available", a.currency);
    const reserved = await providerAccount(tx, providerId, "payout_reserved", a.currency);
    await lockAccount(tx, available.id);
    const balance = -(await rawBalance(tx, available.id));
    if (a.amountMinor > balance) throw new AppError("INSUFFICIENT", "Amount exceeds your available balance");
    const p = await tx.payout.create({ data: { reference: reference("PO"), providerId, methodId: method.id, amountMinor: a.amountMinor, currency: a.currency } });
    await post(tx, { type: "PAYOUT_RESERVED", idempotencyKey: `payout:reserve:${p.id}`, currency: a.currency, payoutId: p.id, legs: [{ accountId: available.id, amountMinor: a.amountMinor }, { accountId: reserved.id, amountMinor: -a.amountMinor }] });
    await notify(provider.userId, "payout.requested", "Withdrawal requested", `Your withdrawal ${p.reference} is being reviewed.`, "/business/earnings", tx);
    return p;
  });
  return payout;
}

/** Admin actions on a payout. Separate permission (finance.payouts). */
export async function decidePayout(payoutId: string, actorId: string, action: "approve" | "paid" | "failed" | "reject", detail?: string) {
  const p = await db.payout.findUnique({ where: { id: payoutId }, include: { provider: true } });
  if (!p) throw notFound("Payout");
  const allowed: Record<string, string[]> = { approve: ["REQUESTED"], paid: ["APPROVED", "PROCESSING"], failed: ["APPROVED", "PROCESSING"], reject: ["REQUESTED", "APPROVED"] };
  if (!allowed[action].includes(p.status)) throw new AppError("BAD_STATE", `Cannot ${action} a ${p.status.toLowerCase()} payout`);
  if ((action === "failed" || action === "reject") && !detail) throw new AppError("REASON", "Please provide a reason");
  if (action === "paid" && !detail) throw new AppError("REASON", "Enter the transfer reference from your payout provider");

  await db.$transaction(async (tx) => {
    const status = { approve: "APPROVED", paid: "PAID", failed: "FAILED", reject: "REJECTED" }[action] as "APPROVED" | "PAID" | "FAILED" | "REJECTED";
    const r = await tx.payout.updateMany({ where: { id: p.id, status: p.status }, data: { status, processedById: actorId, processedAt: new Date(), externalRef: action === "paid" ? detail : undefined, failureReason: action === "failed" || action === "reject" ? detail : undefined } });
    if (!r.count) throw new AppError("CONFLICT", "Payout was updated by someone else");
    const reserved = await providerAccount(tx, p.providerId, "payout_reserved", p.currency);
    if (action === "paid") {
      const { platformAccount } = await import("./ledger");
      const clearing = await platformAccount(tx, "gateway_clearing", p.currency);
      await post(tx, { type: "PAYOUT_PAID", idempotencyKey: `payout:paid:${p.id}`, currency: p.currency, payoutId: p.id, createdById: actorId, memo: detail, legs: [{ accountId: reserved.id, amountMinor: p.amountMinor }, { accountId: clearing.id, amountMinor: -p.amountMinor }] });
      await notify(p.provider.userId, "payout.completed", "Withdrawal sent", `Withdrawal ${p.reference} has been paid.`, "/business/earnings", tx);
    }
    if (action === "failed" || action === "reject") {
      const available = await providerAccount(tx, p.providerId, "available", p.currency);
      await post(tx, { type: "PAYOUT_REVERSED", idempotencyKey: `payout:reverse:${p.id}`, currency: p.currency, payoutId: p.id, createdById: actorId, memo: detail, legs: [{ accountId: reserved.id, amountMinor: p.amountMinor }, { accountId: available.id, amountMinor: -p.amountMinor }] });
      await notify(p.provider.userId, "payout.failed", action === "reject" ? "Withdrawal declined" : "Withdrawal failed", `Withdrawal ${p.reference}: ${detail}. The amount has been returned to your available balance.`, "/business/earnings", tx);
    }
  });
  await audit({ actorId, action: `payout.${action}`, entityType: "Payout", entityId: p.id, metadata: { detail: detail ?? null } });
}

/** Full account number for the finance officer processing the transfer (audited). */
export async function revealPayoutAccount(payoutId: string, actorId: string) {
  const p = await db.payout.findUniqueOrThrow({ where: { id: payoutId }, include: { method: true } });
  await audit({ actorId, action: "payout.reveal_account", entityType: "Payout", entityId: p.id });
  return decrypt(p.method.accountNumberEnc);
}
