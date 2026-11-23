import { redirect } from "next/navigation";
import { pageUser, permissionsOf } from "@/server/auth/guards";
import { db } from "@/server/db";
import { DashShell, type NavItem } from "@/components/dash/shell";
import type { Permission } from "@/server/rbac";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser("/admin");
  if (user.role !== "ADMIN") redirect("/");
  const perms = await permissionsOf(user.id);
  const can = (p: Permission) => perms === "ALL" || perms.has(p);
  const [pendingApps, pendingPayouts, openTickets] = await Promise.all([
    can("providers.verify") ? db.providerProfile.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }) : 0,
    can("finance.payouts") ? db.payout.count({ where: { status: { in: ["REQUESTED", "APPROVED"] } } }) : 0,
    can("support.view") ? db.supportTicket.count({ where: { status: "OPEN" } }) : 0,
  ]);
  const items: (NavItem & { p: Permission } | { section: string; p?: Permission })[] = [
    { href: "/admin", label: "Dashboard", exact: true, p: "dashboard.view" },
    { section: "Marketplace" },
    { href: "/admin/providers", label: "Providers", badge: pendingApps, p: "providers.view" },
    { href: "/admin/users", label: "Users", p: "users.view" },
    { href: "/admin/bookings", label: "Bookings", p: "bookings.view" },
    { href: "/admin/reviews", label: "Reviews", p: "content.manage" },
    { href: "/admin/support", label: "Support", badge: openTickets, p: "support.view" },
    { section: "Finance" },
    { href: "/admin/finance/payouts", label: "Payouts", badge: pendingPayouts, p: "finance.payouts" },
    { href: "/admin/finance/ledger", label: "Payments & ledger", p: "finance.view" },
    { href: "/admin/commissions", label: "Commissions", p: "finance.commissions" },
    { section: "Catalogue & growth" },
    { href: "/admin/categories", label: "Categories", p: "catalog.manage" },
    { href: "/admin/promotions", label: "Promotions", p: "promotions.manage" },
    { section: "Platform" },
    { href: "/admin/countries", label: "Countries & currencies", p: "settings.manage" },
    { href: "/admin/settings", label: "Settings", p: "settings.manage" },
    { href: "/admin/roles", label: "Roles & admins", p: "roles.manage" },
    { href: "/admin/audit", label: "Audit log", p: "audit.view" },
  ];
  const visible = items.filter((i) => !("p" in i) || !i.p || can(i.p));
  const nav = visible.filter((i, idx) => !("section" in i) || (visible[idx + 1] && !("section" in visible[idx + 1]))) as (NavItem | { section: string })[];
  return <DashShell nav={nav} title={user.isSuperAdmin ? "Super Admin" : "Administration"} variant="admin" user={user}>{children}</DashShell>;
}
