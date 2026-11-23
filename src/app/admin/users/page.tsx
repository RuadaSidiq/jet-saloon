import Link from "next/link";
import type { UserRole, UserStatus } from "@prisma/client";
import { pageAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { SearchBar } from "@/components/admin/filters";
import { PageHeader, Pagination, StatusBadge, Table } from "@/components/ui";

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }> }) {
  await pageAdmin("users.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where = { ...(sp.role ? { role: sp.role as UserRole } : {}), ...(sp.status ? { status: sp.status as UserStatus } : {}), ...(sp.q ? { OR: [{ email: { contains: sp.q, mode: "insensitive" as const } }, { name: { contains: sp.q, mode: "insensitive" as const } }, { phone: { contains: sp.q } }] } : {}) };
  const [total, users] = await Promise.all([db.user.count({ where }), db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 30, take: 30, include: { _count: { select: { bookings: true } } } })]);
  return (
    <>
      <PageHeader title="Users" description={`${total} accounts`} />
      <SearchBar placeholder="Name, email or phone" defaultValue={sp.q}>
        <select name="role" defaultValue={sp.role ?? ""} className="h-9 rounded-md border border-line px-2 text-sm"><option value="">All roles</option><option value="CUSTOMER">Customers</option><option value="PROVIDER">Providers</option><option value="ADMIN">Admins</option></select>
        <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-md border border-line px-2 text-sm"><option value="">Any status</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select>
      </SearchBar>
      <Table head={["Name", "Email", "Role", "Bookings", "Verified", "Joined", "Status"]}>
        {users.map((u) => <tr key={u.id}><td><Link href={`/admin/users/${u.id}`} className="font-medium text-brand">{u.name}</Link></td><td>{u.email}</td><td>{u.role.toLowerCase()}{u.isSuperAdmin && " (super)"}</td><td className="tabular">{u._count.bookings}</td><td>{u.emailVerifiedAt ? "✓" : "—"}</td><td>{u.createdAt.toLocaleDateString("en-GB")}</td><td><StatusBadge status={u.status} /></td></tr>)}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 30)} href={(n) => `?q=${sp.q ?? ""}&role=${sp.role ?? ""}&status=${sp.status ?? ""}&page=${n}`} />
    </>
  );
}
