import { redirect } from "next/navigation";
import { pageUser, permissionsOf } from "@/server/auth/guards";
import { adminMfaRequired } from "@/server/auth/mfa";
import { db } from "@/server/db";
import { DashShell, type NavItem, type NavTab } from "@/components/dash/shell";
import type { Permission } from "@/server/rbac";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser("/admin");
  if (user.role !== "ADMIN") redirect("/");
  if (!user.totpEnabledAt && adminMfaRequired()) redirect("/account/security?required=1");
  const perms = await permissionsOf(user.id);
  const can = (p: Permission) => perms === "ALL" || perms.has(p);
  const [pendingApps, pendingPayouts, openTickets] = await Promise.all([
    can("providers.verify") ? db.providerProfile.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }) : 0,
    can("finance.payouts") ? db.payout.count({ where: { status: { in: ["REQUESTED", "APPROVED"] } } }) : 0,
    can("support.view") ? db.supportTicket.count({ where: { status: "OPEN" } }) : 0,
  ]);
  type Def = Omit<NavItem, "tabs" | "href"> & { tabs: (NavTab & { p: Permission })[] };
  const defs: Def[] = [
    { label: "Dashboard", icon: "dashboard", tabs: [{ href: "/admin", label: "Dashboard", exact: true, p: "dashboard.view" }] },
    { label: "Providers", icon: "badge", badge: pendingApps, tabs: [{ href: "/admin/providers", label: "Providers", badge: pendingApps, p: "providers.view" }] },
    { label: "Customers", icon: "users", tabs: [{ href: "/admin/users", label: "Users", p: "users.view" }] },
    { label: "Bookings", icon: "calendar", tabs: [{ href: "/admin/bookings", label: "Bookings", p: "bookings.view" }] },
    { label: "Finance", icon: "wallet", badge: pendingPayouts, tabs: [{ href: "/admin/finance/payouts", label: "Payouts", badge: pendingPayouts, p: "finance.payouts" }, { href: "/admin/finance/ledger", label: "Payments & ledger", p: "finance.view" }, { href: "/admin/commissions", label: "Commissions", p: "finance.commissions" }] },
    { label: "Support", icon: "support", badge: openTickets, tabs: [{ href: "/admin/support", label: "Tickets", badge: openTickets, p: "support.view" }, { href: "/admin/reviews", label: "Review moderation", p: "content.manage" }] },
    { label: "Catalogue", icon: "tag", tabs: [{ href: "/admin/categories", label: "Categories", p: "catalog.manage" }, { href: "/admin/promotions", label: "Promotions", p: "promotions.manage" }] },
    { label: "Platform", icon: "settings", tabs: [{ href: "/admin/settings", label: "Settings", p: "settings.manage" }, { href: "/admin/countries", label: "Countries", p: "settings.manage" }, { href: "/admin/roles", label: "Roles & admins", p: "roles.manage" }, { href: "/admin/audit", label: "Audit log", p: "audit.view" }] },
  ];
  const nav: NavItem[] = defs
    .map((d) => ({ ...d, tabs: d.tabs.filter((t) => can(t.p)).map(({ p: _p, ...t }) => t) }))
    .filter((d) => d.tabs.length > 0)
    .map((d) => ({ ...d, href: d.tabs[0].href, exact: d.tabs[0].exact }));
  return <DashShell nav={nav} title={user.isSuperAdmin ? "Super Admin" : "Administration"} variant="admin" user={user} links={[{ href: "/account", label: "Personal account" }]}>{children}</DashShell>;
}
