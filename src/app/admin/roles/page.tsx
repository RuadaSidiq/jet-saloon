import { pageAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { PERMISSIONS } from "@/server/rbac";
import { RoleEditor } from "@/components/admin/role-editor";
import { adminUserAction } from "@/app/actions/admin";
import { Badge, Card, PageHeader, Table } from "@/components/ui";

export default async function Roles() {
  await pageAdmin("roles.manage");
  const [roles, admins] = await Promise.all([
    db.adminRole.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } }),
    db.user.findMany({ where: { role: "ADMIN" }, include: { adminRoles: { include: { role: true } } }, orderBy: { name: "asc" } }),
  ]);
  const editable = roles.filter((r) => r.key !== "super_admin");
  return (
    <>
      <PageHeader title="Roles & administrators" description="Grant only what each person needs. Sensitive actions are logged in the audit log." />
      <div className="space-y-6">
        <Card title="Administrators">
          <Table head={["Name", "Email", "Roles"]}>{admins.map((a) => <tr key={a.id}><td>{a.name}</td><td>{a.email}</td><td className="space-x-1">{a.isSuperAdmin && <Badge tone="brand">Super Admin</Badge>}{a.adminRoles.map((r) => <Badge key={r.roleId}>{r.role.name}</Badge>)}</td></tr>)}</Table>
          <div className="mt-6"><h3 className="mb-2 text-sm font-semibold">Grant or change admin access</h3>
            <p className="text-xs text-muted">Enter an existing account&apos;s email and tick the roles to grant.</p>
            <RoleAssign roles={editable.map((r) => ({ id: r.id, name: r.name }))} />
          </div>
        </Card>
        {editable.map((r) => <Card key={r.id} title={<>{r.name} <span className="text-xs font-normal text-muted">· {r._count.users} admin(s)</span></>}><RoleEditor role={{ id: r.id, name: r.name, permissions: r.permissions }} all={PERMISSIONS} /></Card>)}
        <Card title="New role"><RoleEditor all={PERMISSIONS} /></Card>
      </div>
    </>
  );
}

function RoleAssign({ roles }: { roles: { id: string; name: string }[] }) {
  return (
    <form action={async (fd: FormData) => { "use server"; await adminUserAction(null, fd); }} className="mt-2 space-y-2 rounded-md border border-line p-4">
      <input name="email" type="email" required placeholder="admin@example.com" className="h-9 w-full rounded-md border border-line px-3 text-sm" />
      <div className="grid gap-1 sm:grid-cols-3">{roles.map((r) => <label key={r.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="roleIds" value={r.id} className="accent-brand" />{r.name}</label>)}</div>
      <button className="h-9 rounded-md bg-brand px-4 text-sm text-white">Assign roles</button>
      <p className="text-xs text-muted">Unchecking every role removes admin access.</p>
    </form>
  );
}
