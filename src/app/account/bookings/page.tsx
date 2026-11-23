import Link from "next/link";
import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { BookingRow } from "@/components/account/booking-row";
import { Empty, PageHeader, Pagination } from "@/components/ui";
import { cn } from "@/lib/cn";

const TABS = { upcoming: "Upcoming", past: "Past", cancelled: "Cancelled" } as const;

export default async function MyBookings({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const user = await pageUser("/account/bookings");
  const sp = await searchParams;
  const tab = (sp.tab ?? "upcoming") as keyof typeof TABS;
  const page = Math.max(1, Number(sp.page ?? 1));
  const now = new Date();
  const where = tab === "cancelled" ? { status: { in: ["CANCELLED", "REJECTED", "EXPIRED"] as never } }
    : tab === "past" ? { OR: [{ status: { in: ["COMPLETED", "NO_SHOW"] as never } }, { startsAt: { lt: now }, status: "CONFIRMED" as const }] }
    : { startsAt: { gte: now }, status: { in: ["CONFIRMED", "AWAITING_APPROVAL", "PENDING_PAYMENT", "IN_PROGRESS"] as never } };
  const [total, rows] = await Promise.all([
    db.booking.count({ where: { customerId: user.id, ...where } }),
    db.booking.findMany({ where: { customerId: user.id, ...where }, orderBy: { startsAt: tab === "upcoming" ? "asc" : "desc" }, skip: (page - 1) * 20, take: 20, include: { items: true } }),
  ]);
  return (
    <>
      <PageHeader title="My bookings" />
      <div className="mb-4 flex gap-1 border-b border-line">{Object.entries(TABS).map(([k, l]) => <Link key={k} href={`?tab=${k}`} className={cn("-mb-px border-b-2 px-4 py-2 text-sm", tab === k ? "border-brand font-medium text-brand" : "border-transparent text-muted")}>{l}</Link>)}</div>
      {rows.length ? <ul className="space-y-2">{rows.map((b) => <BookingRow key={b.id} b={b} href={`/account/bookings/${b.reference}`} />)}</ul> : <Empty title={`No ${TABS[tab].toLowerCase()} bookings`} />}
      <Pagination page={page} pages={Math.ceil(total / 20)} href={(p) => `?tab=${tab}&page=${p}`} />
    </>
  );
}
