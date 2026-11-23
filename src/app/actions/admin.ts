"use server";
import type { ActionResult } from "@/server/errors";
import { AppError } from "@/server/errors";
import { requirePermission } from "@/server/auth/guards";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { saveFile } from "@/server/storage";
import { toMinor } from "@/server/money";
import { PERMISSIONS, type Permission } from "@/server/rbac";
import { decideApplication, slugify } from "@/server/modules/providers";
import { cancelBooking } from "@/server/modules/bookings";
import { issueRefund } from "@/server/modules/refunds";
import { decidePayout } from "@/server/modules/payouts";
import { createCommissionRule } from "@/server/modules/commission";
import { moderateReview } from "@/server/modules/reviews";
import { replyTicket } from "@/server/modules/support";
import { setSetting, SETTING_DEFAULTS, type SettingKey } from "@/server/modules/settings";
import { confirmPayment } from "@/server/modules/payments/service";
import { bool, run, str } from "./_run";

export async function providerDecisionAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const to = str(fd, "to") as "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "INFO_REQUESTED" | "SUSPENDED";
    const admin = await requirePermission(to === "SUSPENDED" || (to === "APPROVED" && str(fd, "reactivate")) ? "providers.manage" : "providers.verify");
    await decideApplication(str(fd, "providerId"), admin.id, to, str(fd, "note") || undefined);
    return { ok: true, message: "Decision recorded and the provider has been notified." };
  });
}

export async function providerFeatureAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("promotions.manage");
    const id = str(fd, "providerId");
    const featured = bool(fd, "featured");
    const until = str(fd, "until");
    await db.providerProfile.update({ where: { id }, data: { featured, featuredUntil: featured && until ? new Date(until) : null } });
    await audit({ actorId: admin.id, action: featured ? "provider.feature" : "provider.unfeature", entityType: "ProviderProfile", entityId: id });
    return { ok: true, message: "Saved." };
  });
}

export async function providerEditAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("providers.manage");
    const id = str(fd, "providerId");
    const before = await db.providerProfile.findUniqueOrThrow({ where: { id } });
    const data = { businessName: str(fd, "businessName") || before.businessName, bio: str(fd, "bio") || null, bookingMode: str(fd, "bookingMode") === "APPROVAL" ? "APPROVAL" as const : "INSTANT" as const };
    await db.providerProfile.update({ where: { id }, data });
    await audit({ actorId: admin.id, action: "provider.edit", entityType: "ProviderProfile", entityId: id, metadata: { before: { businessName: before.businessName, bookingMode: before.bookingMode }, after: data } });
    return { ok: true, message: "Provider updated." };
  });
}

export async function portfolioModerationAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("content.manage");
    const item = await db.portfolioItem.update({ where: { id: str(fd, "id") }, data: { approved: bool(fd, "approved") } });
    await audit({ actorId: admin.id, action: "portfolio.moderate", entityType: "PortfolioItem", entityId: item.id, metadata: { approved: item.approved } });
  });
}

export async function userStatusAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("users.manage");
    const id = str(fd, "userId");
    if (id === admin.id) throw new AppError("SELF", "You cannot change your own status");
    const target = await db.user.findUniqueOrThrow({ where: { id } });
    if (target.isSuperAdmin) throw new AppError("PROTECTED", "Super admin accounts cannot be suspended here");
    const status = str(fd, "status") as "ACTIVE" | "SUSPENDED";
    if (str(fd, "notes")) await db.user.update({ where: { id }, data: { adminNotes: str(fd, "notes") } });
    if (status && status !== target.status) {
      await db.user.update({ where: { id }, data: { status } });
      if (status === "SUSPENDED") await db.session.deleteMany({ where: { userId: id } });
      await audit({ actorId: admin.id, action: `user.${status.toLowerCase()}`, entityType: "User", entityId: id });
    }
    return { ok: true, message: "Saved." };
  });
}

export async function verifyUserEmailAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("users.manage");
    await db.user.update({ where: { id: str(fd, "userId") }, data: { emailVerifiedAt: new Date() } });
    await audit({ actorId: admin.id, action: "user.verify_email", entityType: "User", entityId: str(fd, "userId") });
  });
}

export async function adminCancelBookingAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("bookings.manage");
    const reason = str(fd, "reason");
    if (reason.length < 3) return { ok: false, error: "A reason is required" };
    const r = await cancelBooking(str(fd, "ref"), admin, "admin", reason);
    return { ok: true, message: r.refunded ? "Cancelled and fully refunded." : "Cancelled." };
  });
}

