import Link from "next/link";
import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { BookingRow } from "@/components/account/booking-row";
import { Act } from "@/components/ui/act";
import { resendVerificationAction } from "@/app/actions/auth";
import { Card, Empty, Notice, PageHeader, Stat, btn } from "@/components/ui";

export const metadata = { title: "My account" };

export default async function AccountHome() {
  const user = await pageUser("/account");
  const now = new Date();
  const [upcoming, recent, completed, pending, favs] = await Promise.all([
    db.booking.findMany({ where: { customerId: user.id, startsAt: { gte: now }, status: { in: ["CONFIRMED", "AWAITING_APPROVAL", "PENDING_PAYMENT", "IN_PROGRESS"] } }, orderBy: { startsAt: "asc" }, take: 5, include: { items: true } }),
    db.booking.findMany({ where: { customerId: user.id }, orderBy: { createdAt: "desc" }, take: 5, include: { items: true } }),
    db.booking.count({ where: { customerId: user.id, status: "COMPLETED" } }),
    db.booking.count({ where: { customerId: user.id, status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } } }),
    db.favourite.count({ where: { customerId: user.id } }),
  ]);
  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} actions={<Link href="/search" className={btn()}>Book an appointment</Link>} />
      {!user.emailVerifiedAt && <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><Notice tone="warn">Please verify your email address to secure your account.</Notice><Act action={resendVerificationAction} fields={{}} label="Resend email" /></div>}
      {pending > 0 && <div className="mb-6"><Notice tone="warn">You have {pending} booking{pending > 1 ? "s" : ""} awaiting payment. Complete payment before the hold expires to keep your slot.</Notice></div>}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Upcoming" value={upcoming.length} /><Stat label="Completed" value={completed} /><Stat label="Awaiting payment" value={pending} /><Stat label="Favourites" value={favs} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Upcoming appointments" action={<Link href="/account/bookings" className="text-sm text-brand">All</Link>}>
          {upcoming.length ? <ul className="space-y-2">{upcoming.map((b) => <BookingRow key={b.id} b={b} href={`/account/bookings/${b.reference}`} />)}</ul> : <Empty title="No upcoming appointments" action={<Link href="/search" className={btn({ size: "sm" })}>Find a professional</Link>} />}
        </Card>
        <Card title="Recent bookings">
          {recent.length ? <ul className="space-y-2">{recent.map((b) => <BookingRow key={b.id} b={b} href={`/account/bookings/${b.reference}`} />)}</ul> : <Empty title="No bookings yet" />}
        </Card>
      </div>
    </>
  );
}
