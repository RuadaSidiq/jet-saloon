import Link from "next/link";
import { getSetting } from "@/server/modules/settings";
export const metadata = { title: "Help" };
export default async function Help() {
  const email = await getSetting("general.supportEmail");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold">Help & support</h1>
      <p className="mt-3 text-sm text-muted">For booking or payment problems, open a support ticket from your account so we can see the details. You can also email <a className="text-brand" href={`mailto:${email}`}>{email}</a>.</p>
      <Link href="/account/support/new" className="mt-6 inline-block rounded-2xl bg-brand px-4 py-2 text-sm font-medium text-white">Open a support ticket</Link>
    </div>
  );
}
