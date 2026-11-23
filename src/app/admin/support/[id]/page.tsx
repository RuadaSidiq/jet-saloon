import Link from "next/link";
import { notFound } from "next/navigation";
import { pageAdmin, hasPermission } from "@/server/auth/guards";
import { db } from "@/server/db";
import { QuickForm } from "@/components/ui/act";
import { ticketAdminAction } from "@/app/actions/admin";
import { Card, PageHeader, StatusBadge } from "@/components/ui";

export default async function AdminTicket({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await pageAdmin("support.view", `/admin/support/${id}`);
  const t = await db.supportTicket.findUnique({ where: { id }, include: { user: true, booking: true, messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, role: true } } } } } });
  if (!t) notFound();
  const canManage = await hasPermission(admin.id, "support.manage");
  const staff = await db.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader title={t.subject} description={<>{t.reference} · <Link className="text-brand" href={`/admin/users/${t.userId}`}>{t.user.name}</Link>{t.booking && <> · booking <Link className="text-brand" href={`/admin/bookings/${t.booking.reference}`}>{t.booking.reference}</Link></>}</>} actions={<StatusBadge status={t.status} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card title="Conversation">
          <ul className="space-y-4">{t.messages.map((m) => <li key={m.id} className={m.internal ? "rounded-2xl border border-dashed border-warn/40 bg-warn-soft p-3" : m.author.role === "ADMIN" ? "rounded-2xl bg-brand-soft p-3" : ""}><p className="text-xs text-muted">{m.author.name}{m.internal && " · internal note"} · {m.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p><p className="mt-1 whitespace-pre-line text-sm">{m.body}</p></li>)}</ul>
          {canManage && <div className="mt-6 border-t border-line pt-4"><QuickForm action={ticketAdminAction} hidden={{ ticketId: t.id }} resetOnSuccess submit="Send" columns={1} fields={[{ name: "body", label: "Reply", type: "textarea", required: true }, { name: "internal", label: "Internal note (not visible to the user)", type: "checkbox" }]} /></div>}
        </Card>
        {canManage && <Card title="Ticket"><QuickForm action={ticketAdminAction} hidden={{ ticketId: t.id }} columns={1} fields={[
          { name: "status", label: "Status", type: "select", defaultValue: t.status, options: ["OPEN", "IN_PROGRESS", "WAITING_ON_USER", "RESOLVED", "CLOSED"].map((s) => [s, s.toLowerCase().replace(/_/g, " ")]) },
          { name: "priority", label: "Priority", type: "select", defaultValue: t.priority, options: ["LOW", "NORMAL", "HIGH", "URGENT"].map((s) => [s, s.toLowerCase()]) },
          { name: "assignedToId", label: "Assignee", type: "select", defaultValue: t.assignedToId ?? "", options: [["", "Unassigned"], ...staff.map((s) => [s.id, s.name] as [string, string])] },
          { name: "resolution", label: "Resolution record", type: "textarea", defaultValue: t.resolution ?? "" },
        ]} /></Card>}
      </div>
    </>
  );
}
