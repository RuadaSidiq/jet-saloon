import type { Tx } from "../db";
import { AppError } from "../errors";
import { applyBps } from "../money";

/** Validate a coupon and compute its discount on the service subtotal. */
export async function evaluateCoupon(
  tx: Tx,
  a: { code: string; userId: string; providerId: string; countryId: string; currency: string; subtotalMinor: number; at?: Date },
) {
  const at = a.at ?? new Date();
  const c = await tx.coupon.findUnique({ where: { code: a.code.trim().toUpperCase() } });
  const invalid = () => new AppError("COUPON", "This promo code is not valid for this booking");
  if (!c || !c.active || c.startsAt > at || (c.endsAt && c.endsAt < at)) throw invalid();
  if (c.countryId && c.countryId !== a.countryId) throw invalid();
  if (c.providerId && c.providerId !== a.providerId) throw invalid();
  if (c.kind === "FIXED" && c.currency !== a.currency) throw invalid();
  if (a.subtotalMinor < c.minSubtotalMinor) throw new AppError("COUPON", "Your booking does not meet this code's minimum amount");
  const counted = { couponId: c.id, booking: { status: { notIn: ["CANCELLED", "EXPIRED", "REJECTED"] as never } } };
  if (c.maxRedemptions != null && (await tx.couponRedemption.count({ where: counted })) >= c.maxRedemptions) throw new AppError("COUPON", "This promo code has been fully redeemed");
  if ((await tx.couponRedemption.count({ where: { ...counted, userId: a.userId } })) >= c.perUserLimit) throw new AppError("COUPON", "You have already used this promo code");
  let discount = c.kind === "PERCENT" ? applyBps(a.subtotalMinor, c.value) : c.value;
  if (c.maxDiscountMinor != null) discount = Math.min(discount, c.maxDiscountMinor);
  discount = Math.min(discount, a.subtotalMinor);
  return { coupon: c, discountMinor: discount, fundedBy: c.providerId ? "PROVIDER" : c.fundedBy };
}
