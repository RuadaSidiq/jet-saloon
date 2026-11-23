import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import Link from "next/link";
import { Card, Empty, PageHeader, Stars, StatusBadge } from "@/components/ui";

export default async function MyReviews() {
  const user = await pageUser("/account/reviews");
  const [reviews, toReview] = await Promise.all([
    db.review.findMany({ where: { customerId: user.id }, include: { provider: true }, orderBy: { createdAt: "desc" } }),
    db.booking.findMany({ where: { customerId: user.id, status: "COMPLETED", review: null }, include: { items: true }, take: 10 }),
  ]);
  return (
    <>
      <PageHeader title="My reviews" />
      {toReview.length > 0 && <Card title="Waiting for your review" className="mb-6"><ul className="space-y-2 text-sm">{toReview.map((b) => <li key={b.id}><Link className="text-brand" href={`/account/bookings/${b.reference}`}>{b.items[0]?.nameSnapshot} with {b.providerNameSnapshot}</Link></li>)}</ul></Card>}
      {reviews.length === 0 ? <Empty title="No reviews yet" body="You can review a professional after a completed appointment." /> : (
        <ul className="space-y-3">{reviews.map((r) => (
          <li key={r.id} className="rounded-md border border-line bg-white p-4">
            <div className="flex items-center gap-2"><Stars value={r.rating} /><Link href={`/provider/${r.provider.slug}`} className="font-medium">{r.provider.businessName}</Link>{r.status === "HIDDEN" && <StatusBadge status="HIDDEN" />}</div>
            {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
            {r.providerResponse && <p className="mt-2 border-l-2 border-brand-soft pl-3 text-sm text-muted">{r.providerResponse}</p>}
          </li>
        ))}</ul>
      )}
    </>
  );
}
