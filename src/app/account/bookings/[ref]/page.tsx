import Link from "next/link";
import { notFound } from "next/navigation";
import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getConversation } from "@/server/modules/messaging";
import { dt, money } from "@/lib/format";
import { Act } from "@/components/ui/act";
import { customerCancelAction, payAction } from "@/app/actions/booking";
import { Messages } from "@/components/booking/messages";
import { Reschedule } from "@/components/booking/reschedule";
import { ReviewForm } from "@/components/booking/review-form";
import { Card, Notice, PageHeader, Stars, StatusBadge, btn } from "@/components/ui";

export default async function BookingDetail({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ paid?: string }> }) {
  const { ref } = await params;
  const user = await pageUser(`/account/bookings/${ref}`);
  const b = await db.booking.findUnique({ where: { reference: ref }, include: { items: true, provider: true, payments: { include: { refunds: true }, orderBy: { createdAt: "desc" } }, review: true, history: { orderBy: { createdAt: "asc" } } } });
  if (!b || b.customerId !== user.id) notFound(); // never reveal other customers' bookings
  const { messages } = await getConversation(ref, user.id);
  const sp = await searchParams;
  const active = ["AWAITING_APPROVAL", "PENDING_PAYMENT", "CONFIRMED"].includes(b.status);
  const canPay = b.status === "PENDING_PAYMENT" && (!b.holdExpiresAt || b.holdExpiresAt > new Date());
  const revealAddress = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(b.status);
  const hoursBefore = (b.startsAt.getTime() - Date.now()) / 3600_000;
  const refundable = b.paymentStatus === "PAID" && hoursBefore >= b.provider.freeCancelHours;

  return (
    <>
      <PageHeader title={b.items.map((i) => i.nameSnapshot).join(", ")} description={<>Booking {b.reference} · <Link className="text-brand" href={`/provider/${b.provider.slug}`}>{b.providerNameSnapshot}</Link></>} actions={<StatusBadge status={b.status} />} />
      {sp.paid && b.status === "CONFIRMED" && <div className="mb-6"><Notice tone="ok">Payment received — your appointment is confirmed.</Notice></div>}
      {b.status === "AWAITING_APPROVAL" && <div className="mb-6"><Notice>Waiting for {b.providerNameSnapshot} to accept. You haven&apos;t been charged. Request expires {b.holdExpiresAt && dt(b.holdExpiresAt, b.timezone)}.</Notice></div>}
      {canPay && <div className="mb-6 flex flex-wrap items-center gap-3"><Notice tone="warn">Complete payment by {b.holdExpiresAt && dt(b.holdExpiresAt, b.timezone, "time")} to keep this slot.</Notice><Act action={payAction} fields={{ ref }} label="Pay now" variant="primary" size="md" /></div>}
      {b.status === "EXPIRED" && <div className="mb-6"><Notice tone="bad">This reservation expired before payment. <Link href={`/book/${b.provider.slug}`} className="underline">Book a new time</Link>.</Notice></div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card title="Appointment">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">When</dt><dd className="font-medium">{dt(b.startsAt, b.timezone)} – {dt(b.endsAt, b.timezone, "time")}</dd></div>
              <div><dt className="text-muted">Where</dt><dd className="font-medium">{b.locationType === "HOME" ? `Your address: ${b.homeAddress}` : revealAddress ? b.provider.studioAddress ?? `${b.cityName ?? ""} studio` : "Studio address shared once confirmed"}</dd></div>
              {revealAddress && b.provider.contactPhone && <div><dt className="text-muted">Contact</dt><dd className="font-medium">{b.provider.contactPhone}</dd></div>}
              {b.customerNote && <div className="sm:col-span-2"><dt className="text-muted">Your note</dt><dd>{b.customerNote}</dd></div>}
              {b.rescheduleNote && <div className="sm:col-span-2"><dt className="text-muted">Reschedule request</dt><dd>{b.rescheduleNote}</dd></div>}
              {b.cancellationReason && <div className="sm:col-span-2"><dt className="text-muted">Reason</dt><dd>{b.cancellationReason}</dd></div>}
            </dl>
          </Card>
          <Card title="Messages"><Messages bookingRef={ref} me={user.id} messages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))} /></Card>
          {b.status === "COMPLETED" && (
            <Card title="Your review">{b.review ? <div><Stars value={b.review.rating} /><p className="mt-2 text-sm">{b.review.comment}</p>{b.review.providerResponse && <p className="mt-2 text-sm text-muted">Response: {b.review.providerResponse}</p>}</div> : <ReviewForm bookingRef={ref} />}</Card>
          )}
          {active && (
            <Card title="Change or cancel">
              <div className="grid gap-8 md:grid-cols-2">
                <Reschedule bookingRef={ref} providerId={b.providerId} serviceIds={b.items.map((i) => i.serviceId)} timezone={b.timezone} as="customer" />
                <div>
                  <p className="text-sm">{b.paymentStatus === "PAID" ? (refundable ? "You'll receive a full refund." : `Cancellations within ${b.provider.freeCancelHours} hours of the appointment are not automatically refunded.`) : "You haven't been charged."}</p>
                  <div className="mt-3"><Act action={customerCancelAction} fields={{ ref }} label="Cancel booking" variant="danger" confirm="Cancel this booking?" reason="Reason (optional)" /></div>
                </div>
              </div>
            </Card>
          )}
        </div>
        <aside className="space-y-6">
          <Card title="Payment">
            <dl className="space-y-2 text-sm">
              {b.items.map((i) => <div key={i.id} className="flex justify-between"><dt>{i.nameSnapshot}</dt><dd className="tabular">{money(i.unitPriceMinor, b.currency)}</dd></div>)}
              {b.travelFeeMinor > 0 && <div className="flex justify-between"><dt>Travel fee</dt><dd className="tabular">{money(b.travelFeeMinor, b.currency)}</dd></div>}
              {b.discountMinor > 0 && <div className="flex justify-between text-ok"><dt>Discount</dt><dd className="tabular">−{money(b.discountMinor, b.currency)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Total</dt><dd className="tabular">{money(b.totalMinor, b.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Status</dt><dd><StatusBadge status={b.paymentStatus} /></dd></div>
            </dl>
            {b.payments.filter((p) => p.status === "SUCCEEDED").map((p) => (
              <div key={p.id} className="mt-3 border-t border-line pt-3 text-xs text-muted">
                <p>Ref {p.reference} · {p.channel ?? p.gateway}</p>
                {p.refunds.map((r) => <p key={r.id}>Refund {money(r.amountMinor, r.currency)} · {r.status.toLowerCase()}</p>)}
              </div>
            ))}
            {["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(b.paymentStatus) && <Link href={`/account/bookings/${ref}/receipt`} className={btn({ variant: "secondary", size: "sm", className: "mt-4" })}>Download receipt</Link>}
          </Card>
          <Card title="Timeline">
            <ol className="space-y-2 text-sm">{b.history.map((h) => <li key={h.id} className="flex justify-between gap-2"><span>{h.toStatus.toLowerCase().replace(/_/g, " ")}{h.note && <span className="block text-xs text-muted">{h.note}</span>}</span><span className="shrink-0 text-xs text-muted">{dt(h.createdAt, b.timezone)}</span></li>)}</ol>
          </Card>
          <p className="text-sm text-muted">Problem with this booking? <Link className="text-brand" href={`/account/support/new?booking=${ref}`}>Contact support</Link></p>
        </aside>
      </div>
    </>
  );
}
