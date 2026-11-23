/**
 * One-off creation of named sign-in accounts during `vercel-build`.
 *   TEST_ACCOUNTS='[{"email":"…","name":"…","role":"CUSTOMER|PROVIDER|ADMIN","adminRole":"operations_manager","password":"…"}]'
 * Existing emails are left untouched (passwords are never reset). Delete the variable after the deploy.
 */
import { PrismaClient, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
type A = { email: string; name: string; role: UserRole; adminRole?: string; password: string };

async function main() {
  if (!process.env.TEST_ACCOUNTS) return;
  const list = JSON.parse(process.env.TEST_ACCOUNTS) as A[];
  const gh = await db.country.findUnique({ where: { code: "GH" } });
  for (const a of list) {
    const email = a.email.trim().toLowerCase();
    if (await db.user.findUnique({ where: { email } })) { console.log(`Accounts: ${a.role} exists — unchanged`); continue; }
    if (a.password.length < 12) throw new Error("Passwords must be at least 12 characters");
    const role = a.adminRole ? await db.adminRole.findUnique({ where: { key: a.adminRole } }) : null;
    await db.user.create({
      data: {
        email, name: a.name, role: a.role, passwordHash: await bcrypt.hash(a.password, 12), emailVerifiedAt: new Date(), countryId: gh?.id,
        referralCode: `${a.role.slice(0, 3)}${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1e4)}`,
        ...(role ? { adminRoles: { create: { roleId: role.id } } } : {}),
      },
    });
    console.log(`Accounts: ${a.role}${role ? ` (${role.name})` : ""} created`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
