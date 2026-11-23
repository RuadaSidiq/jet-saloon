/** Granular admin permissions. Super admins implicitly hold all of them. */
export const PERMISSIONS = {
  "dashboard.view": "View admin dashboard and reports",
  "users.view": "View customers and accounts",
  "users.manage": "Suspend, reactivate and annotate accounts",
  "providers.view": "View providers and applications",
  "providers.verify": "Approve, reject or request info on applications",
  "providers.documents": "View private identity and business documents",
  "providers.manage": "Suspend, reactivate, feature and edit providers",
  "bookings.view": "View all bookings",
  "bookings.manage": "Cancel bookings and resolve disputes",
  "finance.view": "View payments, ledger and financial reports",
  "finance.refunds": "Issue refunds",
  "finance.payouts": "Approve and process provider payouts",
  "finance.commissions": "Configure commission rules",
  "catalog.manage": "Manage categories",
  "promotions.manage": "Manage coupons, banners and featured listings",
  "support.view": "View support tickets",
  "support.manage": "Reply to, assign and resolve tickets",
  "content.manage": "Manage reviews moderation and legal content",
  "settings.manage": "Platform, country and currency settings",
  "roles.manage": "Manage admin roles and assignments",
  "audit.view": "View audit log",
} as const;
export type Permission = keyof typeof PERMISSIONS;

export const DEFAULT_ROLES: { key: string; name: string; permissions: Permission[] }[] = [
  { key: "operations_manager", name: "Operations Manager", permissions: ["dashboard.view", "users.view", "users.manage", "providers.view", "providers.manage", "bookings.view", "bookings.manage", "support.view", "support.manage", "catalog.manage"] },
  { key: "verification_officer", name: "Provider Verification Officer", permissions: ["providers.view", "providers.verify", "providers.documents"] },
  { key: "finance_manager", name: "Finance Manager", permissions: ["dashboard.view", "finance.view", "finance.refunds", "finance.payouts", "finance.commissions", "bookings.view"] },
  { key: "support_officer", name: "Customer Support Officer", permissions: ["users.view", "bookings.view", "support.view", "support.manage", "providers.view"] },
  { key: "content_manager", name: "Content Manager", permissions: ["catalog.manage", "promotions.manage", "content.manage"] },
];