export async function adminRefundAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("finance.refunds");
    const payment = await db.payment.findUniqueOrThrow({ where: { id: str(fd, "paymentId") } });
    const cur = await db.currency.findUniqueOrThrow({ where: { code: payment.currency } });
    const reason = str(fd, "reason");
    if (reason.length < 3) return { ok: false, error: "A reason is required" };
    await issueRefund({ paymentId: payment.id, amountMinor: toMinor(str(fd, "amount"), cur.minorUnits), reason, actorId: admin.id });
    return { ok: true, message: "Refund issued." };
  });
}

export async function reverifyPaymentAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    await requirePermission("finance.view");
    const r = await confirmPayment(str(fd, "reference"));
    return { ok: true, message: `Gateway says: ${r}` };
  });
}

export async function payoutDecisionAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("finance.payouts");
    await decidePayout(str(fd, "payoutId"), admin.id, str(fd, "op") as "approve", str(fd, "detail") || undefined);
    return { ok: true, message: "Payout updated." };
  });
}

export async function commissionRuleAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("finance.commissions");
    const scope = str(fd, "scope") as "GLOBAL" | "COUNTRY" | "CATEGORY" | "PROVIDER";
    const pct = Number(str(fd, "percent"));
    if (!(pct >= 0 && pct <= 100)) return { ok: false, error: "Rate must be between 0 and 100%" };
    const effectiveFrom = str(fd, "effectiveFrom") ? new Date(str(fd, "effectiveFrom")) : new Date();
    if (effectiveFrom.getTime() < Date.now() - 60_000) return { ok: false, error: "Rules can't take effect in the past — historical bookings keep their recorded commission" };
    const target = { countryId: scope === "COUNTRY" ? str(fd, "countryId") : null, categoryId: scope === "CATEGORY" ? str(fd, "categoryId") : null, providerId: scope === "PROVIDER" ? str(fd, "providerId") : null };
    if (scope !== "GLOBAL" && !Object.values(target).some(Boolean)) return { ok: false, error: "Choose what this rule applies to" };
    const rule = await createCommissionRule({ scope, ...target, rateBps: Math.round(pct * 100), effectiveFrom, note: str(fd, "note") || undefined, createdById: admin.id });
    await audit({ actorId: admin.id, action: "commission.create", entityType: "CommissionRule", entityId: rule.id, metadata: { scope, rateBps: rule.rateBps } });
    return { ok: true, message: "Commission rule created. It applies to new bookings only." };
  });
}

