import { db } from "../db";
import { AppError, notFound } from "../errors";
import { notify } from "../notify";

/** Only the customer of a COMPLETED booking may review it, once. */
export async function createReview(customerId: string, bookingRef: string, rating: number, comment?: string, photoUrls: string[] = []) {
  const b = await db.booking.findUnique({ where: { reference: bookingRef }, include: { provider: true, review: true } });
  if (!b || b.customerId !== customerId) throw notFound("Booking");
  if (b.status !== "COMPLETED") throw new AppError("NOT_ELIGIBLE", "You can review a professional after your appointment is completed");
  if (b.review) throw new AppError("DUPLICATE", "You have already reviewed this appointment");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError("RATING", "Choose a rating from 1 to 5");
  const review = await db.review.create({ data: { bookingId: b.id, customerId, providerId: b.providerId, rating, comment: comment?.trim().slice(0, 2000) || null, photoUrls: photoUrls.slice(0, 4) } });
  await recomputeRating(b.providerId);
  await notify(b.provider.userId, "review.new", "New review", `You received a ${rating}-star review.`, "/business/reviews");
  return review;
}

export async function recomputeRating(providerId: string) {
  const agg = await db.review.aggregate({ where: { providerId, status: "PUBLISHED" }, _avg: { rating: true }, _count: true });
  await db.providerProfile.update({ where: { id: providerId }, data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count } });
}

export async function respondToReview(providerUserId: string, reviewId: string, response: string) {
  const r = await db.review.findUnique({ where: { id: reviewId }, include: { provider: true } });
  if (!r || r.provider.userId !== providerUserId) throw notFound("Review");
  await db.review.update({ where: { id: r.id }, data: { providerResponse: response.trim().slice(0, 1000), respondedAt: new Date() } });
}

export async function reportReview(reporterId: string, reviewId: string, reason: string) {
  if (!(await db.review.findUnique({ where: { id: reviewId } }))) throw notFound("Review");
  await db.reviewReport.create({ data: { reviewId, reporterId, reason: reason.trim().slice(0, 500) } });
}

export async function moderateReview(reviewId: string, status: "PUBLISHED" | "HIDDEN") {
  const r = await db.review.update({ where: { id: reviewId }, data: { status } });
  await db.reviewReport.updateMany({ where: { reviewId, resolvedAt: null }, data: { resolvedAt: new Date() } });
  await recomputeRating(r.providerId);
}
