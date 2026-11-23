import Link from "next/link";
import { pageProvider } from "@/server/auth/guards";
import { db } from "@/server/db";
import { providerOverview, dailyBookings } from "@/server/modules/reports";
import { providerBalances } from "@/server/modules/ledger";
import { applicationChecklist } from "@/server/modules/providers";
import { BarChart } from "@/components/chart";
import { dt, money } from "@/lib/format";
import { Card, Empty, Notice, PageHeader, Stat, StatusBadge, btn } from "@/components/ui";

export default async function BusinessHome({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const { provider: p } = await pageProvider("/business");
  const sp = await searchParams;
  const [o, balances, upcoming, requests, checklist, series] = await Promise.all([
    providerOverview(p.id), providerBalances(p.id),
    db.booking.findMany({ where: { providerId: p.id, status: { in: ["CONFIRMED", "IN_PROGRESS"] }, startsAt: { gte: new Date(Date.now() - 2 * 3600_000) } }, orderBy: { startsAt: "asc" }, take: 6, include: { items: true, customer: { select: { name: true } } } }),
    db.booking.count({ where: { providerId: p.id, status: "AWAITING_APPROVAL" } }),
    applicationChecklist(p.id),
    dailyBookings({ from: new Date(Date.now() - 30 * 864e5), to: new Date() }, p.id),
  ]);
  const cur = Object.keys(balances)[0];
  const bal = cur ? balances[cur] : null;
  const statusMsg: Record<string, [string, "warn" | "bad" | "brand" | "ok"]> = {
    DRAFT: ["Your profile isn't live yet. Finish your application so customers can book you.", "warn"],
    SUBMITTED: ["Application submitted — our team will review it shortly.", "brand"],
    UNDER_REVIEW: ["Your application is being reviewed.", "brand"],
    INFO_REQUESTED: [`We need more information: ${p.statusReason}`, "warn"],
    REJECTED: [`Your application was not approved: ${p.statusReason}. Update it and resubmit.`, "bad"],
    SUSPENDED: [`Your account is suspended: ${p.statusReason}. Contact support.`, "bad"],
  };
  return (
    <>
      <PageHeader title="Overview" description={p.status === "APPROVED" ? <>Your public profile: <Link className="text-brand" href={`/provider/${p.slug}`}>/provider/{p.slug}</Link></> : undefined} actions={<StatusBadge status={p.status} />} />
      {sp.submitted && <div className="mb-4"><Notice tone="ok">Application submitted. We&apos;ll notify you once it&apos;s reviewed.</Notice></div>}
      {statusMsg[p.status] && (
        <div className="mb-6 space-y-3"><Notice tone={statusMsg[p.status][1]}>{statusMsg[p.status][0]}</Notice>
          {["DRAFT", "INFO_REQUESTED", "REJECTED"].includes(p.status) && <Card title="Application checklist" action={<Link href="/business/onboarding" className={btn({ size: "sm" })}>Continue</Link>}><ul className="grid gap-2 text-sm sm:grid-cols-2">{checklist.map((c) => <li key={c.key} className={c.done ? "text-ok" : "text-muted"}>{c.done ? "✓" : "○"} {c.label}</li>)}</ul></Card>}
        </div>
      )}
      {requests > 0 && <div className="mb-6"><Notice tone="warn">{requests} booking request{requests > 1 ? "s" : ""} waiting for your response. <Link href="/business/bookings?status=AWAITING_APPROVAL" className="underline">Review now</Link></Notice></div>}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Upcoming bookings" value={o.upcoming} />
        <Stat label="Completed" value={o.completed} sub={`${o.total} total · ${o.cancelled} cancelled`} />
        <Stat label="Available balance" value={bal ? money(bal.available, cur) : "—"} sub={bal ? `${money(bal.pending, cur)} pending` : undefined} />
        <Stat label="Average rating" value={o.ratingCount ? o.ratingAvg.toFixed(1) : "—"} sub={`${o.ratingCount} reviews`} />
        <Stat label="Profile views (30 days)" value={o.views30} sub={o.conversion30 != null ? `${o.conversion30}% booked` : "No views yet"} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card><BarChart title="Bookings received per day (last 30 days)" data={series.map((s) => ({ label: s.day.slice(5), value: s.bookings }))} /></Card>
        <Card title="Next appointments" action={<Link href="/business/calendar" className="text-sm text-brand">Calendar</Link>}>
          {upcoming.length === 0 ? <Empty title="Nothing scheduled" /> : (
            <ul className="space-y-3 text-sm">{upcoming.map((b) => <li key={b.id}><Link href={`/business/bookings/${b.reference}`} className="block hover:text-brand"><span className="font-medium">{dt(b.startsAt, b.timezone)}</span><span className="block text-muted">{b.customer.name} · {b.items.map((i) => i.nameSnapshot).join(", ")}</span></Link></li>)}</ul>
          )}
        </Card>
      </div>
      <p className="mt-6 text-xs text-muted">{o.customers} customers · {o.repeatCustomers} repeat · {o.noShow} no-shows. All figures are calculated from your booking records.</p>
    </>
  );
}