export async function categoryAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("catalog.manage");
    const id = str(fd, "id");
    const op = str(fd, "op");
    if (op === "toggle") { const c = await db.category.findUniqueOrThrow({ where: { id } }); await db.category.update({ where: { id }, data: { active: !c.active } }); return; }
    if (op === "feature") { const c = await db.category.findUniqueOrThrow({ where: { id } }); await db.category.update({ where: { id }, data: { featured: !c.featured } }); return; }
    if (op === "up" || op === "down") {
      const c = await db.category.findUniqueOrThrow({ where: { id } });
      const sibs = await db.category.findMany({ where: { parentId: c.parentId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
      const i = sibs.findIndex((s) => s.id === id);
      const j = op === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= sibs.length) return;
      [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
      await db.$transaction(sibs.map((s, k) => db.category.update({ where: { id: s.id }, data: { sortOrder: k } })));
      return;
    }
    if (op === "delete") {
      const inUse = await db.service.count({ where: { OR: [{ categoryId: id }, { subcategoryId: id }] } });
      if (inUse) return { ok: false, error: "This category has services. Deactivate it instead." };
      await db.category.deleteMany({ where: { parentId: id } });
      await db.category.delete({ where: { id } });
      await audit({ actorId: admin.id, action: "category.delete", entityType: "Category", entityId: id });
      return;
    }
    const name = str(fd, "name");
    if (name.length < 2) return { ok: false, error: "Enter a name" };
    let imageUrl: string | undefined;
    const file = fd.get("image");
    if (file instanceof File && file.size > 0) imageUrl = (await saveFile(file, "public", ["image"])).url ?? undefined;
    const data = { name, description: str(fd, "description") || null, icon: str(fd, "icon") || null, parentId: str(fd, "parentId") || null, ...(imageUrl ? { imageUrl } : {}) };
    if (id) await db.category.update({ where: { id }, data });
    else {
      let slug = slugify(name);
      if (await db.category.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
      await db.category.create({ data: { ...data, slug, sortOrder: 999 } });
    }
    await audit({ actorId: admin.id, action: id ? "category.update" : "category.create", entityType: "Category", entityId: id || null, metadata: { name } });
    return { ok: true, message: "Category saved." };
  });
}

export async function couponAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("promotions.manage");
    if (str(fd, "toggle")) { const c = await db.coupon.findUniqueOrThrow({ where: { id: str(fd, "toggle") } }); await db.coupon.update({ where: { id: c.id }, data: { active: !c.active } }); return; }
    const code = str(fd, "code").toUpperCase();
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return { ok: false, error: "Codes use 3–24 letters, numbers, - or _" };
    const kind = str(fd, "kind") === "FIXED" ? "FIXED" : "PERCENT";
    const currency = str(fd, "currency") || null;
    let value: number;
    if (kind === "PERCENT") { const pct = Number(str(fd, "value")); if (!(pct > 0 && pct <= 100)) return { ok: false, error: "Percent must be 1–100" }; value = Math.round(pct * 100); }
    else { if (!currency) return { ok: false, error: "Fixed discounts need a currency" }; const cur = await db.currency.findUniqueOrThrow({ where: { code: currency } }); value = toMinor(str(fd, "value"), cur.minorUnits); }
    const c = await db.coupon.create({
      data: {
        code, kind, value, currency: kind === "FIXED" ? currency : null, description: str(fd, "description") || null, countryId: str(fd, "countryId") || null,
        maxRedemptions: str(fd, "maxRedemptions") ? Number(str(fd, "maxRedemptions")) : null, perUserLimit: Number(str(fd, "perUserLimit") || 1),
        startsAt: str(fd, "startsAt") ? new Date(str(fd, "startsAt")) : new Date(), endsAt: str(fd, "endsAt") ? new Date(str(fd, "endsAt")) : null, fundedBy: "PLATFORM",
      },
    });
    await audit({ actorId: admin.id, action: "coupon.create", entityType: "Coupon", entityId: c.id, metadata: { code } });
    return { ok: true, message: `Code ${code} created.` };
  });
}

export async function bannerAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    await requirePermission("promotions.manage");
    if (str(fd, "toggle")) { const b = await db.banner.findUniqueOrThrow({ where: { id: str(fd, "toggle") } }); await db.banner.update({ where: { id: b.id }, data: { active: !b.active } }); return; }
    if (str(fd, "delete")) { await db.banner.delete({ where: { id: str(fd, "delete") } }); return; }
    const title = str(fd, "title");
    if (title.length < 3) return { ok: false, error: "Enter a title" };
    let imageUrl: string | null = null;
    const file = fd.get("image");
    if (file instanceof File && file.size > 0) imageUrl = (await saveFile(file, "public", ["image"])).url;
    const link = str(fd, "linkUrl");
    if (link && !link.startsWith("/") && !/^https:\/\//.test(link)) return { ok: false, error: "Links must start with / or https://" };
    await db.banner.create({ data: { title, subtitle: str(fd, "subtitle") || null, linkUrl: link || null, imageUrl, placement: str(fd, "placement") || "HOME_HERO" } });
    return { ok: true, message: "Banner created." };
  });
}

export async function reviewModerationAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("content.manage");
    const status = str(fd, "status") === "HIDDEN" ? "HIDDEN" : "PUBLISHED";
    await moderateReview(str(fd, "reviewId"), status);
    await audit({ actorId: admin.id, action: `review.${status.toLowerCase()}`, entityType: "Review", entityId: str(fd, "reviewId") });
  });
}

export async function ticketAdminAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("support.manage");
    const id = str(fd, "ticketId");
    if (str(fd, "body")) await replyTicket(id, admin.id, str(fd, "body"), { asStaff: true, internal: bool(fd, "internal") });
    const data: Record<string, string | null> = {};
    if (str(fd, "status")) data.status = str(fd, "status");
    if (str(fd, "priority")) data.priority = str(fd, "priority");
    if (fd.has("assignedToId")) data.assignedToId = str(fd, "assignedToId") || null;
    if (str(fd, "resolution")) data.resolution = str(fd, "resolution");
    if (Object.keys(data).length) await db.supportTicket.update({ where: { id }, data });
    return { ok: true, message: "Ticket updated." };
  });
}

