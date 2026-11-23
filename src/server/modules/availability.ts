import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { db, type Tx } from "../db";
import { AppError } from "../errors";

export const ACTIVE_BOOKING_STATUSES = ["AWAITING_APPROVAL", "PENDING_PAYMENT", "CONFIRMED", "IN_PROGRESS"] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const localToUtc = (date: string, minute: number, tz: string) =>
  fromZonedTime(`${date}T${pad(Math.floor(minute / 60))}:${pad(minute % 60)}:00`, tz);

export function weekdayOf(date: string, tz: string): number {
  // ISO day 1..7 (Mon..Sun) → 0..6 (Sun..Sat)
  return Number(formatInTimeZone(localToUtc(date, 12 * 60, tz), tz, "i")) % 7;
}

export type SlotPlan = { durationMinutes: number; prepMinutes: number; cleanupMinutes: number };

export function planFor(services: { durationMinutes: number; prepMinutes: number; cleanupMinutes: number }[]): SlotPlan {
  return {
    durationMinutes: services.reduce((s, x) => s + x.durationMinutes, 0),
    prepMinutes: services.reduce((s, x) => s + x.prepMinutes, 0),
    cleanupMinutes: services.reduce((s, x) => s + x.cleanupMinutes, 0),
  };
}

/** Mark payment holds / approval requests whose window has passed as EXPIRED so they release their slot. */
export async function expireStaleHolds(tx: Tx, where: { staffId?: string } = {}) {
  const now = new Date();
  const stale = await tx.booking.findMany({
    where: { ...where, status: { in: ["PENDING_PAYMENT", "AWAITING_APPROVAL"] }, holdExpiresAt: { lt: now }, paymentStatus: { in: ["UNPAID", "FAILED"] } },
    select: { id: true, status: true },
  });
  for (const b of stale) {
    const r = await tx.booking.updateMany({ where: { id: b.id, status: b.status }, data: { status: "EXPIRED" } });
    if (r.count) await tx.bookingStatusHistory.create({ data: { bookingId: b.id, fromStatus: b.status, toStatus: "EXPIRED", note: "Hold window elapsed" } });
  }
  return stale.length;
}

export type Slot = { startsAt: string; endsAt: string; staffIds: string[] };

/**
 * Compute bookable start times for a local calendar date.
 * The whole block (prep + service + cleanup) must sit inside one working window and not overlap
 * time off or another active booking for that staff member.
 */
export async function computeSlots(
  args: { providerId: string; date: string; plan: SlotPlan; staffId?: string; now?: Date; excludeBookingId?: string },
  tx: Tx = db,
): Promise<Slot[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new AppError("BAD_DATE", "Invalid date");
  const provider = await tx.providerProfile.findUnique({ where: { id: args.providerId } });
  if (!provider || provider.status !== "APPROVED" || provider.isSample) return [];
  const tz = provider.timezone;
  const now = args.now ?? new Date();
  const earliest = new Date(now.getTime() + provider.minNoticeMinutes * 60_000);
  const latest = new Date(now.getTime() + provider.maxAdvanceDays * 864e5);
  const dayStart = localToUtc(args.date, 0, tz);
  const dayEnd = new Date(dayStart.getTime() + 864e5);
  if (dayEnd < earliest || dayStart > latest) return [];

  const weekday = weekdayOf(args.date, tz);
  const staff = await tx.staff.findMany({
    where: { providerId: provider.id, active: true, ...(args.staffId ? { id: args.staffId } : {}) },
    include: {
      workingHours: { where: { weekday } },
      timeOff: { where: { startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } } },
      bookings: {
        where: {
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
          ...(args.excludeBookingId ? { id: { not: args.excludeBookingId } } : {}),
          blockStart: { lt: dayEnd }, blockEnd: { gt: dayStart },
          NOT: { AND: [{ status: { in: ["PENDING_PAYMENT", "AWAITING_APPROVAL"] } }, { holdExpiresAt: { lt: now } }] },
        },
        select: { blockStart: true, blockEnd: true },
      },
    },
  });

  const { durationMinutes, prepMinutes, cleanupMinutes } = args.plan;
  const step = Math.max(5, provider.slotStepMinutes);
  const map = new Map<string, Slot>();
  for (const s of staff) {
    const busy = [...s.timeOff.map((t) => [t.startsAt, t.endsAt]), ...s.bookings.map((b) => [b.blockStart, b.blockEnd])] as [Date, Date][];
    for (const w of s.workingHours) {
      for (let m = w.startMinute + prepMinutes; m + durationMinutes + cleanupMinutes <= w.endMinute; m += step) {
        const start = localToUtc(args.date, m, tz);
        if (start < earliest || start > latest) continue;
        const blockStart = new Date(start.getTime() - prepMinutes * 60_000);
        const end = new Date(start.getTime() + durationMinutes * 60_000);
        const blockEnd = new Date(end.getTime() + cleanupMinutes * 60_000);
        if (busy.some(([a, b]) => blockStart < b && a < blockEnd)) continue;
        const key = start.toISOString();
        const slot = map.get(key) ?? { startsAt: key, endsAt: end.toISOString(), staffIds: [] };
        slot.staffIds.push(s.id);
        map.set(key, slot);
      }
    }
  }
  return [...map.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function localDateOf(d: Date, tz: string) {
  return formatInTimeZone(d, tz, "yyyy-MM-dd");
}
