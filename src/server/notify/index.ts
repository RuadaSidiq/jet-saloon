import { db, type Tx } from "../db";
import { appUrl } from "../app-url";
import { sendEmail, sendSms } from "./channels";

export type NotifyEvent =
  | "account.registered" | "account.verify_email" | "account.password_reset"
  | "provider.application_submitted" | "provider.approved" | "provider.rejected" | "provider.info_requested" | "provider.suspended"
  | "booking.created" | "booking.request_received" | "booking.accepted" | "booking.rejected" | "booking.confirmed" | "booking.cancelled"
  | "booking.reminder" | "booking.completed" | "booking.reschedule_requested" | "booking.rescheduled"
  | "payment.confirmed" | "payment.failed" | "refund.initiated" | "refund.completed"
  | "payout.requested" | "payout.completed" | "payout.failed" | "review.new" | "message.new" | "support.updated" | "platform.announcement";

/** Transactional events always email regardless of marketing preferences. */
const TRANSACTIONAL = new Set<NotifyEvent>(["account.verify_email", "account.password_reset", "booking.confirmed", "payment.confirmed", "refund.initiated"]);
const SMS_EVENTS = new Set<NotifyEvent>(["booking.confirmed", "booking.cancelled", "booking.reminder", "booking.request_received", "booking.accepted"]);

/**
 * Create an in-app notification and queue email/SMS deliveries (an outbox processed by the worker).
 * Safe to call inside a DB transaction: nothing external happens until the worker runs.
 */
export async function notify(userId: string, event: NotifyEvent, title: string, body: string, link?: string, tx: Tx = db) {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const prefs = (user.notificationPrefs ?? {}) as { email?: boolean; sms?: boolean };
  const deliveries: { channel: string; destination: string }[] = [];
  if (prefs.email !== false || TRANSACTIONAL.has(event)) deliveries.push({ channel: "EMAIL", destination: user.email });
  if (user.phone && prefs.sms !== false && SMS_EVENTS.has(event)) deliveries.push({ channel: "SMS", destination: user.phone });
  await tx.notification.create({ data: { userId, event, title, body, link, deliveries: { create: deliveries } } });
}

/** Worker: send due deliveries with exponential backoff (max 6 attempts). */
export async function processDeliveries(limit = 50) {
  const due = await db.notificationDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    include: { notification: true },
    take: limit,
    orderBy: { nextAttemptAt: "asc" },
  });
  let sent = 0;
  for (const d of due) {
    // claim the row so concurrent workers don't double-send
    const claimed = await db.notificationDelivery.updateMany({ where: { id: d.id, status: "PENDING", attempts: d.attempts }, data: { attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    try {
      const n = d.notification;
      const url = n.link ? `${appUrl()}${n.link}` : "";
      if (d.channel === "EMAIL") await sendEmail(d.destination, n.title, `${n.body}${url ? `\n\n${url}` : ""}`);
      else await sendSms(d.destination, `${n.title}: ${n.body}`.slice(0, 459));
      await db.notificationDelivery.update({ where: { id: d.id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
      sent++;
    } catch (e) {
      const attempts = d.attempts + 1;
      await db.notificationDelivery.update({
        where: { id: d.id },
        data: { status: attempts >= 6 ? "FAILED" : "PENDING", lastError: String((e as Error).message).slice(0, 500), nextAttemptAt: new Date(Date.now() + 2 ** attempts * 60_000) },
      });
    }
  }
  return sent;
}