export async function countryAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("settings.manage");
    const id = str(fd, "id");
    const gateways = str(fd, "paymentGateways").split(",").map((s) => s.trim()).filter(Boolean);
    const channels = str(fd, "payoutChannels").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    const country = await db.country.findUniqueOrThrow({ where: { id }, include: { currency: true } });
    const active = bool(fd, "active");
    if (active && !(await db.city.count({ where: { countryId: id } }))) return { ok: false, error: "Add at least one city before activating a country" };
    await db.country.update({
      where: { id },
      data: { active, paymentGateways: gateways, payoutChannels: channels, timezone: str(fd, "timezone") || country.timezone, phonePattern: str(fd, "phonePattern") || country.phonePattern,
        minPayoutMinor: str(fd, "minPayout") ? toMinor(str(fd, "minPayout"), country.currency.minorUnits) : country.minPayoutMinor, requiresIdDocument: bool(fd, "requiresIdDocument"), taxRateBps: Math.round(Number(str(fd, "taxPercent") || 0) * 100) },
    });
    await audit({ actorId: admin.id, action: "country.update", entityType: "Country", entityId: id, metadata: { active, gateways, channels } });
    return { ok: true, message: `${country.name} saved.` };
  });
}

export async function cityAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    await requirePermission("settings.manage");
    const name = str(fd, "name");
    if (name.length < 2) return { ok: false, error: "Enter a city name" };
    const countryId = str(fd, "countryId");
    let regionId: string | null = null;
    if (str(fd, "region")) regionId = (await db.region.upsert({ where: { countryId_name: { countryId, name: str(fd, "region") } }, update: {}, create: { countryId, name: str(fd, "region") } })).id;
    const city = await db.city.upsert({ where: { countryId_slug: { countryId, slug: slugify(name) } }, update: {}, create: { countryId, regionId, name, slug: slugify(name) } });
    for (const n of str(fd, "neighbourhoods").split(",").map((s) => s.trim()).filter(Boolean)) {
      await db.neighbourhood.upsert({ where: { cityId_slug: { cityId: city.id, slug: slugify(n) } }, update: {}, create: { cityId: city.id, name: n, slug: slugify(n) } });
    }
    return { ok: true, message: `${name} saved.` };
  });
}

export async function settingsAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("settings.manage");
    const changed: string[] = [];
    for (const key of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
      if (!fd.has(key)) continue;
      const def = SETTING_DEFAULTS[key];
      const raw = str(fd, key);
      const value = typeof def === "number" ? Number(raw) : typeof def === "boolean" ? raw === "true" : raw;
      if (typeof def === "number" && !Number.isFinite(value)) return { ok: false, error: `${key} must be a number` };
      await setSetting(key, value);
      changed.push(key);
    }
    await audit({ actorId: admin.id, action: "settings.update", entityType: "PlatformSetting", metadata: { keys: changed } });
    return { ok: true, message: "Settings saved." };
  });
}

export async function roleAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("roles.manage");
    const perms = fd.getAll("permissions").map(String).filter((p): p is Permission => p in PERMISSIONS);
    const id = str(fd, "id");
    if (id) {
      const r = await db.adminRole.findUniqueOrThrow({ where: { id } });
      if (r.key === "super_admin") return { ok: false, error: "The Super Admin role cannot be edited" };
      await db.adminRole.update({ where: { id }, data: { permissions: perms, name: str(fd, "name") || r.name } });
    } else {
      const name = str(fd, "name");
      if (name.length < 3) return { ok: false, error: "Enter a role name" };
      await db.adminRole.create({ data: { key: slugify(name).replace(/-/g, "_"), name, permissions: perms } });
    }
    await audit({ actorId: admin.id, action: id ? "role.update" : "role.create", entityType: "AdminRole", entityId: id || null, metadata: { perms } });
    return { ok: true, message: "Role saved." };
  });
}

export async function adminUserAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const admin = await requirePermission("roles.manage");
    const email = str(fd, "email").toLowerCase();
    const user = await db.user.findUnique({ where: { email } });
    if (!user) return { ok: false, error: "No account with that email. Ask them to register first." };
    if (user.role === "PROVIDER") return { ok: false, error: "Provider accounts can't be made administrators" };
    const roleIds = fd.getAll("roleIds").map(String);
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { role: roleIds.length || user.isSuperAdmin ? "ADMIN" : "CUSTOMER" } }),
      db.userAdminRole.deleteMany({ where: { userId: user.id } }),
      db.userAdminRole.createMany({ data: roleIds.map((roleId) => ({ userId: user.id, roleId })) }),
    ]);
    await audit({ actorId: admin.id, action: "admin.assign_roles", entityType: "User", entityId: user.id, metadata: { roleIds } });
    return { ok: true, message: "Administrator access updated." };
  });
}
