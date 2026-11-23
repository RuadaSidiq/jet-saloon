import { db } from "../db";

export type Range = { from: Date; to: Date };

export function rangeFromPreset(preset: string | undefined, from?: string, to?: string): Range {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setUTCHours(0, 0, 0, 0);
  switch (preset) {
    case "today": return { from: startOfDay, to: now };
    case "7d": return { from: new Date(now.getTime() - 7 * 864e5), to: now };
    case "90d": return { from: new Date(now.getTime() - 90 * 864e5), to: now };
    case "year": return { from: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), to: now };
    case "custom": if (from && to) return { from: new Date(from), to: new Date(new Date(to).getTime() + 864e5 - 1) }; // fallthrough
    default: return { from: new Date(now.getTime() - 30 * 864e5), to: now };
  }
}

/** All admin metrics are computed from records; money is grouped by currency and never mixed. */
export async function adminOverview(r: Range) {
  const inRange = { gte: r.from, lte: r.to };
  const [customers, providersByStatus, bookingsByStatus, gbv, commissionRows, refunds, pendingPayouts, newCustomers, prevCustomers] = await Promise.all([
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.providerProfile.groupBy({ by: ["status"], _count: true }),
    db.booking.groupBy({ by: ["status"], where: { createdAt: inRange }, _count: true }),
    db.booking.groupBy({ by: ["currency"], where: { createdAt: inRange, paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } }, _sum: { totalMinor: true } }),
    db.$queryRaw<{ currency: string; amount: bigint }[]>`
      SELECT e."currency", -SUM(e."amountMinor")::bigint AS amount FROM "LedgerEntry" e
      JOIN "LedgerAccount" a ON a.id = e."accountId"
      WHERE a.code LIKE 'platform:commission:%' AND e."createdAt" BETWEEN ${r.from} AND ${r.to}
      GROUP BY e."currency"`,
    db.refund.groupBy({ by: ["currency"], where: { createdAt: inRange, status: { in: ["PROCESSING", "COMPLETED"] } }, _sum: { amountMinor: true } }),
    db.payout.groupBy({ by: ["currency"], where: { status: { in: ["REQUESTED", "APPROVED", "PROCESSING"] } }, _sum: { amountMinor: true }, _count: true }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: inRange } }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: new Date(r.from.getTime() - (r.to.getTime() - r.from.getTime())), lt: r.from } } }),
  ]);
  const p = Object.fromEntries(providersByStatus.map((x) => [x.status, x._count]));
  const b = Object.fromEntries(bookingsByStatus.map((x) => [x.status, x._count]));
  return {
    customers, newCustomers, customerGrowthPct: prevCustomers ? Math.round(((newCustomers - prevCustomers) / prevCustomers) * 100) : null,
    providers: { total: Object.values(p).reduce((s, n) => s + n, 0), pending: (p.SUBMITTED ?? 0) + (p.UNDER_REVIEW ?? 0), approved: p.APPROVED ?? 0, suspended: p.SUSPENDED ?? 0 },
    bookings: { total: Object.values(b).reduce((s, n) => s + n, 0), completed: b.COMPLETED ?? 0, cancelled: (b.CANCELLED ?? 0) + (b.REJECTED ?? 0), confirmed: b.CONFIRMED ?? 0 },
    gbv: gbv.map((g) => ({ currency: g.currency, amountMinor: g._sum.totalMinor ?? 0 })),
    commission: commissionRows.map((c) => ({ currency: c.currency, amountMinor: Number(c.amount) })),
    refunds: refunds.map((g) => ({ currency: g.currency, amountMinor: g._sum.amountMinor ?? 0 })),
    pendingPayouts: pendingPayouts.map((g) => ({ currency: g.currency, amountMinor: g._sum.amountMinor ?? 0, count: g._count })),
  };
}

/** Daily series for charts. */
export async function dailyBookings(r: Range, providerId?: string) {
  const rows = await db.$queryRaw<{ day: Date; bookings: bigint; completed: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS bookings, COUNT(*) FILTER (WHERE status = 'COMPLETED')::bigint AS completed
    FROM "Booking" WHERE "createdAt" BETWEEN ${r.from} AND ${r.to} ${providerId ? Prisma_sql_provider(providerId) : Prisma_empty()}
    GROUP BY 1 ORDER BY 1`;
  return rows.map((x) => ({ day: x.day.toISOString().slice(0, 10), bookings: Number(x.bookings), completed: Number(x.completed) }));
}
import { Prisma } from "@prisma/client";
const Prisma_sql_provider = (id: string) => Prisma.sql`AND "providerId" = ${id}`;
const Prisma_empty = () => Prisma.empty;

export async function providerOverview(providerId: string) {
  const now = new Date();
  const [byStatus, upcoming, provider, views30, distinctCustomers, repeatCustomers] = await Promise.all([
    db.booking.groupBy({ by: ["status"], where: { providerId }, _count: true }),
    db.booking.count({ where: { providerId, status: { in: ["CONFIRMED", "AWAITING_APPROVAL", "PENDING_PAYMENT"] }, startsAt: { gte: now } } }),
    db.providerProfile.findUniqueOrThrow({ where: { id: providerId } }),
    db.providerDailyStat.aggregate({ where: { providerId, day: { gte: new Date(now.getTime() - 30 * 864e5) } }, _sum: { views: true } }),
    db.booking.groupBy({ by: ["customerId"], where: { providerId, status: "COMPLETED" } }),
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM (SELECT "customerId" FROM "Booking" WHERE "providerId" = ${providerId} AND status = 'COMPLETED' GROUP BY 1 HAVING COUNT(*) > 1) t`,
  ]);
  const s = Object.fromEntries(byStatus.map((x) => [x.status, x._count]));
  const total = Object.values(s).reduce((a, n) => a + n, 0);
  const bookings30 = await db.booking.count({ where: { providerId, createdAt: { gte: new Date(now.getTime() - 30 * 864e5) } } });
  const v = views30._sum.views ?? 0;
  return {
    total, upcoming, completed: s.COMPLETED ?? 0, cancelled: (s.CANCELLED ?? 0) + (s.REJECTED ?? 0), noShow: s.NO_SHOW ?? 0,
    ratingAvg: provider.ratingAvg, ratingCount: provider.ratingCount, profileViews: provider.profileViews, views30: v,
    conversion30: v ? Math.round((bookings30 / v) * 1000) / 10 : null,
    customers: distinctCustomers.length, repeatCustomers: Number(repeatCustomers[0]?.n ?? 0),
  };
}

/** Revenue figures straight from ledger + bookings for the provider earnings page. */
export async function providerFinancials(providerId: string) {
  const bookings = await db.booking.groupBy({
    by: ["currency"], where: { providerId, paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } },
    _sum: { totalMinor: true, subtotalMinor: true, travelFeeMinor: true, commissionMinor: true, discountMinor: true, providerNetMinor: true },
  });
  const refunds = await db.$queryRaw<{ currency: string; amount: bigint }[]>`
    SELECT e."currency", SUM(e."amountMinor")::bigint AS amount FROM "LedgerEntry" e
    JOIN "LedgerTransaction" t ON t.id = e."transactionId" JOIN "LedgerAccount" a ON a.id = e."accountId"
    WHERE t.type = 'REFUND' AND a."providerId" = ${providerId} GROUP BY 1`;
  const paidOut = await db.payout.groupBy({ by: ["currency"], where: { providerId, status: "PAID" }, _sum: { amountMinor: true } });
  return { bookings, refunds: refunds.map((r) => ({ currency: r.currency, amountMinor: Number(r.amount) })), paidOut };
}
