import Link from "next/link";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { pageProvider } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ACTIVE_BOOKING_STATUSES } from "@/server/modules/availability";
import { PageHeader, StatusBadge, btn } from "@/components/ui";

export default async function Calendar({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { provider: p } = await pageProvider("/business/calendar");
  const tz = p.timezone;
  const offset = Number((await searchParams).week ?? 0) || 0;
  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const dow = Number(formatInTimeZone(new Date(), tz, "i")) - 1; // Monday = 0
  const monday = new Date(fromZonedTime(`${today}T00:00:00`, tz).getTime() + (offset * 7 - dow) * 864e5);
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 864e5));
  const end = new Date(monday.getTime() + 7 * 864e5);
  const [bookings, timeOff] = await Promise.all([
    db.booking.findMany({ where: { providerId: p.id, startsAt: { gte: monday, lt: end }, status: { in: [...ACTIVE_BOOKING_STATUSES, "COMPLETED", "NO_SHOW"] } }, orderBy: { startsAt: "asc" }, include: { items: true, customer: { select: { name: true } }, staff: true } }),
    db.timeOff.findMany({ where: { staff: { providerId: p.id }, startsAt: { lt: end }, endsAt: { gt: monday } }, include: { staff: true } }),
  ]);
  const key = (d: Date) => formatInTimeZone(d, tz, "yyyy-MM-dd");
  return (
    <>
      <PageHeader title="Calendar" description={`Week of ${formatInTimeZone(monday, tz, "d MMM yyyy")} · ${tz.replace("_", " ")}`} actions={<>
        <Link href={`?week=${offset - 1}`} className={btn({ variant: "secondary", size: "sm" })}>← Previous</Link>
        <Link href="?week=0" className={btn({ variant: "secondary", size: "sm" })}>This week</Link>
        <Link href={`?week=${offset + 1}`} className={btn({ variant: "secondary", size: "sm" })}>Next →</Link></>} />
      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d) => {
          const k = key(d);
          const items = bookings.filter((b) => key(b.startsAt) === k);
          const off = timeOff.filter((t) => key(t.startsAt) <= k && key(new Date(t.endsAt.getTime() - 1)) >= k);
          return (
            <section key={k} className={`min-h-40 rounded-(--radius-card) border bg-white p-3 ${k === today ? "border-brand" : "border-line"}`}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{formatInTimeZone(d, tz, "EEE d MMM")}</h2>
              <ul className="mt-2 space-y-2">
                {off.map((t) => <li key={t.id} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">Time off · {t.staff.name}{t.reason && ` — ${t.reason}`}</li>)}
                {items.map((b) => (
                  <li key={b.id}><Link href={`/business/bookings/${b.reference}`} className="block rounded border border-line px-2 py-1.5 text-xs hover:border-brand-mid">
                    <span className="tabular font-semibold">{formatInTimeZone(b.startsAt, tz, "HH:mm")}–{formatInTimeZone(b.endsAt, tz, "HH:mm")}</span>
                    <span className="block truncate">{b.customer.name}</span><span className="block truncate text-muted">{b.items.map((i) => i.nameSnapshot).join(", ")}</span>
                    <span className="mt-1 block"><StatusBadge status={b.status} /></span>
                  </Link></li>
                ))}
                {!items.length && !off.length && <li className="text-xs text-muted">No bookings</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
