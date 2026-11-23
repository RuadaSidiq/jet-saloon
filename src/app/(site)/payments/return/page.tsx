import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { confirmPayment } from "@/server/modules/payments/service";
import { pageUser } from "@/server/auth/guards";
import { Notice, btn } from "@/components/ui";

/** Customers land here after the gateway. We verify server-side; the query string itself is never trusted. */
export default async function PaymentReturn({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string; tx_ref?: string }> }) {
  const sp = await searchParams;
  const ref = sp.reference ?? sp.trxref ?? sp.tx_ref ?? "";
  const user = await pageUser(`/payments/return?reference=${ref}`);
  const payment = await db.payment.findUnique({ where: { reference: ref }, include: { booking: true } });
  if (!payment || payment.booking.customerId !== user.id) return <div className="mx-auto max-w-lg px-4 py-16"><Notice tone="bad">We couldn&apos;t find that payment.</Notice></div>;
  let result: string;
  try { result = await confirmPayment(ref); } catch { result = "error"; }
  if (result === "succeeded" || result === "already") redirect(`/account/bookings/${payment.booking.reference}?paid=1`);
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-16">
      {result === "pending" ? <Notice tone="warn">Your payment is still being processed. This page will update once the payment provider confirms it — you can also check your booking in a minute.</Notice>
        : <Notice tone="bad">Your payment was not completed. No money was taken. You can try again while your slot is held.</Notice>}
      <Link href={`/account/bookings/${payment.booking.reference}`} className={btn()}>Go to booking</Link>
    </div>
  );
}
