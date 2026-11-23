import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { DashShell } from "@/components/dash/shell";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser("/account");
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const nav = [
    { href: "/account", label: "Overview", exact: true }, { href: "/account/bookings", label: "My bookings" }, { href: "/account/payments", label: "Payments" },
    { href: "/account/favourites", label: "Favourites" }, { href: "/account/reviews", label: "My reviews" }, { href: "/account/notifications", label: "Notifications", badge: unread },
    { href: "/account/support", label: "Support" }, { href: "/account/settings", label: "Settings" },
    ...(user.role === "PROVIDER" ? [{ section: "Business" }, { href: "/business", label: "Business dashboard" }] : []),
    ...(user.role === "ADMIN" ? [{ section: "Admin" }, { href: "/admin", label: "Admin console" }] : []),
  ];
  return <DashShell nav={nav} title="My account" variant="customer" user={user}>{children}</DashShell>;
}
