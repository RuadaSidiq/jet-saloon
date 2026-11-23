import Link from "next/link";
import { pageProvider } from "@/server/auth/guards";
import { db } from "@/server/db";
import type { BookingStatus } from "@prisma/client";
import { dt, money } from "@/lib/format";
import { PageHeader, Pagination, StatusBadge, Table } from "@/components/ui";
import { cn } from "@/lib/cn";

const TABS: [string, string][] = [["", "All"], ["AWAITING_APPROVAL", "Requests"], ["CONFIRMED", "Confirmed"], ["IN_PROGRESS", "In progress"], ["COMPLETED", "Completed"], ["CANCELLED", "Cancelled"]];

export default async function ProviderBookings({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; q?: string }> }) {
  const { provider } = await pageProvider("/business/bookings");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where = { providerId: provider.id, ...(sp.status ? { status: sp.status as BookingStatus } : { status: { notIn: ["EXPIRED"] as BookingStatus[] } }), ...(sp.q ? { OR: [{ reference: { contains: sp.q.toUpperCase() } }, { customer: { name: { contains: sp.q, mode: "insensitive" as const } } }] } : {}) };
  const [total, rows] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({ where, orderBy: { startsAt: "desc" }, skip: (page - 1) * 25, take: 25, include: { items: true, customer: { select: { name: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Bookings" actions={<form><input name="q" defaultValue={sp.q} placeholder="Search reference or customer" className="h-9 rounded-2xl border border-line px-3 text-sm" /></form>} />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">{TABS.map(([k, l]) => <Link key={k} href={`?status=${k}`} className={cn("-mb-px shrink-0 border-b-2 px-3 py-2 text-sm", (sp.status ?? "") === k ? "border-brand font-medium text-brand" : "border-transparent text-muted")}>{l}</Link>)}</div>
      <Table head={["When", "Customer", "Services", "Location", "Your earnings", "Status"]} empty="No bookings in this view">
        {rows.map((b) => (
          <tr key={b.id}>
            <td><Link href={`/business/bookings/${b.reference}`} className="font-medium text-brand">{dt(b.startsAt, b.timezone)}</Link><div className="text-xs text-muted">{b.reference}</div></td>
            <td>{b.customer.name}</td>
            <td>{b.items.map((i) => i.nameSnapshot).join(", ")}</td>
            <td>{b.locationType === "HOME" ? "Home" : "Studio"}</td>
            <td className="tabular">{money(b.providerNetMinor, b.currency)}</td>
            <td><StatusBadge status={b.status} /></td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 25)} href={(p) => `?status=${sp.status ?? ""}&page=${p}`} />
    </>
  );
}
