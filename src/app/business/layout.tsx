import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { DashShell, type NavItem } from "@/components/dash/shell";

export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser("/business");
  const p = await db.providerProfile.findUnique({ where: { userId: user.id } });
  const pending = p ? await db.booking.count({ where: { providerId: p.id, status: "AWAITING_APPROVAL" } }) : 0;
  const nav: NavItem[] = p ? [
    { href: "/business", label: "Overview", icon: "dashboard", exact: true },
    ...(p.status !== "APPROVED" ? [{ href: "/business/onboarding", label: "Application", icon: "clipboard" }] : []),
    { href: "/business/bookings", label: "Bookings", icon: "calendar", badge: pending, tabs: [{ href: "/business/bookings", label: "All bookings", badge: pending }, { href: "/business/calendar", label: "Calendar" }] },
    { href: "/business/availability", label: "Availability", icon: "clock", tabs: [{ href: "/business/availability", label: "Hours & time off" }, { href: "/business/settings", label: "Booking rules" }] },
    { href: "/business/services", label: "Services", icon: "scissors" },
    { href: "/business/profile", label: "Business profile", icon: "store", tabs: [{ href: "/business/profile", label: "Details" }, { href: "/business/portfolio", label: "Portfolio" }, { href: "/business/verification", label: "Verification" }] },
    { href: "/business/reviews", label: "Reviews", icon: "star" },
    { href: "/business/earnings", label: "Earnings", icon: "wallet" },
  ] : [{ href: "/business/onboarding", label: "Start application", icon: "clipboard" }];
  return <DashShell nav={nav} title={p?.businessName ?? "Business"} variant="business" user={user} links={[{ href: "/account", label: "Personal account" }]}>{children}</DashShell>;
}
