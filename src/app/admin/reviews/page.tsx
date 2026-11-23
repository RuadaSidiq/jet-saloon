import Link from "next/link";
import { pageAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { Act } from "@/components/ui/act";
import { reviewModerationAction } from "@/app/actions/admin";
import { Empty, PageHeader, Stars, StatusBadge } from "@/components/ui";

export default async function ReviewModeration({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await pageAdmin("content.manage");
  const all = !!(await searchParams).all;
  const reviews = await db.review.findMany({ where: all ? {} : { reports: { some: { resolvedAt: null } } }, orderBy: { createdAt: "desc" }, take: 100, include: { customer: { select: { name: true } }, provider: { select: { businessName: true, id: true } }, reports: { where: { resolvedAt: null } } } });
  return (
    <>
      <PageHeader title="Reviews" description={all ? "All reviews" : "Reported reviews awaiting moderation"} actions={<Link className="text-sm text-brand" href={all ? "?" : "?all=1"}>{all ? "Show reported only" : "Show all"}</Link>} />
      {reviews.length === 0 ? <Empty title="Nothing to moderate" /> : <ul className="space-y-3">{reviews.map((r) => (
        <li key={r.id} className="glass rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm"><Stars value={r.rating} /><span className="font-medium">{r.customer.name}</span>→<Link className="text-brand" href={`/admin/providers/${r.provider.id}`}>{r.provider.businessName}</Link><StatusBadge status={r.status} /></div>
          {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
          {r.reports.length > 0 && <ul className="mt-2 text-xs text-bad">{r.reports.map((x) => <li key={x.id}>Reported: {x.reason}</li>)}</ul>}
          <div className="mt-3 flex gap-2">
            {r.status === "PUBLISHED" ? <Act action={reviewModerationAction} fields={{ reviewId: r.id, status: "HIDDEN" }} label="Hide review" variant="danger" /> : <Act action={reviewModerationAction} fields={{ reviewId: r.id, status: "PUBLISHED" }} label="Restore" />}
            {r.reports.length > 0 && r.status === "PUBLISHED" && <Act action={reviewModerationAction} fields={{ reviewId: r.id, status: "PUBLISHED" }} label="Keep (dismiss reports)" variant="ghost" />}
          </div>
        </li>))}</ul>}
    </>
  );
}
