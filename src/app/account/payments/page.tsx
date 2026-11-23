import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import Link from "next/link";
import { dt, money } from "@/lib/format";
import { PageHeader, StatusBadge, Table } from "@/components/ui";

export default async function Payments() {
  const user = await pageUser("/account/payments");
  const rows = await db.payment.findMany({ where: { booking: { customerId: user.id }, status: { not: "INITIATED" } }, orderBy: { createdAt: "desc" }, take: 100, include: { booking: true, refunds: true } });
  return (
    <>
      <PageHeader title="Payments" description="Every payment and refund on your account." />
      <Table head={["Date", "Booking", "Amount", "Method", "Reference", "Status", "Refunds"]} empty="No payments yet">
        {rows.map((p) => (
          <tr key={p.id}>
            <td>{dt(p.createdAt, p.booking.timezone, "date")}</td>
            <td><Link className="text-brand" href={`/account/bookings/${p.booking.reference}`}>{p.booking.reference}</Link></td>
            <td className="tabular">{money(p.amountMinor, p.currency)} <span className="text-xs text-muted">{p.currency}</span></td>
            <td>{p.channel ?? p.gateway}</td>
            <td className="font-mono text-xs">{p.reference}</td>
            <td><StatusBadge status={p.status} /></td>
            <td className="text-xs">{p.refunds.length ? p.refunds.map((r) => <div key={r.id}>{money(r.amountMinor, r.currency)} · {r.status.toLowerCase()}</div>) : "—"}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
