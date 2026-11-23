import Link from "next/link";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { btn } from "@/components/ui";

export const metadata = { title: "Become a provider" };

export default async function BecomeProvider() {
  const user = await currentUser();
  const profile = user ? await db.providerProfile.findUnique({ where: { userId: user.id } }) : null;
  const cta = profile ? { href: "/business", label: "Go to your business dashboard" } : user ? { href: "/business/onboarding", label: "Start your application" } : { href: "/register?next=/business/onboarding", label: "Create a free account to start" };
  return (
    <>
      <section className="border-b border-line bg-canvas">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Grow your beauty business</h1>
          <p className="mx-auto mt-4 max-w-xl text-muted">List your services for free, get discovered by new clients, manage your calendar and receive secure payments — straight to Mobile Money or your bank.</p>
          <Link href={cta.href} className={btn({ size: "lg", className: "mt-8" })}>{cta.label}</Link>
          {!user && <p className="mt-3 text-sm text-muted">Already registered? <Link href="/login?next=/business/onboarding" className="text-brand">Sign in</Link></p>}
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {[["Free to join", "No sign-up fee or subscription. A commission is only deducted when you earn from a booking."], ["Your calendar, your rules", "Set working hours, breaks, days off, notice periods and whether to approve each booking."], ["Paid securely", "Customers pay upfront through the platform. Your earnings become withdrawable after each completed appointment."], ["Build your reputation", "Verified reviews from real customers help you stand out."]].map(([t, b]) => (
          <div key={t}><h2 className="font-semibold">{t}</h2><p className="mt-2 text-sm text-muted">{b}</p></div>
        ))}
      </section>
      <section className="mx-auto max-w-4xl px-4 sm:px-6">
        <h2 className="text-xl font-semibold">How to get approved</h2>
        <ol className="mt-6 space-y-4">
          {["Tell us about you and your business, and choose your service categories.", "Add your services, prices and working hours.", "Upload at least two photos of your work.", "Upload a government-issued ID so we can verify you. It's stored privately and never shown on your profile.", "Add a payout method, then submit. We review applications within about 2 business days."].map((s, i) => (
            <li key={s} className="flex gap-4"><span className="tabular grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{i + 1}</span><p className="pt-1 text-sm">{s}</p></li>
          ))}
        </ol>
      </section>
    </>
  );
}
