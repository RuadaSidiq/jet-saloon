import Link from "next/link";
import { pageAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { PageHeader, StatusBadge, Table, Badge } from "@/components/ui";
import { cn } from "@/lib/cn";

export default async function SupportQueue({ searchParams }: { searchParams: Promise<{ status?: string; mine?: string }> }) {
  const admin = await pageAdmin("support.view");
  const sp = await searchParams;
  const status = sp.status ?? "OPEN";
  const rows = await db.supportTicket.findMany({ where: { ...(status === "ALL" ? {} : { status }), ...(sp.mine ? { assignedToId: admin.id } : {}) }, orderBy: [{ priority: "desc" }, { updatedAt: "desc" }], take: 100, include: { user: { select: { name: true, role: true } }, assignedTo: { select: { name: true } } } });
  return (
    <>
      <PageHeader title="Support" actions={<Link href={`?status=${status}&mine=${sp.mine ? "" : "1"}`} className="text-sm text-brand">{sp.mine ? "All tickets" : "Assigned to me"}</Link>} />
      <div className="mb-4 flex gap-1 border-b border-line">{["OPEN", "IN_PROGRESS", "WAITING_ON_USER", "RESOLVED", "CLOSED", "ALL"].map((s) => <Link key={s} href={`?status=${s}`} className={cn("-mb-px border-b-2 px-3 py-2 text-sm", status === s ? "border-brand font-medium text-brand" : "border-transparent text-muted")}>{s.toLowerCase().replace(/_/g, " ")}</Link>)}</div>
      <Table head={["Ticket", "Subject", "From", "Category", "Priority", "Assignee", "Status", "Updated"]} empty="Queue is clear">
        {rows.map((t) => <tr key={t.id}><td><Link className="font-mono text-xs text-brand" href={`/admin/support/${t.id}`}>{t.reference}</Link></td><td>{t.subject}</td><td>{t.user.name} <span className="text-xs text-muted">({t.user.role.toLowerCase()})</span></td><td>{t.category.toLowerCase().replace(/_/g, " ")}</td><td>{["HIGH", "URGENT"].includes(t.priority) ? <Badge tone="bad">{t.priority.toLowerCase()}</Badge> : t.priority.toLowerCase()}</td><td>{t.assignedTo?.name ?? "—"}</td><td><StatusBadge status={t.status} /></td><td>{t.updatedAt.toLocaleDateString("en-GB")}</td></tr>)}
      </Table>
    </>
  );
}
