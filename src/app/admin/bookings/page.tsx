import Link from "next/link";
import type { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";
import { pageAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { SearchBar } from "@/components/admin/filters";
import { dt, money } from "@/lib/format";
import { PageHeader, Pagination, StatusBadge, Table } from "@/components/ui";

const STATUSES = ["AWAITING_APPROVAL", "PENDING_PAYMENT", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REJECTED", "EXPIRED", "NO_SHOW"];

export default async function AdminBookings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageAdmin("bookings.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where: Prisma.BookingWhereInput = {
    ...(sp.status ? { status: sp.status as BookingStatus } : {}), ...(sp.payment ? { paymentStatus: sp.payment as PaymentStatus } : {}),
    ...(sp.country ? { countryCode: sp.country } : {}), ...(sp.provider ? { providerId: sp.provider } : {}),
    ...(sp.from || sp.to ? { startsAt: { ...(sp.from ? { gte: new Date(sp.from) } : {}), ...(sp.to ? { lte: new Date(sp.to + "T23:59:59Z") } : {}) } } : {}),
    ...(sp.q ? { OR: [{ reference: { contains: sp.q.toUpperCase() } }, { customer: { email: { contains: sp.q, mode: "insensitive" } } }, { providerNameSnapshot: { contains: sp.q, mode: "insensitive" } }, { payments: { some: { reference: { contains: sp.q.toUpperCase() } } } }] } : {}),
  };
  const [total, rows, countries] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 30, take: 30, include: { items: true, customer: { select: { name: true } }, payments: { where: { status: "SUCCEEDED" }, select: { reference: true } } } }),
    db.country.findMany({ select: { code: true, name: true } }),
  ]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();
  return (
    <>
      <PageHeader title="Bookings" description={`${total} matching`} />
      <SearchBar placeholder="Booking ref, payment ref, customer email or provider" defaultValue={sp.q}>
        <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-2xl border border-line px-2 text-sm"><option value="">Any status</option>{STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase().replace(/_/g, " ")}</option>)}</select>
        <select name="payment" defaultValue={sp.payment ?? ""} className="h-9 rounded-2xl border border-line px-2 text-sm"><option value="">Any payment</option>{["UNPAID", "PROCESSING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "FAILED"].map((s) => <option key={s} value={s}>{s.toLowerCase().replace(/_/g, " ")}</option>)}</select>
        <select name="country" defaultValue={sp.country ?? ""} className="h-9 rounded-2xl border border-line px-2 text-sm"><option value="">All countries</option>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
        <input type="date" name="from" defaultValue={sp.from} className="h-9 rounded-2xl border border-line px-2 text-sm" aria-label="From" />
        <input type="date" name="to" defaultValue={sp.to} className="h-9 rounded-2xl border border-line px-2 text-sm" aria-label="To" />
      </SearchBar>
      <Table head={["Reference", "Customer", "Provider", "Service", "Appointment", "City", "Amount", "Status", "Payment", "Txn ref"]}>
        {rows.map((b) => (
          <tr key={b.id}>
            <td><Link href={`/admin/bookings/${b.reference}`} className="font-medium text-brand">{b.reference}</Link></td>
            <td>{b.customer.name}</td><td>{b.providerNameSnapshot}</td><td>{b.items.map((i) => i.nameSnapshot).join(", ")}</td>
            <td>{dt(b.startsAt, b.timezone)}</td><td>{b.cityName ?? "—"}, {b.countryCode}</td><td className="tabular">{money(b.totalMinor, b.currency)}</td>
            <td><StatusBadge status={b.status} /></td><td><StatusBadge status={b.paymentStatus} /></td><td className="font-mono text-xs">{b.payments[0]?.reference ?? "—"}</td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 30)} href={(n) => `?${qs}&page=${n}`} />
    </>
  );
}
