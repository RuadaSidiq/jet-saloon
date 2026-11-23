import { notFound } from "next/navigation";
import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { dt, money } from "@/lib/format";
import { PrintButton } from "@/components/ui/print";

export default async function Receipt({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const user = await pageUser(`/account/bookings/${ref}/receipt`);
  const b = await db.booking.findUnique({ where: { reference: ref }, include: { items: true, payments: { where: { status: "SUCCEEDED" }, include: { refunds: true } } } });
  if (!b || b.customerId !== user.id || !b.payments.length) notFound();
  const p = b.payments[0];
  return (
    <div className="mx-auto max-w-xl rounded-(--radius-card) border border-line bg-white p-8 print:border-0">
      <div className="flex items-start justify-between"><div><p className="text-lg font-semibold">Jet Saloon</p><p className="text-sm text-muted">Payment receipt</p></div><PrintButton /></div>
      <dl className="mt-6 grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-muted">Receipt for</dt><dd>{user.name}</dd>
        <dt className="text-muted">Booking</dt><dd>{b.reference}</dd>
        <dt className="text-muted">Professional</dt><dd>{b.providerNameSnapshot}</dd>
        <dt className="text-muted">Appointment</dt><dd>{dt(b.startsAt, b.timezone)}</dd>
        <dt className="text-muted">Paid on</dt><dd>{p.verifiedAt && dt(p.verifiedAt, b.timezone)}</dd>
        <dt className="text-muted">Transaction ref</dt><dd>{p.reference}</dd>
        <dt className="text-muted">Method</dt><dd>{p.channel ?? p.gateway}</dd>
      </dl>
      <table className="mt-6 w-full text-sm"><tbody className="divide-y divide-line">
        {b.items.map((i) => <tr key={i.id}><td className="py-2">{i.nameSnapshot}</td><td className="tabular text-right">{money(i.unitPriceMinor, b.currency)}</td></tr>)}
        {b.travelFeeMinor > 0 && <tr><td className="py-2">Travel fee</td><td className="tabular text-right">{money(b.travelFeeMinor, b.currency)}</td></tr>}
        {b.discountMinor > 0 && <tr><td className="py-2">Discount</td><td className="tabular text-right">−{money(b.discountMinor, b.currency)}</td></tr>}
        <tr className="font-semibold"><td className="py-2">Total paid ({b.currency})</td><td className="tabular text-right">{money(p.amountMinor, p.currency)}</td></tr>
        {p.refunds.filter((r) => r.status !== "FAILED").map((r) => <tr key={r.id} className="text-muted"><td className="py-2">Refund ({r.status.toLowerCase()})</td><td className="tabular text-right">−{money(r.amountMinor, r.currency)}</td></tr>)}
      </tbody></table>
    </div>
  );
}
