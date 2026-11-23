import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarClock, Search, ShieldCheck, Smartphone, Sparkles, Star, Wallet } from "lucide-react";
import { db } from "@/server/db";
import { searchProviders } from "@/server/modules/search";
import { ProviderCard } from "@/components/site/provider-card";
import { Newsletter } from "@/components/site/newsletter";
import { HeroVisual } from "@/components/site/hero-visual";
import { Stars, btn } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Bundled default photos per category (public/images/categories); an admin-uploaded image takes priority. */
const CATEGORY_PHOTOS = new Set(["makeup-artists", "barbers", "hair-stylists", "lash-technicians", "nail-technicians", "skincare-specialists", "eyebrow-technicians", "massage-therapists", "spa-therapists", "waxing-specialists", "tattoo-artists", "other-beauty-services"]);

const FAQ = [
  ["How do I know a professional is trustworthy?", "Every professional on Muv is reviewed by our verification team before they can accept bookings. Reviews can only be left by customers who completed a booking."],
  ["When am I charged?", "For instant bookings you pay when you book, and your slot is held while you pay. For professionals who approve requests first, you're only asked to pay after they accept."],
  ["Can I cancel?", "Yes. Cancel from your account. Cancellations made before the professional's free-cancellation window are refunded in full to your original payment method."],
  ["Which payment methods can I use?", "Mobile Money and bank cards, processed securely by our licensed payment partners. We never see or store your card details."],
  ["Can a professional come to my home?", "Many offer home service. Filter for \"Home service\" when searching — any travel fee is shown before you pay."],
];

