import Link from "next/link";
import { LoginForm } from "@/components/auth/forms";
import { Notice } from "@/components/ui";
export const metadata = { title: "Sign in" };
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const sp = await searchParams;
  return (<>
    <h1 className="text-xl font-semibold">Welcome back</h1>
    <p className="mb-6 mt-1 text-sm text-muted">Sign in to manage your bookings.</p>
    {sp.reset && <div className="mb-4"><Notice tone="ok">Password updated. Please sign in.</Notice></div>}
    <LoginForm next={sp.next} />
    <p className="mt-6 text-center text-sm text-muted">New here? <Link href={`/register${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="text-brand">Create an account</Link></p>
  </>);
}
