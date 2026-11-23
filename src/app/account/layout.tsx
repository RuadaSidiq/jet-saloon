import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { DashShell, type NavItem } from "@/components/dash/shell";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser("/account");
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const nav: NavItem[] = [
    { href: "/account", label: "Overview", icon: "home", exact: true },
    { href: "/account/bookings", label: "My bookings", icon: "calendar" },
    { href: "/account/payments", label: "Payments", icon: "card" },
    { href: "/account/favourites", label: "Favourites", icon: "heart", tabs: [{ href: "/account/favourites", label: "Saved professionals" }, { href: "/account/reviews", label: "My reviews" }] },
    { href: "/account/notifications", label: "Notifications", icon: "bell", badge: unread },
    { href: "/account/support", label: "Support", icon: "support" },
    { href: "/account/settings", label: "Settings", icon: "settings", tabs: [{ href: "/account/settings", label: "Profile" }, { href: "/account/security", label: "Security" }] },
  ];
  const links = [...(user.role === "PROVIDER" ? [{ href: "/business", label: "My business" }] : []), ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Admin console" }] : [])];
  return <DashShell nav={nav} title="My account" variant="customer" user={user} links={links}>{children}</DashShell>;
}
