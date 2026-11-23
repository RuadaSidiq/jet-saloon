import { pageProvider } from "@/server/auth/guards";
import { db } from "@/server/db";
import { QuickForm } from "@/components/ui/act";
import { reviewResponseAction } from "@/app/actions/business";
import { Empty, PageHeader, Stars } from "@/components/ui";
export default async function Reviews() {
  const { provider: p } = await pageProvider("/business/reviews");
  const reviews = await db.review.findMany({ where: { providerId: p.id }, orderBy: { createdAt: "desc" }, include: { customer: { select: { name: true } } } });
  return (<><PageHeader title="Reviews" description={p.ratingCount ? `${p.ratingAvg.toFixed(1)} average from ${p.ratingCount} reviews` : undefined} />
    {reviews.length === 0 ? <Empty title="No reviews yet" body="Customers can review you after a completed appointment." /> : <ul className="space-y-4">{reviews.map((r) => (
      <li key={r.id} className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2"><Stars value={r.rating} /><span className="text-sm font-medium">{r.customer.name.split(" ")[0]}</span><span className="text-xs text-muted">{r.createdAt.toLocaleDateString("en-GB")}</span>{r.status === "HIDDEN" && <span className="text-xs text-bad">Hidden by moderation</span>}</div>
        {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
        {r.providerResponse ? <p className="mt-2 border-l-2 border-brand-soft pl-3 text-sm text-muted">Your response: {r.providerResponse}</p> : <div className="mt-3"><QuickForm action={reviewResponseAction} hidden={{ reviewId: r.id }} submit="Post response" columns={1} fields={[{ name: "response", label: "Respond publicly", type: "textarea", required: true }]} /></div>}
      </li>))}</ul>}</>);
}
