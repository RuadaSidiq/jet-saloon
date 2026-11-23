import { db } from "../../db";
import { AppError, notFound } from "../../errors";
import { reference } from "../../crypto";
import { notify } from "../../notify";
import { notifyConfirmed, recordCapture, transition } from "../bookings";
import { post, platformAccount } from "../ledger";
import { gatewayByKey, pickGateway } from "./registry";

/** Start (or resume) a payment for a booking the customer owns. Never trusts any client-provided amount. */
export async function initiatePayment(bookingRef: string, customerId: string) {
  const b = await db.booking.findUnique({ where: { reference: bookingRef }, include: { customer: true, provider: { include: { country: true } }, payments: { orderBy: { createdAt: "desc" } } } });
  if (!b || b.customerId !== customerId) throw notFound("Booking");
  if (b.status !== "PENDING_PAYMENT") throw new AppError("BAD_STATE", "This booking is not awaiting payment");
  if (b.holdExpiresAt && b.holdExpiresAt < new Date()) throw new AppError("EXPIRED", "Your reservation has expired. Please choose a new time.");
  const currency = await db.currency.findUniqueOrThrow({ where: { code: b.currency } });

  const open = b.payments.find((p) => p.status === "INITIATED" && p.authorizationUrl && p.amountMinor === b.totalMinor && Date.now() - p.createdAt.getTime() < 20 * 60_000);
  if (open) return { authorizationUrl: open.authorizationUrl!, reference: open.reference };

  const gateway = pickGateway(b.provider.country, b.currency);
  const ref = reference("PAY");
  const payment = await db.payment.create({ data: { bookingId: b.id, gateway: gateway.key, reference: ref, amountMinor: b.totalMinor, currency: b.currency } });
  try {
    const { authorizationUrl } = await gateway.initialize({
      reference: ref, amountMinor: b.totalMinor, minorUnits: currency.minorUnits, currency: b.currency, email: b.customer.email,
      callbackUrl: `${process.env.APP_URL}/payments/return?reference=${ref}`, metadata: { booking: b.reference },
    });
    await db.payment.update({ where: { id: payment.id }, data: { authorizationUrl } });
    await db.booking.update({ where: { id: b.id }, data: { paymentStatus: "PROCESSING" } });
    return { authorizationUrl, reference: ref };
  } catch (e) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: String((e as Error).message).slice(0, 300) } });
    throw new AppError("GATEWAY", "We could not reach the payment provider. Please try again.");
  }
}

/**
 * Source of truth for payment state: server-side verification with the gateway.
 * Idempotent — safe to call from the redirect, webhooks (including duplicates) and reconciliation.
 */
