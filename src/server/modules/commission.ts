import { db, type Tx } from "../db";
import type { CommissionRule } from "@prisma/client";
import { getSetting } from "./settings";

/**
 * Resolve the commission rate in force at `at`, most specific first:
 * provider → category → country → global → settings default.
 * The resolved rate and rule id are snapshotted on the booking, so later rule changes never alter it.
 */
export async function resolveCommission(
  ctx: { providerId: string; categoryId: string; countryId: string; at?: Date },
  tx: Tx = db,
): Promise<{ rateBps: number; ruleId: string | null }> {
  const at = ctx.at ?? new Date();
  const live = { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] };
  const rules = await tx.commissionRule.findMany({
    where: {
      AND: [live],
      OR: [
        { scope: "PROVIDER", providerId: ctx.providerId },
        { scope: "CATEGORY", categoryId: ctx.categoryId },
        { scope: "COUNTRY", countryId: ctx.countryId },
        { scope: "GLOBAL" },
      ],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  const pick = (scope: CommissionRule["scope"]) => rules.find((r) => r.scope === scope);
  const rule = pick("PROVIDER") ?? pick("CATEGORY") ?? pick("COUNTRY") ?? pick("GLOBAL");
  if (rule) return { rateBps: rule.rateBps, ruleId: rule.id };
  return { rateBps: await getSetting("finance.defaultCommissionBps"), ruleId: null };
}

/** Creating a new rule closes the previous open rule of the same scope+target (history is kept). */
export async function createCommissionRule(input: {
  scope: CommissionRule["scope"]; countryId?: string | null; categoryId?: string | null; providerId?: string | null;
  rateBps: number; effectiveFrom: Date; note?: string; createdById: string;
}) {
  return db.$transaction(async (tx) => {
    const target = { scope: input.scope, countryId: input.countryId ?? null, categoryId: input.categoryId ?? null, providerId: input.providerId ?? null };
    await tx.commissionRule.updateMany({
      where: { ...target, effectiveTo: null, effectiveFrom: { lt: input.effectiveFrom } },
      data: { effectiveTo: input.effectiveFrom },
    });
    return tx.commissionRule.create({ data: { ...target, rateBps: input.rateBps, effectiveFrom: input.effectiveFrom, note: input.note, createdById: input.createdById } });
  });
}
