import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "../db";
import { AppError, forbidden } from "../errors";
import type { Permission } from "../rbac";
import { currentUser } from "./session";

export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new AppError("UNAUTHENTICATED", "Please sign in to continue", 401);
  return u;
}

/** For pages: redirect to login rather than throwing. */
export async function pageUser(next: string) {
  const u = await currentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

export const permissionsOf = cache(async (userId: string): Promise<Set<string> | "ALL"> => {
  const u = await db.user.findUnique({ where: { id: userId }, include: { adminRoles: { include: { role: true } } } });
  if (!u || u.role !== "ADMIN" || u.status !== "ACTIVE") return new Set();
  if (u.isSuperAdmin) return "ALL";
  return new Set(u.adminRoles.flatMap((r) => r.role.permissions));
});

export async function hasPermission(userId: string, p: Permission) {
  const perms = await permissionsOf(userId);
  return perms === "ALL" || perms.has(p);
}

export async function requirePermission(p: Permission) {
  const u = await requireUser();
  if (!(await hasPermission(u.id, p))) throw forbidden();
  return u;
}

export async function pageAdmin(p: Permission, next = "/admin") {
  const u = await pageUser(next);
  if (u.role !== "ADMIN") redirect("/");
  if (!(await hasPermission(u.id, p))) redirect("/admin?denied=" + p);
  return u;
}

/** The provider profile owned by the signed-in user. Ownership is always derived server-side. */
export async function requireProvider() {
  const u = await requireUser();
  const p = await db.providerProfile.findUnique({ where: { userId: u.id } });
  if (!p) throw forbidden("You do not have a provider account");
  return { user: u, provider: p };
}

export async function pageProvider(next = "/business") {
  const u = await pageUser(next);
  const p = await db.providerProfile.findUnique({ where: { userId: u.id } });
  if (!p) redirect("/become-a-provider");
  return { user: u, provider: p };
}
