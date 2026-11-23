import Link from "next/link";
import type { PayoutStatus } from "@prisma/client";
import { pageAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { Act } from "@/components/ui/act";
import { payoutDecisionAction } from "@/app/actions/admin";
import { RevealAccount } from "@/components/admin/reveal";
import { money } from "@/lib/format";
import { PageHeader, StatusBadge, Table } from "@/components/ui";
import { cn } from "@/lib/cn";

export default async function Payouts({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await pageAdmin("finance.payouts");
  const sp = await searchParams;
  const status = sp.status ?? "REQUESTED";
  const rows = await db.payout.findMany({ where: status === "ALL" ? {} : { status: status as PayoutStatus }, orderBy: { requestedAt: "asc" }, take: 100, include: { provider: true, method: true } });
  return (
    <>
      <PageHeader title="Payouts" description="Approve requests, send the transfer through your payout provider, then record its reference." />
      <div className="mb-4 flex gap-1 border-b border-line">{["REQUESTED", "APPROVED", "PAID", "FAILED", "REJECTED", "ALL"].map((s) => <Link key={s} href={`?status=${s}`} className={cn("-mb-px border-b-2 px-3 py-2 text-sm", status === s ? "border-brand font-medium text-brand" : "border-transparent text-muted")}>{s.charAt(0) + s.slice(1).toLowerCase()}</Link>)}</div>
      <Table head={["Reference", "Provider", "Amount", "Destination", "Requested", "Status", "Actions"]} empty="No payouts in this state">
        {rows.map((p) => (
          <tr key={p.id} className="align-top">
            <td className="font-mono text-xs">{p.reference}</td>
            <td><Link className="text-brand" href={`/admin/providers/${p.providerId}`}>{p.provider.businessName}</Link></td>
            <td className="tabular font-medium">{money(p.amountMinor, p.currency)}</td>
            <td className="text-xs">{p.method.type === "MOBILE_MONEY" ? "MoMo" : "Bank"} · {p.method.institution}<br />{p.method.accountName} ••••{p.method.accountNumberLast4}{["APPROVED", "PROCESSING"].includes(p.status) && <RevealAccount payoutId={p.id} />}</td>
            <td>{p.requestedAt.toLocaleDateString("en-GB")}</td>
            <td><StatusBadge status={p.status} />{p.failureReason && <p className="text-xs text-bad">{p.failureReason}</p>}{p.externalRef && <p className="text-xs text-muted">{p.externalRef}</p>}</td>
            <td className="space-y-2">
              {p.status === "REQUESTED" && <><Act action={payoutDecisionAction} fields={{ payoutId: p.id, op: "approve" }} label="Approve" variant="primary" /><Act action={payoutDecisionAction} fields={{ payoutId: p.id, op: "reject" }} label="Reject" variant="danger" reason="Reason" reasonName="detail" /></>}
              {["APPROVED", "PROCESSING"].includes(p.status) && <><PaidForm id={p.id} /><Act action={payoutDecisionAction} fields={{ payoutId: p.id, op: "failed" }} label="Mark failed" variant="danger" reason="Failure reason" reasonName="detail" /></>}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function PaidForm({ id }: { id: string }) {
  return <Act action={payoutDecisionAction} fields={{ payoutId: id, op: "paid" }} label="Mark paid" variant="primary" reason="Transfer reference" reasonName="detail" />;
}
