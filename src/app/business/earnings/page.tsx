import { pageProvider } from "@/server/auth/guards";
import { db } from "@/server/db";
import { providerBalances } from "@/server/modules/ledger";
import { providerFinancials } from "@/server/modules/reports";
import { QuickForm } from "@/components/ui/act";
import { payoutRequestAction } from "@/app/actions/business";
import { PayoutMethods } from "@/components/business/sections";
import { money } from "@/lib/format";
import { toMajorString } from "@/server/money";
import { Card, Empty, PageHeader, Stat, StatusBadge, Table } from "@/components/ui";

export default async function Earnings() {
  const { provider: p } = await pageProvider("/business/earnings");
  const [balances, fin, payouts, methods, country, ledger] = await Promise.all([
    providerBalances(p.id), providerFinancials(p.id),
    db.payout.findMany({ where: { providerId: p.id }, orderBy: { requestedAt: "desc" }, take: 50, include: { method: true } }),
    db.payoutMethod.findMany({ where: { providerId: p.id } }),
    db.country.findUniqueOrThrow({ where: { id: p.countryId }, include: { currency: true } }),
    db.ledgerEntry.findMany({ where: { account: { providerId: p.id, code: { contains: ":available:" } } }, orderBy: { createdAt: "desc" }, take: 30, include: { transaction: true } }),
  ]);
  const currencies = [...new Set([...Object.keys(balances), country.currencyCode])];
  return (
    <>
      <PageHeader title="Earnings & payouts" description="Every figure comes from your booking and ledger records." />
      {currencies.map((cur) => {
        const b = balances[cur] ?? { pending: 0, available: 0, reserved: 0 };
        const f = fin.bookings.find((x) => x.currency === cur)?._sum;
        const refunds = fin.refunds.find((r) => r.currency === cur)?.amountMinor ?? 0;
        const paid = fin.paidOut.find((x) => x.currency === cur)?._sum.amountMinor ?? 0;
        return (
          <div key={cur} className="mb-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Gross booking revenue" value={money((f?.subtotalMinor ?? 0) + (f?.travelFeeMinor ?? 0), cur)} />
              <Stat label="Platform commission" value={money(f?.commissionMinor ?? 0, cur)} />
              <Stat label="Refunds (your share)" value={money(refunds, cur)} />
              <Stat label="Pending settlement" value={money(b.pending, cur)} sub="Released after completion" />
              <Stat label="Available to withdraw" value={money(b.available, cur)} />
              <Stat label="Withdrawn" value={money(paid, cur)} sub={b.reserved ? `${money(b.reserved, cur)} in progress` : undefined} />
            </div>
          </div>
        );
      })}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Request a withdrawal">
          {methods.length === 0 ? <p className="text-sm text-muted">Add a payout method below first.</p> : (
            <QuickForm action={payoutRequestAction} resetOnSuccess submit="Request withdrawal" hidden={{ currency: country.currencyCode }} fields={[
              { name: "amount", label: `Amount (${country.currency.symbol})`, required: true, hint: `Available: ${money(balances[country.currencyCode]?.available ?? 0, country.currency)} · Minimum ${toMajorString(country.minPayoutMinor, country.currency.minorUnits)}` },
              { name: "methodId", label: "Send to", type: "select", options: methods.map((m) => [m.id, `${m.institution} ••••${m.accountNumberLast4}`]) },
            ]} />
          )}
        </Card>
        <Card title="Payout methods"><PayoutMethods methods={methods} channels={country.payoutChannels} /></Card>
      </div>
      <h2 className="mb-3 mt-8 font-semibold">Payout history</h2>
      <Table head={["Reference", "Requested", "Amount", "To", "Status", "Notes"]} empty="No withdrawals yet">
        {payouts.map((x) => <tr key={x.id}><td className="font-mono text-xs">{x.reference}</td><td>{x.requestedAt.toLocaleDateString("en-GB")}</td><td className="tabular">{money(x.amountMinor, x.currency)}</td><td>{x.method.institution} ••••{x.method.accountNumberLast4}</td><td><StatusBadge status={x.status} /></td><td className="text-xs text-muted">{x.failureReason ?? x.externalRef ?? ""}</td></tr>)}
      </Table>
      <h2 className="mb-3 mt-8 font-semibold">Available balance activity</h2>
      {ledger.length === 0 ? <Empty title="No settled earnings yet" /> : (
        <Table head={["Date", "Type", "Amount"]}>{ledger.map((e) => <tr key={e.id}><td>{e.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td><td>{e.transaction.type.toLowerCase().replace(/_/g, " ")}</td><td className={`tabular ${e.amountMinor < 0 ? "text-ok" : "text-bad"}`}>{e.amountMinor < 0 ? "+" : "−"}{money(Math.abs(e.amountMinor), e.currency)}</td></tr>)}</Table>
      )}
    </>
  );
}
