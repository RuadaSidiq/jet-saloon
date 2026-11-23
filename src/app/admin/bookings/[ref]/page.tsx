import Link from "next/link";
import { notFound } from "next/navigation";
import { pageAdmin, hasPermission } from "@/server/auth/guards";
import { db } from "@/server/db";
import { QuickForm, Act } from "@/components/ui/act";
import { adminCancelBookingAction, adminRefundAction, reverifyPaymentAction } from "@/app/actions/admin";
import { toMajorString } from "@/server/money";
import { dt, money } from "@/lib/format";
import { Card, PageHeader, StatusBadge, Table } from "@/components/ui";

export default async function AdminBooking({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const admin = await pageAdmin("bookings.view", `/admin/bookings/${ref}`);
  const b = await db.booking.findUnique({ where: { reference: ref }, include: { items: true, customer: true, provider: true, staff: true, coupon: true, history: { orderBy: { createdAt: "asc" } }, payments: { include: { refunds: true }, orderBy: { createdAt: "asc" } }, tickets: true } });
  if (!b) notFound();
  const [canManage, canRefund, canFinance] = await Promise.all([hasPermission(admin.id, "bookings.manage"), hasPermission(admin.id, "finance.refunds"), hasPermission(admin.id, "finance.view")]);
  const ledger = canFinance ? await db.ledgerTransaction.findMany({ where: { OR: [{ bookingId: b.id }, { paymentId: { in: b.payments.map((p) => p.id) } }] }, orderBy: { createdAt: "asc" }, include: { entries: { include: { account: true } } } }) : [];
  const cur = await db.currency.findUniqueOrThrow({ where: { code: b.currency } });
  const paid = b.payments.find((p) => p.status === "SUCCEEDED");
  const refundable = paid ? paid.amountMinor - paid.refunds.filter((r) => r.status !== "FAILED").reduce((s, r) => s + r.amountMinor, 0) : 0;
  return (
    <>
      <PageHeader title={`Booking ${b.reference}`} description={<><Link className="text-brand" href={`/admin/users/${b.customerId}`}>{b.customer.name}</Link> with <Link className="text-brand" href={`/admin/providers/${b.providerId}`}>{b.providerNameSnapshot}</Link></>} actions={<><StatusBadge status={b.status} /><StatusBadge status={b.paymentStatus} /></>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Details">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-muted">Appointment</dt><dd>{dt(b.startsAt, b.timezone)} – {dt(b.endsAt, b.timezone, "time")}</dd></div>
              <div><dt className="text-muted">Blocked</dt><dd>{dt(b.blockStart, b.timezone, "time")} – {dt(b.blockEnd, b.timezone, "time")} ({b.staff.name})</dd></div>
              <div><dt className="text-muted">Location</dt><dd>{b.locationType}{b.homeAddress && `: ${b.homeAddress}`}</dd></div>
              <div><dt className="text-muted">Services</dt><dd>{b.items.map((i) => `${i.nameSnapshot} (${money(i.unitPriceMinor, b.currency)})`).join(", ")}</dd></div>
              <div><dt className="text-muted">Total charged</dt><dd className="tabular">{money(b.totalMinor, b.currency)}{b.coupon && ` (code ${b.coupon.code})`}</dd></div>
              <div><dt className="text-muted">Commission</dt><dd className="tabular">{money(b.commissionMinor, b.currency)} at {(b.commissionRateBps / 100).toFixed(2)}%{b.commissionRuleId ? "" : " (default)"}</dd></div>
              <div><dt className="text-muted">Provider net</dt><dd className="tabular">{money(b.providerNetMinor, b.currency)}</dd></div>
              <div><dt className="text-muted">Settled</dt><dd>{b.settledAt ? dt(b.settledAt, b.timezone) : "Not yet"}</dd></div>
              <div><dt className="text-muted">Created</dt><dd>{dt(b.createdAt, b.timezone)}</dd></div>
              {b.cancellationReason && <div className="sm:col-span-3"><dt className="text-muted">Cancellation / rejection reason</dt><dd>{b.cancellationReason}</dd></div>}
            </dl>
          </Card>
          <Card title="Payments">
            <Table head={["Reference", "Gateway", "Amount", "Status", "Verified", "Refunds", ""]}>{b.payments.map((p) => (
              <tr key={p.id}><td className="font-mono text-xs">{p.reference}</td><td>{p.gateway}{p.channel && ` · ${p.channel}`}</td><td className="tabular">{money(p.amountMinor, p.currency)}{p.feeMinor ? <span className="block text-xs text-muted">fee {money(p.feeMinor, p.currency)}</span> : null}</td><td><StatusBadge status={p.status} />{p.failureReason && <span className="block text-xs text-bad">{p.failureReason}</span>}</td><td>{p.verifiedAt ? dt(p.verifiedAt, b.timezone) : "—"}</td><td className="text-xs">{p.refunds.map((r) => <div key={r.id}>{money(r.amountMinor, r.currency)} · {r.status.toLowerCase()}<span className="text-muted"> — {r.reason}</span></div>)}</td>
                <td>{canFinance && p.status === "INITIATED" && <Act action={reverifyPaymentAction} fields={{ reference: p.reference }} label="Re-verify" />}</td></tr>
            ))}</Table>
          </Card>
          {canFinance && <Card title="Ledger entries (immutable)">
            {ledger.length === 0 ? <p className="text-sm text-muted">No financial movements.</p> : <Table head={["When", "Type", "Account", "Debit", "Credit"]}>{ledger.flatMap((t) => t.entries.map((e, i) => (
              <tr key={e.id}><td>{i === 0 ? dt(t.createdAt, b.timezone) : ""}</td><td>{i === 0 ? t.type.toLowerCase().replace(/_/g, " ") : ""}</td><td className="font-mono text-xs">{e.account.code.replace(b.providerId, "…")}</td><td className="tabular">{e.amountMinor > 0 ? money(e.amountMinor, e.currency) : ""}</td><td className="tabular">{e.amountMinor < 0 ? money(-e.amountMinor, e.currency) : ""}</td></tr>
            )))}</Table>}
          </Card>}
          <Card title="Status history"><ol className="space-y-1 text-sm">{b.history.map((h) => <li key={h.id}><span className="text-xs text-muted">{dt(h.createdAt, b.timezone)}</span> — {h.fromStatus ? `${h.fromStatus} → ` : ""}{h.toStatus}{h.note && <span className="text-muted"> ({h.note})</span>}</li>)}</ol></Card>
        </div>
        <aside className="space-y-6">
          {canManage && ["AWAITING_APPROVAL", "PENDING_PAYMENT", "CONFIRMED"].includes(b.status) && <Card title="Cancel booking"><QuickForm action={adminCancelBookingAction} hidden={{ ref }} columns={1} submit="Cancel and refund in full" confirm="Cancel this booking? Paid bookings are fully refunded." fields={[{ name: "reason", label: "Reason (sent to both parties)", type: "textarea", required: true }]} /></Card>}
          {canRefund && paid && refundable > 0 && <Card title="Issue refund / resolve dispute"><QuickForm action={adminRefundAction} hidden={{ paymentId: paid.id }} columns={1} submit="Issue refund" confirm="Issue this refund? This cannot be undone." fields={[{ name: "amount", label: `Amount (max ${toMajorString(refundable, cur.minorUnits)} ${b.currency})`, defaultValue: toMajorString(refundable, cur.minorUnits), required: true }, { name: "reason", label: "Reason", type: "textarea", required: true }]} /><p className="mt-2 text-xs text-muted">The provider&apos;s share is deducted proportionally; the platform&apos;s commission share is reversed.</p></Card>}
          {b.tickets.length > 0 && <Card title="Support tickets"><ul className="space-y-1 text-sm">{b.tickets.map((t) => <li key={t.id}><Link className="text-brand" href={`/admin/support/${t.id}`}>{t.reference}</Link> · {t.subject} <StatusBadge status={t.status} /></li>)}</ul></Card>}
        </aside>
      </div>
    </>
  );
}
