import Link from "next/link";
import { db } from "@/server/db";
import { searchProviders } from "@/server/modules/search";
import { ProviderCard } from "@/components/site/provider-card";
import { Newsletter } from "@/components/site/newsletter";
import { Stars, btn } from "@/components/ui";

export const dynamic = "force-dynamic";

const FAQ = [
  ["How do I know a professional is trustworthy?", "Every professional on Jet Saloon is reviewed by our verification team before they can accept bookings. Reviews can only be left by customers who completed a booking."],
  ["When am I charged?", "For instant bookings you pay when you book, and your slot is held while you pay. For professionals who approve requests first, you're only asked to pay after they accept."],
  ["Can I cancel?", "Yes. Cancel from your account. Cancellations made before the professional's free-cancellation window are refunded in full to your original payment method."],
  ["Which payment methods can I use?", "Mobile Money and bank cards, processed securely by our licensed payment partners. We never see or store your card details."],
  ["Can a professional come to my home?", "Many offer home service. Filter for \"Home service\" when searching — any travel fee is shown before you pay."],
];

export default async function Home() {
  const [categories, featured, topRated, recent, popular, testimonials, banner] = await Promise.all([
    db.category.findMany({ where: { parentId: null, active: true }, orderBy: { sortOrder: "asc" }, include: { children: { where: { active: true }, take: 3, orderBy: { sortOrder: "asc" } } } }),
    db.providerProfile.count({ where: { status: "APPROVED", featured: true } }).then((n) => (n ? searchProviders({}) : null)),
    searchProviders({ sort: "rating" }),
    searchProviders({ sort: "newest" }),
    db.bookingItem.groupBy({ by: ["nameSnapshot"], where: { booking: { status: { in: ["CONFIRMED", "COMPLETED"] } } }, _count: true, orderBy: { _count: { nameSnapshot: "desc" } }, take: 8 }),
    db.review.findMany({ where: { status: "PUBLISHED", rating: { gte: 4 }, comment: { not: null } }, orderBy: { createdAt: "desc" }, take: 3, include: { customer: { select: { name: true } }, provider: { select: { businessName: true, slug: true } } } }),
    db.banner.findFirst({ where: { active: true, placement: "HOME_HERO", OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, orderBy: { sortOrder: "asc" } }),
  ]);
  const cities = await db.city.findMany({ where: { active: true, country: { active: true } }, orderBy: { name: "asc" }, take: 12 });
  const rated = topRated.results.filter((r) => r.ratingCount > 0).slice(0, 4);

  return (
    <>
      <section className="border-b border-line bg-canvas">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:py-20">
          <div>
            <p className="text-sm font-medium text-brand">Verified beauty professionals</p>
            <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-[2.6rem]">Book the beauty professional you can trust.</h1>
            <p className="mt-4 max-w-lg text-muted">Makeup artists, barbers, stylists, nail and lash technicians — compare real work, see live availability and pay securely.</p>
            <form action="/search" className="mt-8 glass-strong glass rounded-(--radius-card) p-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="hq">What are you looking for?</label>
                <input id="hq" name="q" placeholder="e.g. bridal makeup, barber, lash technician" className="h-12 flex-1 rounded-2xl px-3 text-sm focus:outline-none" />
                <label className="sr-only" htmlFor="hcity">City</label>
                <select id="hcity" name="city" className="h-12 rounded-2xl border border-[#c3d5ee] bg-white/80 px-3 text-sm sm:w-44">
                  <option value="">Any city</option>
                  {cities.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                </select>
                <button className={btn({ size: "lg" })}>Search</button>
              </div>
            </form>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {["Bridal makeup", "Barber in Accra", "Lash technician in East Legon", "Nail technician in Kumasi", "Braiding"].map((q) => (
                <Link key={q} href={`/search?q=${encodeURIComponent(q)}`} className="rounded-full border border-white/80 bg-white/55 px-3 py-1 text-muted backdrop-blur-md hover:bg-white/85 hover:text-brand">{q}</Link>
              ))}
            </div>
          </div>
          {banner?.imageUrl ? (
            <div className="relative hidden overflow-hidden rounded-(--radius-card) bg-brand-dark lg:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={banner.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="relative flex h-full flex-col justify-end bg-gradient-to-t from-brand-dark/90 to-transparent p-8 text-white">
                <p className="text-lg font-semibold">{banner.title}</p>
                {banner.subtitle && <p className="mt-1 text-sm text-white/85">{banner.subtitle}</p>}
                {banner.linkUrl && <Link href={banner.linkUrl} className="mt-4 self-start rounded-2xl bg-white px-4 py-2 text-sm font-medium text-brand-dark">Learn more</Link>}
              </div>
            </div>
          ) : (
            <div className="hidden self-center glass rounded-(--radius-card) p-8 lg:block">
              <p className="font-semibold">{banner?.title ?? "Why customers book with Jet Saloon"}</p>
              <ul className="mt-5 space-y-4 text-sm">
                {[["Verified professionals", "Every professional is reviewed by our team before they can take bookings."], ["Real-time availability", "Only genuinely open slots are shown — no back-and-forth."], ["Secure payment", "Pay with Mobile Money or card. Free cancellation within each professional's policy."], ["Honest reviews", "Only customers who completed an appointment can leave a review."]].map(([t, b]) => (
                  <li key={t} className="flex gap-3"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-xs text-brand">✓</span><span><span className="font-medium">{t}</span><span className="block text-muted">{b}</span></span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex items-end justify-between"><h2 className="text-xl font-semibold">Browse by service</h2><Link href="/search" className="text-sm text-brand">All services</Link></div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => (
            <Link key={c.id} href={`/search?category=${c.slug}`} className="group glass glass-hover rounded-(--radius-card) p-4">
              {c.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt="" className="mb-3 aspect-[3/2] w-full rounded-2xl object-cover" />
              )}
              <p className="font-medium group-hover:text-brand">{c.name}</p>
              {c.children.length > 0 && <p className="mt-1 line-clamp-1 text-xs text-muted">{c.children.map((s) => s.name).join(", ")}</p>}
            </Link>
          ))}
        </div>
      </section>

      {featured && featured.results.some((r) => r.featured) && <ProviderRow title="Featured professionals" items={featured.results.filter((r) => r.featured).slice(0, 4)} href="/search" />}
      {rated.length > 0 && <ProviderRow title="Top-rated professionals" items={rated} href="/search?sort=rating" />}
      {recent.results.length > 0 && <ProviderRow title="Recently joined" items={recent.results.slice(0, 4)} href="/search?sort=newest" tinted />}

      {popular.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="text-xl font-semibold">Popular services</h2>
          <div className="mt-5 flex flex-wrap gap-2">{popular.map((p) => <Link key={p.nameSnapshot} href={`/search?q=${encodeURIComponent(p.nameSnapshot)}`} className="glass glass-hover rounded-full px-4 py-2 text-sm hover:text-brand">{p.nameSnapshot}</Link>)}</div>
        </section>
      )}

      <section className="border-y border-line bg-canvas">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="text-xl font-semibold">How it works</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            {[["Find", "Search by service and location. Compare portfolios, prices and verified reviews."], ["Book", "Pick a real open time slot. It's held for you while you pay securely online."], ["Relax", "Get instant confirmation and reminders. Message your professional any time."]].map(([t, b], i) => (
              <li key={t}><span className="tabular text-sm font-semibold text-brand">0{i + 1}</span><p className="mt-2 font-semibold">{t}</p><p className="mt-1 text-sm text-muted">{b}</p></li>
            ))}
          </ol>
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="text-xl font-semibold">What customers say</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t.id} className="glass rounded-(--radius-card) p-5">
                <Stars value={t.rating} />
                <blockquote className="mt-3 text-sm leading-relaxed">“{t.comment}”</blockquote>
                <figcaption className="mt-4 text-xs text-muted">{t.customer.name.split(" ")[0]} · booked <Link href={`/provider/${t.provider.slug}`} className="text-brand">{t.provider.businessName}</Link></figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="relative grid items-center gap-8 overflow-hidden rounded-(--radius-card) bg-gradient-to-br from-brand via-[#1f74da] to-brand-dark px-6 py-10 text-white shadow-[0_24px_60px_-28px_rgba(18,61,117,.7)] sm:px-10 lg:grid-cols-[1.4fr_1fr]">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-white/15 blur-3xl" />
          <div>
            <h2 className="text-2xl font-semibold">Are you a beauty professional?</h2>
            <p className="mt-2 max-w-lg text-white/85">Join free. Get discovered by new clients, manage your calendar, take secure payments and get paid to Mobile Money or your bank.</p>
          </div>
          <div className="lg:text-right"><Link href="/become-a-provider" className="relative inline-flex h-12 items-center rounded-full bg-white/90 px-6 font-medium text-brand-dark shadow-lg backdrop-blur hover:bg-white">Become a provider</Link></div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
        <h2 className="text-xl font-semibold">Frequently asked questions</h2>
        <div className="glass divide-y divide-white/60 rounded-(--radius-card)">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-5 py-4"><summary className="cursor-pointer list-none font-medium marker:hidden">{q}</summary><p className="mt-2 text-sm text-muted">{a}</p></details>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-7xl px-4 sm:px-6">
        <div className="grid gap-6 glass rounded-(--radius-card) p-8 md:grid-cols-2">
          <div>
            <h2 className="font-semibold">Mobile apps are on the way</h2>
            <p className="mt-1 text-sm text-muted">Jet Saloon for Android and iOS is in development. Subscribe and we&apos;ll tell you the day it launches — plus occasional offers.</p>
          </div>
          <div className="flex items-center md:justify-end"><Newsletter /></div>
        </div>
      </section>
    </>
  );
}

function ProviderRow({ title, items, href, tinted }: { title: string; items: Awaited<ReturnType<typeof searchProviders>>["results"]; href: string; tinted?: boolean }) {
  return (
    <section className={tinted ? "bg-canvas" : ""}>
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex items-end justify-between"><h2 className="text-xl font-semibold">{title}</h2><Link href={href} className="text-sm text-brand">See all</Link></div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{items.map((p) => <ProviderCard key={p.id} p={p} />)}</div>
      </div>
    </section>
  );
}
