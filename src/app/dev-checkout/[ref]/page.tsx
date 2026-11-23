import { notFound, redirect } from "next/navigation";
import { db } from "@/server/db";
import { devGatewayEnabled, devSetOutcome, devSignWebhook } from "@/server/modules/payments/dev";
import { handleWebhook } from "@/server/modules/payments/service";
import { money } from "@/lib/format";

/** DEVELOPMENT ONLY — returns 404 in production. Simulates the gateway's hosted checkout + signed webhook. */
export default async function DevCheckout({ params }: { params: Promise<{ ref: string }> }) {
  if (!devGatewayEnabled()) notFound();
  const { ref } = await params;
  const p = await db.payment.findUnique({ where: { reference: ref }, include: { booking: true } });
  if (!p || p.gateway !== "dev") notFound();

  async function complete(fd: FormData) {
    "use server";
    if (!devGatewayEnabled()) notFound();
    const outcome = fd.get("outcome") === "success" ? "success" : "failed";
    await devSetOutcome(ref, outcome);
    const body = JSON.stringify({ event: outcome === "success" ? "charge.success" : "charge.failed", reference: ref });
    await handleWebhook("dev", body, new Headers({ "x-dev-signature": devSignWebhook(body) }));
    redirect(`/payments/return?reference=${ref}`);
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-amber-50 p-4">
      <form action={complete} className="w-full max-w-sm space-y-4 rounded-lg border-2 border-dashed border-amber-500 bg-white p-6">
        <p className="rounded bg-amber-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-800">Development test checkout — no real money</p>
        <div><p className="text-sm text-muted">Booking {p.booking.reference}</p><p className="tabular text-2xl font-semibold">{money(p.amountMinor, p.currency)}</p></div>
        <div className="grid gap-2">
          <button name="outcome" value="success" className="h-11 rounded-md bg-emerald-600 font-medium text-white">Simulate successful payment</button>
          <button name="outcome" value="failed" className="h-11 rounded-md border border-red-300 font-medium text-red-700">Simulate failed payment</button>
        </div>
      </form>
    </div>
  );
}
