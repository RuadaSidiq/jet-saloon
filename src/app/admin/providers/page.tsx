import Link from "next/link";
import type { ProviderStatus } from "@prisma/client";
import { pageAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { SearchBar } from "@/components/admin/filters";
import { PageHeader, Pagination, StatusBadge, Table } from "@/components/ui";
import { cn } from "@/lib/cn";

const TABS: [string, string][] = [["", "All"], ["SUBMITTED", "Submitted"], ["UNDER_REVIEW", "Under review"], ["INFO_REQUESTED", "Info requested"], ["APPROVED", "Approved"], ["REJECTED", "Rejected"], ["SUSPENDED", "Suspended"], ["DRAFT", "Drafts"]];

export default async function Providers({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await pageAdmin("providers.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where = { ...(sp.status ? { status: sp.status as ProviderStatus } : {}), ...(sp.q ? { OR: [{ businessName: { contains: sp.q, mode: "insensitive" as const } }, { user: { email: { contains: sp.q, mode: "insensitive" as const } } }, { slug: { contains: sp.q.toLowerCase() } }] } : {}) };
  const [total, rows, counts] = await Promise.all([
    db.providerProfile.count({ where }),
    db.providerProfile.findMany({ where, orderBy: [{ submittedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], skip: (page - 1) * 30, take: 30, include: { user: { select: { email: true } }, city: true, country: true, _count: { select: { bookings: true } } } }),
    db.providerProfile.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: string) => (s ? counts.find((c) => c.status === s)?._count ?? 0 : counts.reduce((a, c) => a + c._count, 0));
  return (
    <>
      <PageHeader title="Providers" />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">{TABS.map(([k, l]) => <Link key={k} href={`?status=${k}`} className={cn("-mb-px shrink-0 border-b-2 px-3 py-2 text-sm", (sp.status ?? "") === k ? "border-brand font-medium text-brand" : "border-transparent text-muted")}>{l} <span className="tabular text-xs">({count(k)})</span></Link>)}</div>
      <SearchBar placeholder="Search business, email or slug" defaultValue={sp.q}><input type="hidden" name="status" value={sp.status ?? ""} /></SearchBar>
      <Table head={["Business", "Owner", "Location", "Bookings", "Rating", "Submitted", "Status"]}>
        {rows.map((p) => (
          <tr key={p.id}>
            <td><Link href={`/admin/providers/${p.id}`} className="font-medium text-brand">{p.businessName}</Link>{p.featured && <span className="ml-1 text-xs text-muted">★ featured</span>}</td>
            <td className="text-muted">{p.user.email}</td>
            <td>{p.city?.name ?? "—"}, {p.country.code}</td>
            <td className="tabular">{p._count.bookings}</td>
            <td className="tabular">{p.ratingCount ? `${p.ratingAvg.toFixed(1)} (${p.ratingCount})` : "—"}</td>
            <td>{p.submittedAt?.toLocaleDateString("en-GB") ?? "—"}</td>
            <td><StatusBadge status={p.status} /></td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 30)} href={(n) => `?status=${sp.status ?? ""}&q=${sp.q ?? ""}&page=${n}`} />
    </>
  );
}
