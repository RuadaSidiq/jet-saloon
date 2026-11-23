import Link from "next/link";
import { db } from "@/server/db";
import { RegisterForm } from "@/components/auth/forms";
export const metadata = { title: "Create account" };
export default async function Register({ searchParams }: { searchParams: Promise<{ next?: string; ref?: string }> }) {
  const sp = await searchParams;
  const countries = await db.country.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } });
  return (<>
    <h1 className="text-xl font-semibold">Create your account</h1>
    <p className="mb-6 mt-1 text-sm text-muted">Book verified professionals in minutes.</p>
    <RegisterForm next={sp.next} countries={countries} refCode={sp.ref} />
    <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link href="/login" className="text-brand">Sign in</Link></p>
  </>);
}