export default async function Home() {
  const [categories, featured, topRated, recent, popular, testimonials, banner, cities] = await Promise.all([
    db.category.findMany({ where: { parentId: null, active: true }, orderBy: { sortOrder: "asc" }, include: { children: { where: { active: true }, take: 3, orderBy: { sortOrder: "asc" } } } }),
    db.providerProfile.count({ where: { status: "APPROVED", featured: true } }).then((n) => (n ? searchProviders({}) : null)),
    searchProviders({ sort: "rating" }),
    searchProviders({ sort: "newest" }),
    db.bookingItem.groupBy({ by: ["nameSnapshot"], where: { booking: { status: { in: ["CONFIRMED", "COMPLETED"] } } }, _count: true, orderBy: { _count: { nameSnapshot: "desc" } }, take: 8 }),
    db.review.findMany({ where: { status: "PUBLISHED", rating: { gte: 4 }, comment: { not: null } }, orderBy: { createdAt: "desc" }, take: 3, include: { customer: { select: { name: true } }, provider: { select: { businessName: true, slug: true } } } }),
    db.banner.findFirst({ where: { active: true, placement: "HOME_HERO", OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, orderBy: { sortOrder: "asc" } }),
    db.city.findMany({ where: { active: true, country: { active: true } }, orderBy: { name: "asc" }, take: 12 }),
  ]);
  const rated = topRated.results.filter((r) => r.ratingCount > 0).slice(0, 4);
  const hasProviders = recent.results.length > 0;

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-16">
          <div>
            <p className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-brand-dark">
              <BadgeCheck className="size-4 text-brand" /> Verified professionals
            </p>
            <h1 className="mt-6 max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
              Book trusted <span className="text-brand">beauty professionals</span> near you
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">Makeup artists, barbers, braiders, nail and lash technicians across Ghana. See their work, pick a time and pay with Mobile Money or card.</p>

            <form action="/search" className="glass mt-8 rounded-[28px] p-2 shadow-[0_20px_50px_-24px_rgba(18,61,117,.45)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex flex-1 items-center gap-3 px-3">
                  <Search className="size-5 shrink-0 text-muted" aria-hidden />
                  <span className="sr-only">What are you looking for?</span>
                  <input name="q" placeholder="Search a service or area, e.g. braids in Accra" className="h-12 w-full bg-transparent text-[15px] placeholder:text-muted/80 focus:outline-none" />
                </label>
                <button className={btn({ size: "lg", className: "h-12 px-7" })}>Search</button>
              </div>
            </form>
          </div>
          <HeroVisual imageUrl={banner?.imageUrl} />
        </div>
      </section>

      {/* ── Categories ── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-sm font-medium text-brand">Services</p><h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">What are you in the mood for?</h2></div>
          <Link href="/search" className="hidden items-center gap-1 text-sm font-medium text-brand sm:flex">All services <ArrowRight className="size-4" /></Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => {
            const img = c.imageUrl ?? (CATEGORY_PHOTOS.has(c.slug) ? `/images/categories/${c.slug}.jpg` : null);
            return (
              <Link key={c.id} href={`/search?category=${c.slug}`} className="group relative block aspect-[4/3] overflow-hidden rounded-3xl bg-brand-soft shadow-[0_10px_30px_-18px_rgba(18,61,117,.45)]">
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                )}
                <span className="glass absolute bottom-3 left-3 right-3 truncate rounded-2xl px-3.5 py-2 text-sm font-semibold text-ink sm:right-auto">{c.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {featured && featured.results.some((r) => r.featured) && <ProviderRow title="Featured professionals" items={featured.results.filter((r) => r.featured).slice(0, 4)} href="/search" />}
      {rated.length > 0 && <ProviderRow title="Top-rated professionals" items={rated} href="/search?sort=rating" />}
      {hasProviders && <ProviderRow title="New on Muv" items={recent.results.slice(0, 4)} href="/search?sort=newest" />}

      {popular.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6">
          <h2 className="text-xl font-semibold">Popular right now</h2>
          <div className="mt-5 flex flex-wrap gap-2">{popular.map((p) => <Link key={p.nameSnapshot} href={`/search?q=${encodeURIComponent(p.nameSnapshot)}`} className="glass glass-hover rounded-full px-4 py-2 text-sm hover:text-brand">{p.nameSnapshot}</Link>)}</div>
        </section>
      )}

      {/* ── How it works ── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="glass rounded-[36px] p-8 sm:p-12">
          <div className="max-w-2xl"><p className="text-sm font-medium text-brand">How it works</p><h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">From search to seat in three steps</h2></div>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {[[Search, "Find your pro", "Search by service and area. Compare portfolios, prices and reviews from real customers."], [CalendarClock, "Pick a real time", "See genuinely open slots. Your time is held while you pay — no back-and-forth."], [Sparkles, "Show up & glow", "Get instant confirmation and reminders, and message your professional any time."]].map(([Icon, t, b], i) => {
              const I = Icon as typeof Search;
              return (
                <li key={t as string} className="relative">
                  <div className="flex items-center gap-4">
                    <span className="grid size-14 place-items-center rounded-2xl bg-brand text-white"><I className="size-6" strokeWidth={1.8} /></span>
                    <span className="tabular text-4xl font-semibold text-brand/15">0{i + 1}</span>
                  </div>
                  <p className="mt-5 text-lg font-semibold">{t as string}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{b as string}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">What customers say</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t.id} className="glass rounded-3xl p-6">
                <Stars value={t.rating} />
                <blockquote className="mt-3 text-sm leading-relaxed">“{t.comment}”</blockquote>
                <figcaption className="mt-4 text-xs text-muted">{t.customer.name.split(" ")[0]} · booked <Link href={`/provider/${t.provider.slug}`} className="text-brand">{t.provider.businessName}</Link></figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ── Provider CTA ── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="relative grid items-center gap-10 overflow-hidden rounded-[36px] bg-brand px-6 py-12 text-white sm:px-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="relative">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium"><Sparkles className="size-3.5" /> For beauty professionals</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Grow your beauty business</h2>
            <p className="mt-3 max-w-lg text-white/85">Join free. Get discovered by new clients, manage your calendar, and get paid to Mobile Money or your bank after every appointment.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/become-a-provider" className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-medium text-brand-dark shadow-lg hover:bg-brand-soft">Become a provider <ArrowRight className="size-4" /></Link>
              <span className="inline-flex h-12 items-center text-sm text-white/80">No sign-up fee · commission only when you earn</span>
            </div>
          </div>
          <div aria-hidden className="relative hidden lg:block">
            <div className="rounded-3xl border border-white/25 bg-white/15 p-5 backdrop-blur-xl">
              <p className="text-xs font-medium text-white/70">Your week</p>
              <div className="mt-3 grid grid-cols-7 gap-1.5">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <div key={i} className="text-center"><p className="text-[10px] text-white/60">{d}</p><div className="mt-1 space-y-1">{Array.from({ length: [2, 3, 1, 3, 4, 5, 0][i] }).map((_, j) => <div key={j} className="h-3 rounded-full bg-white/70" />)}</div></div>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/90 p-3 text-ink"><Wallet className="size-4 text-brand" /><p className="mt-2 text-xs text-muted">Earnings tracked</p><p className="text-sm font-semibold">Withdraw to MoMo</p></div>
                <div className="rounded-2xl bg-white/90 p-3 text-ink"><Star className="size-4 fill-amber-400 text-amber-400" /><p className="mt-2 text-xs text-muted">Reputation</p><p className="text-sm font-semibold">Verified reviews</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
        <div><p className="text-sm font-medium text-brand">FAQ</p><h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Questions, answered</h2><p className="mt-3 text-sm text-muted">Still unsure? <Link href="/help" className="text-brand">Contact support</Link>.</p></div>
        <div className="glass divide-y divide-white/60 rounded-3xl">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-6 py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium marker:hidden">{q}<span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/80 text-brand transition group-open:rotate-45">+</span></summary><p className="mt-3 text-sm leading-relaxed text-muted">{a}</p></details>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <div className="glass grid items-center gap-6 rounded-[32px] p-8 md:grid-cols-2">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Smartphone className="size-6" /></span>
            <div><h2 className="font-semibold">Mobile apps are on the way</h2><p className="mt-1 text-sm text-muted">Muv for Android and iOS is in development. Subscribe and we&apos;ll tell you the day it launches — plus occasional offers.</p></div>
          </div>
          <div className="flex items-center md:justify-end"><Newsletter /></div>
        </div>
      </section>
    </>
  );
}

function ProviderRow({ title, items, href }: { title: string; items: Awaited<ReturnType<typeof searchProviders>>["results"]; href: string }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex items-end justify-between"><h2 className="text-2xl font-semibold tracking-tight">{title}</h2><Link href={href} className="flex items-center gap-1 text-sm font-medium text-brand">See all <ArrowRight className="size-4" /></Link></div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{items.map((p) => <ProviderCard key={p.id} p={p} />)}</div>
    </section>
  );
}
