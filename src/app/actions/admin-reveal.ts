"use server";
import { requirePermission } from "@/server/auth/guards";
import { revealPayoutAccount } from "@/server/modules/payouts";

export async function revealAccountAction(payoutId: string) {
  const admin = await requirePermission("finance.payouts");
  return revealPayoutAccount(payoutId, admin.id);
}
