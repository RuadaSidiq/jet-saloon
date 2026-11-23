import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { currentUser } from "@/server/auth/session";
import { BookingWizard } from "@/components/booking/wizard";
import { Notice, btn } from "@/components/ui";

export const metadata = { title: "Book an appointment" };

export default async function BookPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ service?: string }> }) {
  const { slug } = await params;
  const { service } = await searchParams;
  const p = await db.providerProfile.findFirst({
    where: { slug, status: "APPROVED", user: { status: "ACTIVE" } },
    include: { country: { include: { currency: true } }, services: { where: { active: true, deletedAt: null }, orderBy: { priceMinor: "asc" } }, serviceAreas: { include: { city: true } } },
  });
  if (!p) notFound();
  const user = await currentUser();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="text-sm"><Link href={`/provider/${p.slug}`} className="text-brand">← {p.businessName}</Link></p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Book with {p.businessName}</h1>
      <div className="mt-6">
        {!user ? (
          <div className="max-w-lg space-y-4"><Notice>Please sign in or create a free account to book. It takes less than a minute.</Notice>
            <div className="flex gap-2"><Link className={btn()} href={`/login?next=/book/${p.slug}`}>Sign in</Link><Link className={btn({ variant: "secondary" })} href={`/register?next=/book/${p.slug}`}>Create account</Link></div></div>
        ) : user.id === p.userId ? <Notice tone="warn">This is your own profile — customers will see this booking page.</Notice> : (
          <BookingWizard
            provider={{ id: p.id, timezone: p.timezone, offersStudio: p.offersStudio, offersHome: p.offersHome, bookingMode: p.bookingMode, maxAdvanceDays: p.maxAdvanceDays }}
            services={p.services.map((s) => ({ id: s.id, name: s.name, durationMinutes: s.durationMinutes, priceMinor: s.priceMinor, promoPriceMinor: s.promoPriceMinor, homeServiceAvailable: s.homeServiceAvailable, homeTravelFeeMinor: s.homeTravelFeeMinor }))}
            currency={p.country.currency} preselect={service} areas={p.serviceAreas.map((a) => ({ cityId: a.cityId, name: a.city.name, feeMinor: a.travelFeeMinor }))}
          />
        )}
      </div>
    </div>
  );
}
