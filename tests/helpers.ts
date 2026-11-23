import { db } from "../src/server/db";
import { addDays, nextMonday } from "date-fns";
import { devSetOutcome, devSignWebhook } from "../src/server/modules/payments/dev";
import { handleWebhook } from "../src/server/modules/payments/service";

let n = 0;
export const uid = () => `${Date.now().toString(36)}${(n++).toString(36)}`;

export async function makeUser(role: "CUSTOMER" | "PROVIDER" | "ADMIN" = "CUSTOMER", extra: Record<string, unknown> = {}) {
  const id = uid();
  return db.user.create({ data: { email: `${role.toLowerCase()}-${id}@t.test`, name: `${role} ${id}`, passwordHash: "x", role, referralCode: `R${id}`.toUpperCase().slice(0, 12), ...extra } });
}

/** An approved provider in Accra working Mon–Sat 09:00–17:00 with one 60-minute service. */
export async function makeProvider(opts: { mode?: "INSTANT" | "APPROVAL"; price?: number; staff?: number; cleanup?: number } = {}) {
  const gh = await db.country.findUniqueOrThrow({ where: { code: "GH" } });
  const accra = await db.city.findFirstOrThrow({ where: { slug: "accra" } });
  const cat = await db.category.findUniqueOrThrow({ where: { slug: "makeup-artists" } });
  const user = await makeUser("PROVIDER");
  const id = uid();
  const p = await db.providerProfile.create({
    data: {
      userId: user.id, slug: `p-${id}`, businessName: `Studio ${id}`, displayName: `Pro ${id}`, countryId: gh.id, cityId: accra.id, timezone: "Africa/Accra",
      status: "APPROVED", bookingMode: opts.mode ?? "INSTANT", minNoticeMinutes: 60, offersHome: true,
      staff: { create: Array.from({ length: opts.staff ?? 1 }, (_, i) => ({ name: `Staff ${i}`, isOwner: i === 0, workingHours: { create: [1, 2, 3, 4, 5, 6].map((wd) => ({ weekday: wd, startMinute: 540, endMinute: 1020 })) } })) },
    },
  });
  const service = await db.service.create({ data: { providerId: p.id, categoryId: cat.id, name: "Glam", priceMinor: opts.price ?? 20000, currency: "GHS", durationMinutes: 60, cleanupMinutes: opts.cleanup ?? 0 } });
  return { provider: p, user, service };
}

/** 10:00 Accra (UTC+0) on a Monday at least 2 days from now. */
export function slotAt(hour = 10, weeksAhead = 0) {
  const d = addDays(nextMonday(addDays(new Date(), 2)), weeksAhead * 7);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0)).toISOString();
}

export async function payViaWebhook(paymentRef: string, outcome: "success" | "failed" = "success") {
  await devSetOutcome(paymentRef, outcome);
  const body = JSON.stringify({ event: outcome === "success" ? "charge.success" : "charge.failed", reference: paymentRef });
  return handleWebhook("dev", body, new Headers({ "x-dev-signature": devSignWebhook(body) }));
}

export async function ledgerIsBalanced() {
  const rows = await db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint n FROM (SELECT "transactionId", currency FROM "LedgerEntry" GROUP BY 1,2 HAVING SUM("amountMinor") <> 0) t`;
  return Number(rows[0].n) === 0;
}

export async function accountBalance(code: string) {
  const a = await db.ledgerAccount.findUnique({ where: { code } });
  if (!a) return 0;
  const r = await db.ledgerEntry.aggregate({ where: { accountId: a.id }, _sum: { amountMinor: true } });
  return r._sum.amountMinor ?? 0;
}
