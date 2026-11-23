import { db } from "../db";
import { AppError, notFound } from "../errors";
import { audit } from "../audit";
import { notify } from "../notify";
import { post, platformAccount, providerAccount } from "./ledger";
import { gatewayByKey } from "./payments/registry";

/**
 * Refund (full or partial) a succeeded payment. The provider's share of the refund is proportional to
 * their net share of the booking; it comes from pending earnings, or from the available balance if the
 * booking was already settled (which may leave a negative balance recovered from future earnings).
 */
export async function issueRefund(a: { paymentId: string; amountMinor: number; reason: string; actorId: string | null }) {
  const payment = await db.payment.findUnique({ where: { id: a.paymentId }, include: { booking: true, refunds: true } });
  if (!payment || payment.status !== "SUCCEEDED") throw notFound("Successful payment");
  const already = payment.refunds.filter((r) => r.status !== "FAILED").reduce((s, r) => s + r.amountMinor, 0);
  if (!Number.isInteger(a.amountMinor) || a.amountMinor <= 0 || a.amountMinor > payment.amountMinor - already) throw new AppError("REFUND", "Refund amount exceeds the refundable balance");
  const currency = await db.currency.findUniqueOrThrow({ where: { code: payment.currency } });

  const refund = await db.refund.create({ data: { paymentId: payment.id, amountMinor: a.amountMinor, currency: payment.currency, reason: a.reason, initiatedById: a.actorId } });
  let gw: { gatewayRef: string; status: "processing" | "completed" };
  try {
    gw = await gatewayByKey(payment.gateway).refund({ reference: payment.reference, gatewayTxId: payment.gatewayTxId, amountMinor: a.amountMinor, minorUnits: currency.minorUnits, currency: payment.currency });
  } catch (e) {
    await db.refund.update({ where: { id: refund.id }, data: { status: "FAILED", failureReason: String((e as Error).message).slice(0, 300) } });
    throw new AppError("REFUND_FAILED", "The payment provider rejected the refund. It has been logged for follow-up.");
  }

  const b = payment.booking;
  await db.$transaction(async (tx) => {
    await tx.refund.update({ where: { id: refund.id }, data: { gatewayRef: gw.gatewayRef, status: gw.status === "completed" ? "COMPLETED" : "PROCESSING", completedAt: gw.status === "completed" ? new Date() : null } });
    const base = b.totalMinor || 1;
    const providerShare = Math.floor((a.amountMinor * b.providerNetMinor) / base);
    const platformShare = a.amountMinor - providerShare;
    const providerAcc = await providerAccount(tx, b.providerId, b.settledAt ? "available" : "pending", b.currency);
    await post(tx, {
      type: "REFUND", idempotencyKey: `refund:${refund.id}`, currency: b.currency, bookingId: b.id, paymentId: payment.id, refundId: refund.id, memo: a.reason, createdById: a.actorId ?? undefined,
      legs: [
        { accountId: providerAcc.id, amountMinor: providerShare },
        { accountId: (await platformAccount(tx, "commission", b.currency)).id, amountMinor: platformShare },
        { accountId: (await platformAccount(tx, "gateway_clearing", b.currency)).id, amountMinor: -a.amountMinor },
      ],
    });
    const fully = already + a.amountMinor >= payment.amountMinor;
    await tx.booking.update({ where: { id: b.id }, data: { paymentStatus: fully ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
    await notify(b.customerId, gw.status === "completed" ? "refund.completed" : "refund.initiated", "Refund " + (gw.status === "completed" ? "completed" : "initiated"), `A refund for booking ${b.reference} is ${gw.status === "completed" ? "complete" : "on its way"}.`, `/account/payments`, tx);
  });
  await audit({ actorId: a.actorId, action: "refund.issue", entityType: "Payment", entityId: payment.id, metadata: { amountMinor: a.amountMinor, reason: a.reason } });
  return refund;
}

export async function settleRefundFromGateway(paymentReference: string, status: "completed" | "failed") {
  const p = await db.payment.findUnique({ where: { reference: paymentReference }, include: { refunds: { where: { status: "PROCESSING" } } } });
  for (const r of p?.refunds ?? []) {
    if (status === "completed") await db.refund.update({ where: { id: r.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    else await db.refund.update({ where: { id: r.id }, data: { status: "FAILED", failureReason: "Gateway reported failure — requires manual action" } });
  }
}
