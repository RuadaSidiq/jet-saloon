import Link from "next/link";
import { pageAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { allGateways } from "@/server/modules/payments/registry";
import { money } from "@/lib/format";
import { Badge, Card, PageHeader, Pagination, StatusBadge, Table } from "@/components/ui";

export default async function Ledger({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await pageAdmin("finance.view");
  const page = Math.max(1, Number((await searchParams).page ?? 1));
  const [accounts, txCount, txs, payments, webhooks, failedRefunds] = await Promise.all([
    db.$queryRaw<{ code: string; kind: string; currency: string; balance: bigint }[]>`
      SELECT a.code, a.kind, a.currency, COALESCE(SUM(e."amountMinor"), 0)::bigint AS balance FROM "LedgerAccount" a LEFT JOIN "LedgerEntry" e ON e."accountId" = a.id
      WHERE a."providerId" IS NULL GROUP BY a.id ORDER BY a.currency, a.code`,
    db.ledgerTransaction.count(),
    db.ledgerTransaction.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 40, take: 40, include: { entries: true } }),
    db.payment.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { booking: { select: { reference: true } } } }),
    db.webhookEvent.findMany({ where: { OR: [{ processedAt: null }, { error: { not: null } }] }, orderBy: { receivedAt: "desc" }, take: 10 }),
    db.refund.findMany({ where: { status: "FAILED" }, include: { payment: { include: { booking: true } } }, take: 20 }),
  ]);
  const providerLiability = await db.$queryRaw<{ currency: string; amount: bigint }[]>`SELECT e.currency, -SUM(e."amountMinor")::bigint amount FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a.id = e."accountId" WHERE a."providerId" IS NOT NULL GROUP BY 1`;
  return (
    <>
      <PageHeader title="Payments & ledger" description="Double-entry, append-only. Corrections are recorded as new reversing transactions." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Platform accounts">
          <Table head={["Account", "Type", "Balance"]}>
            {accounts.map((a) => <tr key={a.code}><td className="font-mono text-xs">{a.code}</td><td>{a.kind.toLowerCase()}</td><td className="tabular">{money(a.kind === "ASSET" || a.kind === "EXPENSE" ? Number(a.balance) : -Number(a.balance), a.currency)}</td></tr>)}
            {providerLiability.map((l) => <tr key={l.currency}><td className="font-mono text-xs">provider:*:{l.currency}</td><td>liability (owed to providers)</td><td className="tabular">{money(Number(l.amount), l.currency)}</td></tr>)}
          </Table>
          <p className="mt-2 text-xs text-muted">Reconciliation: gateway clearing should equal the funds held at your gateway(s) less payouts sent.</p>
        </Card>
        <Card title="Gateways">
          <ul className="space-y-2 text-sm">{allGateways().map((g) => <li key={g.key} className="flex items-center justify-between"><span>{g.label} <span className="text-xs text-muted">({g.currencies.join(", ")})</span></span>{g.configured ? <Badge tone="ok">Configured</Badge> : <Badge>Not configured</Badge>}</li>)}</ul>
          {webhooks.length > 0 && <div className="mt-4"><p className="text-sm font-medium text-bad">Webhooks needing attention</p><ul className="mt-1 space-y-1 text-xs">{webhooks.map((w) => <li key={w.id}>{w.gateway} · {w.eventType} · {w.receivedAt.toLocaleString("en-GB")} — {w.error ?? "unprocessed"}</li>)}</ul></div>}
          {failedRefunds.length > 0 && <div className="mt-4"><p className="text-sm font-medium text-bad">Failed refunds (manual action)</p><ul className="mt-1 space-y-1 text-xs">{failedRefunds.map((r) => <li key={r.id}><Link className="text-brand" href={`/admin/bookings/${r.payment.booking.reference}`}>{r.payment.booking.reference}</Link> · {money(r.amountMinor, r.currency)} — {r.failureReason}</li>)}</ul></div>}
        </Card>
      </div>
      <h2 className="mb-3 mt-8 font-semibold">Recent payments</h2>
      <Table head={["Reference", "Booking", "Gateway", "Amount", "Fee", "Status", "Created"]}>{payments.map((p) => <tr key={p.id}><td className="font-mono text-xs">{p.reference}</td><td><Link className="text-brand" href={`/admin/bookings/${p.booking.reference}`}>{p.booking.reference}</Link></td><td>{p.gateway}</td><td className="tabular">{money(p.amountMinor, p.currency)}</td><td className="tabular">{p.feeMinor != null ? money(p.feeMinor, p.currency) : "—"}</td><td><StatusBadge status={p.status} /></td><td>{p.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td></tr>)}</Table>
      <h2 className="mb-3 mt-8 font-semibold">Ledger transactions</h2>
      <Table head={["When", "Type", "Memo", "Amount moved", "Entries"]}>{txs.map((t) => <tr key={t.id}><td>{t.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td><td>{t.type.toLowerCase().replace(/_/g, " ")}</td><td className="text-xs">{t.memo}</td><td className="tabular">{money(t.entries.filter((e) => e.amountMinor > 0).reduce((s, e) => s + e.amountMinor, 0), t.entries[0]?.currency ?? "GHS")}</td><td className="tabular">{t.entries.length}</td></tr>)}</Table>
      <Pagination page={page} pages={Math.ceil(txCount / 40)} href={(n) => `?page=${n}`} />
    </>
  );
}
