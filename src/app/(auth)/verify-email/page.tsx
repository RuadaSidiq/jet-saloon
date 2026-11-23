import Link from "next/link";
import { verifyEmail } from "@/server/modules/accounts";
import { Notice, btn } from "@/components/ui";
export const metadata = { title: "Verify email" };
export default async function Verify({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let ok = false;
  let msg = "This link is invalid or has expired.";
  if (token) { try { await verifyEmail(token); ok = true; } catch (e) { msg = (e as Error).message; } }
  return (<div className="space-y-4"><h1 className="text-xl font-semibold">Email verification</h1>
    <Notice tone={ok ? "ok" : "bad"}>{ok ? "Your email is verified. Thank you!" : msg}</Notice>
    <Link href="/account" className={btn()}>Go to my account</Link></div>);
}
