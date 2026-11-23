import { notFound } from "next/navigation";
import { pageProvider } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getConversation } from "@/server/modules/messaging";
import { dt, money } from "@/lib/format";
import { Act } from "@/components/ui/act";
import { providerBookingAction } from "@/app/actions/business";
import { Messages } from "@/components/booking/messages";
import { Reschedule } from "@/components/booking/reschedule";
import { Card, Notice, PageHeader, StatusBadge } from "@/components/ui";

export default async function ProviderBooking({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const { user, provider } = await pageProvider(`/business/bookings/${ref}`);
  const b = await db.booking.findUnique({ where: { reference: ref }, include: { items: true, customer: true, staff: true, history: { orderBy: { createdAt: "asc" } } } });
  if (!b || b.providerId !== provider.id) notFound();
  const { messages } = await getConversation(ref, user.id);
  const now = Date.now();
  const f = { ref };
  return (
    <>
      <PageHeader title={b.items.map((i) => i.nameSnapshot).join(", ")} description={`Booking ${b.reference}`} actions={<StatusBadge status={b.status} />} />
      {b.rescheduleNote && <div className="mb-4"><Notice tone="warn">Reschedule request — {b.rescheduleNote}</Notice></div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Appointment">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">When</dt><dd className="font-medium">{dt(b.startsAt, b.timezone)} – {dt(b.endsAt, b.timezone, "time")}</dd></div>
              <div><dt className="text-muted">Team member</dt><dd className="font-medium">{b.staff.name}</dd></div>
              <div><dt className="text-muted">Customer</dt><dd className="font-medium">{b.customer.name}</dd></div>
              {["CONFIRMED", "IN_PROGRESS"].includes(b.status) && b.customer.phone && <div><dt className="text-muted">Phone</dt><dd className="font-medium">{b.customer.phone}</dd></div>}
              <div className="sm:col-span-2"><dt className="text-muted">Location</dt><dd className="font-medium">{b.locationType === "HOME" ? (["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(b.status) ? `Customer's home: ${b.homeAddress}` : "Customer's home (address shown once confirmed)") : "Your studio"}</dd></div>
              {b.customerNote && <div className="sm:col-span-2"><dt className="text-muted">Customer note</dt><dd>{b.customerNote}</dd></div>}
            </dl>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
              {b.status === "AWAITING_APPROVAL" && <><Act action={providerBookingAction} fields={{ ...f, op: "accept" }} label="Accept request" variant="primary" size="md" /><Act action={providerBookingAction} fields={{ ...f, op: "reject" }} label="Decline" variant="danger" size="md" reason="Reason for the customer" /></>}
              {b.status === "CONFIRMED" && b.startsAt.getTime() - now < 3600_000 && <Act action={providerBookingAction} fields={{ ...f, op: "start" }} label="Start appointment" variant="primary" size="md" />}
              {["CONFIRMED", "IN_PROGRESS"].includes(b.status) && b.startsAt.getTime() < now && <Act action={providerBookingAction} fields={{ ...f, op: "complete" }} label="Mark completed" variant="primary" size="md" />}
              {b.status === "CONFIRMED" && b.startsAt.getTime() + 15 * 60_000 < now && <Act action={providerBookingAction} fields={{ ...f, op: "noshow" }} label="Customer didn't show" size="md" confirm="Mark as no-show?" />}
              {["CONFIRMED", "PENDING_PAYMENT"].includes(b.status) && <Act action={providerBookingAction} fields={{ ...f, op: "cancel" }} label="Cancel booking" variant="danger" size="md" confirm="Cancel this booking? The customer will be fully refunded." reason="Reason for the customer" />}
            </div>
          </Card>
          <Card title="Messages"><Messages bookingRef={ref} me={user.id} messages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))} /></Card>
          {["CONFIRMED", "AWAITING_APPROVAL", "PENDING_PAYMENT"].includes(b.status) && <Card title="Reschedule"><Reschedule bookingRef={ref} providerId={provider.id} serviceIds={b.items.map((i) => i.serviceId)} timezone={b.timezone} as="provider" /></Card>}
        </div>
        <aside className="space-y-6">
          <Card title="Earnings for this booking">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt>Services</dt><dd className="tabular">{money(b.subtotalMinor, b.currency)}</dd></div>
              {b.travelFeeMinor > 0 && <div className="flex justify-between"><dt>Travel fee</dt><dd className="tabular">{money(b.travelFeeMinor, b.currency)}</dd></div>}
              <div className="flex justify-between text-muted"><dt>Platform commission ({(b.commissionRateBps / 100).toFixed(2)}%)</dt><dd className="tabular">−{money(b.commissionMinor, b.currency)}</dd></div>
              {b.discountFundedBy === "PROVIDER" && <div className="flex justify-between text-muted"><dt>Your discount</dt><dd className="tabular">−{money(b.discountMinor, b.currency)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>You earn</dt><dd className="tabular">{money(b.providerNetMinor, b.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Payment</dt><dd><StatusBadge status={b.paymentStatus} /></dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted">{b.settledAt ? "Settled to your available balance." : "Becomes withdrawable after the appointment is completed and the settlement period passes."}</p>
          </Card>
          <Card title="Timeline"><ol className="space-y-2 text-sm">{b.history.map((h) => <li key={h.id} className="flex justify-between gap-2"><span>{h.toStatus.toLowerCase().replace(/_/g, " ")}{h.note && <span className="block text-xs text-muted">{h.note}</span>}</span><span className="text-xs text-muted">{dt(h.createdAt, b.timezone)}</span></li>)}</ol></Card>
        </aside>
      </div>
    </>
  );
}
