import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { DashShell } from "@/components/dash/shell";

export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser("/business");
  const p = await db.providerProfile.findUnique({ where: { userId: user.id } });
  const pending = p ? await db.booking.count({ where: { providerId: p.id, status: "AWAITING_APPROVAL" } }) : 0;
  const nav = p ? [
    { href: "/business", label: "Overview", exact: true },
    ...(p.status !== "APPROVED" ? [{ href: "/business/onboarding", label: "Application" }] : []),
    { section: "Bookings" }, { href: "/business/bookings", label: "Bookings", badge: pending }, { href: "/business/calendar", label: "Calendar" }, { href: "/business/availability", label: "Hours & time off" },
    { section: "Your business" }, { href: "/business/services", label: "Services" }, { href: "/business/profile", label: "Profile" }, { href: "/business/portfolio", label: "Portfolio" }, { href: "/business/reviews", label: "Reviews" },
    { section: "Money" }, { href: "/business/earnings", label: "Earnings & payouts" },
    { section: "Account" }, { href: "/business/verification", label: "Verification" }, { href: "/business/settings", label: "Booking settings" }, { href: "/account", label: "Personal account" },
  ] : [{ href: "/business/onboarding", label: "Start application" }, { href: "/account", label: "Personal account" }];
  return <DashShell nav={nav} title={p?.businessName ?? "Business"} variant="business" user={user}>{children}</DashShell>;
}
