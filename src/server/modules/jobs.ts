import { db } from "../db";
import { processDeliveries, notify } from "../notify";
import { expireStaleHolds } from "./availability";
import { reconcilePendingPayments } from "./payments/service";
import { releaseSettlements } from "./settlement";
import { getSetting } from "./settings";

export async function sendReminders() {
  const hours = await getSetting("booking.reminderHoursBefore");
  const now = new Date();
  const due = await db.booking.findMany({
    where: { status: "CONFIRMED", reminderSentAt: null, startsAt: { gt: now, lte: new Date(now.getTime() + hours * 3600_000) } },
    take: 200,
  });
  for (const b of due) {
    const r = await db.booking.updateMany({ where: { id: b.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (!r.count) continue;
    const when = b.startsAt.toLocaleString("en-GB", { timeZone: b.timezone, dateStyle: "medium", timeStyle: "short" });
    await notify(b.customerId, "booking.reminder", "Appointment reminder", `You have an appointment with ${b.providerNameSnapshot} on ${when}. Ref ${b.reference}.`, `/account/bookings/${b.reference}`);
  }
  return due.length;
}

/** Run every minute via `npm run worker` or the /api/cron endpoint. Each step is idempotent. */
export async function runAllJobs() {
  const out: Record<string, number | string> = {};
  const steps: [string, () => Promise<number>][] = [
    ["expiredHolds", () => db.$transaction((tx) => expireStaleHolds(tx))],
    ["reconciled", reconcilePendingPayments],
    ["settled", () => releaseSettlements()],
    ["reminders", sendReminders],
    ["delivered", () => processDeliveries()],
  ];
  for (const [k, fn] of steps) {
    try { out[k] = await fn(); } catch (e) { out[k] = "error: " + (e as Error).message; console.error(k, e); }
  }
  return out;
}
