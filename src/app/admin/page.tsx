import Link from "next/link";
import { pageUser, hasPermission } from "@/server/auth/guards";
import { adminOverview, dailyBookings, rangeFromPreset } from "@/server/modules/reports";
import { DateFilter } from "@/components/admin/filters";
import { BarChart } from "@/components/chart";
import { money } from "@/lib/format";
import { Card, Notice, PageHeader, Stat } from "@/components/ui";

type M = { currency: string; amountMinor: number }[];
const Multi = ({ rows }: { rows: M }) => rows.length ? <>{rows.map((r) => <span key={r.currency} className="block">{money(r.amountMinor, r.currency)}</span>)}</> : <>—</>;

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string; denied?: string }> }) {
  const user = await pageUser("/admin");
  const sp = await searchParams;
  if (!(await hasPermission(user.id, "dashboard.view"))) {
    return <><PageHeader title="Welcome" /><Notice>Use the menu to access the areas assigned to your role.</Notice></>;
  }
  const range = rangeFromPreset(sp.range, sp.from, sp.to);
  const [o, series] = await Promise.all([adminOverview(range), dailyBookings(range)]);
  return (
    <>
      <PageHeader title="Dashboard" description={`${range.from.toLocaleDateString("en-GB")} – ${range.to.toLocaleDateString("en-GB")}`} actions={<DateFilter current={sp.range} from={sp.from} to={sp.to} />} />
      {sp.denied && <div className="mb-4"><Notice tone="warn">You don&apos;t have permission for that area ({sp.denied}).</Notice></div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Stat label="Customers" value={o.customers} sub={`+${o.newCustomers} in period${o.customerGrowthPct != null ? ` (${o.customerGrowthPct >= 0 ? "+" : ""}${o.customerGrowthPct}% vs prior)` : ""}`} />
        <Stat label="Providers" value={o.providers.total} sub={`${o.providers.approved} approved · ${o.providers.suspended} suspended`} />
        <Stat label="Pending applications" value={<Link href="/admin/providers?status=SUBMITTED" className="hover:text-brand">{o.providers.pending}</Link>} />
        <Stat label="Bookings (period)" value={o.bookings.total} sub={`${o.bookings.completed} completed · ${o.bookings.cancelled} cancelled`} />
        <Stat label="Gross booking value" value={<Multi rows={o.gbv} />} sub="Paid bookings, by currency" />
        <Stat label="Commission revenue" value={<Multi rows={o.commission} />} sub="Net of refunds, from ledger" />
        <Stat label="Refunds" value={<Multi rows={o.refunds} />} />
        <Stat label="Pending payouts" value={<Multi rows={o.pendingPayouts} />} sub={o.pendingPayouts.length ? `${o.pendingPayouts.reduce((s, r) => s + r.count, 0)} requests` : undefined} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><BarChart title="Bookings created per day" data={series.map((s) => ({ label: s.day.slice(5), value: s.bookings }))} /></Card>
        <Card><BarChart title="Of which completed" data={series.map((s) => ({ label: s.day.slice(5), value: s.completed }))} /></Card>
      </div>
      <p className="mt-4 text-xs text-muted">Gross booking value is customer spend and is not platform revenue. Amounts in different currencies are never combined.</p>
    </>
  );
}