export async function confirmPayment(paymentRef: string): Promise<"succeeded" | "failed" | "pending" | "already"> {
  const p0 = await db.payment.findUnique({ where: { reference: paymentRef } });
  if (!p0) throw notFound("Payment");
  if (p0.status === "SUCCEEDED") return "already";
  const gateway = gatewayByKey(p0.gateway);
  const currency = await db.currency.findUniqueOrThrow({ where: { code: p0.currency } });
  const v = await gateway.verify(paymentRef, currency.minorUnits);

  if (v.status === "pending") return "pending";
  if (v.status !== "success") {
    await db.$transaction(async (tx) => {
      const r = await tx.payment.updateMany({ where: { id: p0.id, status: "INITIATED" }, data: { status: v.status === "abandoned" ? "ABANDONED" : "FAILED", failureReason: v.failureReason, rawVerification: v.raw as never, verifiedAt: new Date() } });
      if (r.count) {
        await tx.booking.updateMany({ where: { id: p0.bookingId, paymentStatus: "PROCESSING" }, data: { paymentStatus: "FAILED" } });
        const b = await tx.booking.findUniqueOrThrow({ where: { id: p0.bookingId } });
        await notify(b.customerId, "payment.failed", "Payment not completed", `Payment for booking ${b.reference} did not go through. You can try again while your slot is held.`, `/account/bookings/${b.reference}`, tx);
      }
    });
    return "failed";
  }

  if (v.amountMinor !== p0.amountMinor || v.currency !== p0.currency) {
    await db.payment.update({ where: { id: p0.id }, data: { failureReason: `Amount mismatch: gateway ${v.amountMinor} ${v.currency}`, rawVerification: v.raw as never } });
    throw new AppError("AMOUNT_MISMATCH", "Payment amount mismatch — flagged for review", 409);
  }

  let slotLost = false;
  let refundReason: string | null = null;
  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${p0.id} FOR UPDATE`;
      const p = await tx.payment.findUniqueOrThrow({ where: { id: p0.id } });
      if (p.status === "SUCCEEDED") return;
      await tx.payment.update({ where: { id: p.id }, data: { status: "SUCCEEDED", gatewayTxId: v.gatewayTxId, channel: v.channel, feeMinor: v.feeMinor, rawVerification: v.raw as never, verifiedAt: new Date() } });
      const b = await tx.booking.findUniqueOrThrow({ where: { id: p.bookingId } });
      if (b.status === "PENDING_PAYMENT" || b.status === "EXPIRED") {
        // EXPIRED → CONFIRMED re-activates the hold; the exclusion constraint rejects it if the slot was taken meanwhile.
        await transition(tx, b, "CONFIRMED", null, "Payment verified", { paymentStatus: "PAID", holdExpiresAt: null });
      } else {
        await tx.booking.update({ where: { id: b.id }, data: { paymentStatus: "PAID" } });
        if (b.status === "CANCELLED" || b.status === "REJECTED") refundReason = `Payment received for a ${b.status.toLowerCase()} booking`;
      }
      await recordCapture(tx, b, p.id);
      if (v.feeMinor) {
        await post(tx, {
          type: "GATEWAY_FEE", idempotencyKey: `fee:${p.id}`, currency: p.currency, bookingId: b.id, paymentId: p.id,
          legs: [{ accountId: (await platformAccount(tx, "gateway_fees", p.currency)).id, amountMinor: v.feeMinor }, { accountId: (await platformAccount(tx, "gateway_clearing", p.currency)).id, amountMinor: -v.feeMinor }],
        });
      }
      await notify(b.customerId, "payment.confirmed", "Payment received", `We received your payment for booking ${b.reference}.`, `/account/bookings/${b.reference}`, tx);
      if (b.status === "PENDING_PAYMENT" || b.status === "EXPIRED") await notifyConfirmed(tx, b.id);
    });
  } catch (e) {
    if (!String((e as Error).message).includes("booking_no_overlap")) throw e;
    slotLost = true;
  }

  if (slotLost) {
    // Paid after the hold expired and someone else took the slot: record the money, then refund it in full.
    const { issueRefund } = await import("../refunds");
    await db.$transaction(async (tx) => {
      const p = await tx.payment.findUniqueOrThrow({ where: { id: p0.id } });
      if (p.status !== "SUCCEEDED") await tx.payment.update({ where: { id: p.id }, data: { status: "SUCCEEDED", gatewayTxId: v.gatewayTxId, channel: v.channel, rawVerification: v.raw as never, verifiedAt: new Date() } });
      const b = await tx.booking.findUniqueOrThrow({ where: { id: p.bookingId } });
      await tx.booking.update({ where: { id: b.id }, data: { paymentStatus: "PAID" } });
      await recordCapture(tx, b, p.id);
    });
    await issueRefund({ paymentId: p0.id, amountMinor: p0.amountMinor, reason: "Payment arrived after the reservation expired and the slot was taken", actorId: null });
  }
  if (refundReason) {
    const { issueRefund } = await import("../refunds");
    await issueRefund({ paymentId: p0.id, amountMinor: p0.amountMinor, reason: refundReason, actorId: null });
  }
  return "succeeded";
}

/** Verify signature, de-duplicate, then re-verify with the gateway API. The webhook body alone is never trusted. */
export async function handleWebhook(gatewayKey: string, rawBody: string, headers: Headers) {
  const gateway = gatewayByKey(gatewayKey);
  if (!gateway.verifyWebhookSignature(rawBody, headers)) throw new AppError("BAD_SIGNATURE", "Invalid signature", 401);
  const parsed = gateway.parseWebhook(rawBody);
  let event = await db.webhookEvent.findUnique({ where: { gateway_eventKey: { gateway: gatewayKey, eventKey: parsed.eventKey } } });
  if (event?.processedAt) return { duplicate: true };
  if (!event) {
    try {
      event = await db.webhookEvent.create({ data: { gateway: gatewayKey, eventKey: parsed.eventKey, eventType: parsed.eventType, payload: JSON.parse(rawBody) } });
    } catch {
      return { duplicate: true }; // concurrent delivery of the same event
    }
  }
  try {
    if (parsed.reference && (await db.payment.findUnique({ where: { reference: parsed.reference } }))) await confirmPayment(parsed.reference);
    if (parsed.refundReference && parsed.refundStatus) {
      const { settleRefundFromGateway } = await import("../refunds");
      await settleRefundFromGateway(parsed.refundReference, parsed.refundStatus);
    }
    await db.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), error: null } });
  } catch (e) {
    await db.webhookEvent.update({ where: { id: event.id }, data: { error: String((e as Error).message).slice(0, 500) } });
    throw e;
  }
  return { duplicate: false };
}

/** Reconciliation job: re-verify payments stuck in INITIATED for more than 10 minutes. */
export async function reconcilePendingPayments() {
  const stuck = await db.payment.findMany({ where: { status: "INITIATED", authorizationUrl: { not: null }, createdAt: { lt: new Date(Date.now() - 10 * 60_000), gt: new Date(Date.now() - 3 * 864e5) } }, take: 50 });
  let changed = 0;
  for (const p of stuck) {
    try {
      const r = await confirmPayment(p.reference);
      if (r !== "pending") changed++;
    } catch (e) {
      console.error("reconcile", p.reference, e);
    }
  }
  return changed;
}
