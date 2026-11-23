import Link from "next/link";
import { notFound } from "next/navigation";
import { pageAdmin, hasPermission } from "@/server/auth/guards";
import { db } from "@/server/db";
import { Act, QuickForm } from "@/components/ui/act";
import { userStatusAction, verifyUserEmailAction } from "@/app/actions/admin";
import { dt, money } from "@/lib/format";
import { Card, PageHeader, StatusBadge, Table } from "@/components/ui";

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await pageAdmin("users.view", `/admin/users/${id}`);
  const u = await db.user.findUnique({ where: { id }, include: { provider: true, country: true, city: true, bookings: { orderBy: { createdAt: "desc" }, take: 20, include: { payments: true } }, adminRoles: { include: { role: true } } } });
  if (!u) notFound();
  const canManage = await hasPermission(admin.id, "users.manage");
  return (
    <>
      <PageHeader title={u.name} description={`${u.email} · ${u.phone ?? "no phone"} · joined ${u.createdAt.toLocaleDateString("en-GB")}`} actions={<StatusBadge status={u.status} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Account">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-muted">Role</dt><dd>{u.role.toLowerCase()}{u.adminRoles.length > 0 && ` (${u.adminRoles.map((r) => r.role.name).join(", ")})`}</dd></div>
              <div><dt className="text-muted">Email verified</dt><dd>{u.emailVerifiedAt ? u.emailVerifiedAt.toLocaleDateString("en-GB") : "No"}</dd></div>
              <div><dt className="text-muted">Location</dt><dd>{[u.city?.name, u.country?.name].filter(Boolean).join(", ") || "—"}</dd></div>
              {u.provider && <div><dt className="text-muted">Provider profile</dt><dd><Link className="text-brand" href={`/admin/providers/${u.provider.id}`}>{u.provider.businessName}</Link></dd></div>}
              <div><dt className="text-muted">Referral code</dt><dd>{u.referralCode}</dd></div>
            </dl>
          </Card>
          <Card title="Booking & payment history">
            <Table head={["Ref", "When", "Provider", "Total", "Status", "Payment"]}>{u.bookings.map((b) => <tr key={b.id}><td><Link className="text-brand" href={`/admin/bookings/${b.reference}`}>{b.reference}</Link></td><td>{dt(b.startsAt, b.timezone)}</td><td>{b.providerNameSnapshot}</td><td className="tabular">{money(b.totalMinor, b.currency)}</td><td><StatusBadge status={b.status} /></td><td><StatusBadge status={b.paymentStatus} /></td></tr>)}</Table>
          </Card>
        </div>
        {canManage && (
          <aside className="space-y-6">
            <Card title="Manage account">
              <QuickForm action={userStatusAction} hidden={{ userId: u.id }} columns={1} fields={[
                { name: "status", label: "Status", type: "select", defaultValue: u.status, options: [["ACTIVE", "Active"], ["SUSPENDED", "Suspended (signs them out everywhere)"]] },
                { name: "notes", label: "Internal notes", type: "textarea", defaultValue: u.adminNotes ?? "" },
              ]} />
              {!u.emailVerifiedAt && <div className="mt-4"><Act action={verifyUserEmailAction} fields={{ userId: u.id }} label="Mark email verified" /></div>}
            </Card>
          </aside>
        )}
      </div>
    </>
  );
}
