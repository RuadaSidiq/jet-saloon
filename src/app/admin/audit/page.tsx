import { pageAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { SearchBar } from "@/components/admin/filters";
import { PageHeader, Pagination, Table } from "@/components/ui";

export default async function Audit({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await pageAdmin("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where = sp.q ? { OR: [{ action: { contains: sp.q } }, { entityId: sp.q }, { actor: { email: { contains: sp.q } } }] } : {};
  const [total, rows] = await Promise.all([db.auditLog.count({ where }), db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { actor: { select: { email: true } } } })]);
  return (
    <>
      <PageHeader title="Audit log" description="Append-only record of sensitive actions." />
      <SearchBar placeholder="Action, entity id or actor email" defaultValue={sp.q} />
      <Table head={["When", "Actor", "Action", "Entity", "Details"]}>{rows.map((r) => <tr key={r.id} className="align-top"><td className="whitespace-nowrap">{r.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" })}</td><td>{r.actor?.email ?? "system"}</td><td className="font-mono text-xs">{r.action}</td><td className="text-xs">{r.entityType}<br /><span className="text-muted">{r.entityId}</span></td><td className="max-w-md break-all font-mono text-[11px] text-muted">{r.metadata ? JSON.stringify(r.metadata) : ""}</td></tr>)}</Table>
      <Pagination page={page} pages={Math.ceil(total / 50)} href={(n) => `?q=${sp.q ?? ""}&page=${n}`} />
    </>
  );
}
