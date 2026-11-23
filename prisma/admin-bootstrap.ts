/**
 * One-off admin email/password bootstrap, run during `vercel-build`.
 *   ADMIN_BOOTSTRAP_EMAIL     the admin's new sign-in email
 *   ADMIN_BOOTSTRAP_PASSWORD  a temporary password (change it after signing in, then delete this variable)
 *   ADMIN_BOOTSTRAP_FROM      optional: existing super admin email to move to the new address
 * Safe to re-run: if an account with ADMIN_BOOTSTRAP_EMAIL already exists, nothing changes.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const to = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const pw = process.env.ADMIN_BOOTSTRAP_PASSWORD;
const from = process.env.ADMIN_BOOTSTRAP_FROM?.trim().toLowerCase();

async function main() {
  if (!to || !pw) return;
  if (pw.length < 12) throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters");
  if (await db.user.findUnique({ where: { email: to } })) { console.log("Admin bootstrap: account already exists — no changes"); return; }
  const hash = await bcrypt.hash(pw, 12);
  const old = from ? await db.user.findUnique({ where: { email: from } }) : null;
  if (old?.isSuperAdmin) {
    await db.$transaction([
      db.user.update({ where: { id: old.id }, data: { email: to, passwordHash: hash, emailVerifiedAt: new Date() } }),
      db.session.deleteMany({ where: { userId: old.id } }),
      db.auditLog.create({ data: { actorId: old.id, action: "admin.bootstrap_email_moved", entityType: "User", entityId: old.id } }),
    ]);
    console.log("Admin bootstrap: super admin moved to the new email");
    return;
  }
  const gh = await db.country.findUnique({ where: { code: "GH" } });
  await db.user.create({ data: { email: to, name: "Muv Admin", passwordHash: hash, role: "ADMIN", isSuperAdmin: true, emailVerifiedAt: new Date(), referralCode: `ADM${Date.now().toString(36).toUpperCase()}`, countryId: gh?.id } });
  console.log("Admin bootstrap: super admin created");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
