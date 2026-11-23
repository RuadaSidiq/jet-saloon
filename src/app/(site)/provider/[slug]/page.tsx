import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { currentUser } from "@/server/auth/session";
import { money } from "@/lib/format";
import { Badge, Card, Stars, btn } from "@/components/ui";
import { FavouriteButton } from "@/components/site/favourite-button";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

async function load(slug: string) {
  return db.providerProfile.findFirst({
    where: { slug, status: "APPROVED", user: { status: "ACTIVE" } },
    include: {
      city: true, neighbourhood: true, country: { include: { currency: true } },
      categories: { include: { category: true } },
      services: { where: { active: true, deletedAt: null }, orderBy: [{ categoryId: "asc" }, { priceMinor: "asc" }], include: { subcategory: true } },
      portfolio: { where: { approved: true }, orderBy: { sortOrder: "asc" } },
      staff: { where: { active: true }, include: { workingHours: { orderBy: { startMinute: "asc" } } } },
      reviews: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 20, include: { customer: { select: { name: true } } } },
      serviceAreas: { include: { city: true } },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  return p ? { title: `${p.businessName} — ${p.categories.map((c) => c.category.name).join(", ")} in ${p.city?.name ?? ""}`, description: p.bio?.slice(0, 155) } : { title: "Not found" };
}

export default async function ProviderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();
  const user = await currentUser();
  const fav = user ? !!(await db.favourite.findUnique({ where: { customerId_providerId: { customerId: user.id, providerId: p.id } } })) : false;

  // count profile views (one per request; aggregated per day)
  const day = new Date(new Date().toISOString().slice(0, 10));
  await db.$transaction([
    db.providerProfile.update({ where: { id: p.id }, data: { profileViews: { increment: 1 } } }),
    db.providerDailyStat.upsert({ where: { providerId_day: { providerId: p.id, day } }, update: { views: { increment: 1 } }, create: { providerId: p.id, day, views: 1 } }),
  ]).catch(() => {});

  const hours = new Map<number, string[]>();
  for (const s of p.staff) for (const w of s.workingHours) hours.set(w.weekday, [...(hours.get(w.weekday) ?? []), `${hm(w.startMinute)}–${hm(w.endMinute)}`]);
  const cur = p.country.currency;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        {p.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatarUrl} alt={p.displayName} className="size-24 rounded-full object-cover" />
        ) : <div className="grid size-24 place-items-center rounded-full bg-brand-soft text-3xl font-semibold text-brand">{p.displayName[0]}</div>}
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{p.businessName}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone="ok">✓ Verified</Badge>
            <span>{p.displayName}</span>·<span>{[p.neighbourhood?.name, p.city?.name].filter(Boolean).join(", ")}</span>
            {p.yearsExperience > 0 && <>·<span>{p.yearsExperience} yrs experience</span></>}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm">{p.ratingCount ? <><Stars value={p.ratingAvg} size="md" /><span className="tabular font-medium">{p.ratingAvg.toFixed(1)}</span><span className="text-muted">({p.ratingCount} reviews)</span></> : <span className="text-muted">No reviews yet</span>}</p>
        </div>
        <div className="flex gap-2">
          {user && <FavouriteButton providerId={p.id} saved={fav} />}
          <Link href={`/book/${p.slug}`} className={btn({ size: "lg" })}>Book now</Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {p.portfolio.length > 0 && (
            <Card title="Portfolio">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {p.portfolio.map((m) => m.mediaType === "VIDEO"
                  ? <video key={m.id} src={m.url} controls className="aspect-square w-full rounded-2xl bg-black object-cover" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img key={m.id} src={m.url} alt={m.caption ?? `Work by ${p.businessName}`} className="aspect-square w-full rounded-2xl object-cover" loading="lazy" />)}
              </div>
            </Card>
          )}
          <Card title="Services">
            <ul className="divide-y divide-line">
              {p.services.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted">{s.subcategory?.name && `${s.subcategory.name} · `}{s.durationMinutes} min{s.homeServiceAvailable && " · Home service available"}</p>
                    {s.description && <p className="mt-1 text-sm text-muted">{s.description}</p>}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right tabular">
                      {s.promoPriceMinor != null && <span className="mr-2 text-sm text-muted line-through">{money(s.priceMinor, cur)}</span>}
                      <span className="font-semibold">{money(s.promoPriceMinor ?? s.priceMinor, cur)}</span>
                    </div>
                    <Link href={`/book/${p.slug}?service=${s.id}`} className={btn({ variant: "secondary", size: "sm" })}>Book</Link>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={`Reviews (${p.ratingCount})`}>
            {p.reviews.length === 0 ? <p className="text-sm text-muted">Reviews appear here after customers complete their appointments.</p> : (
              <ul className="space-y-5">
                {p.reviews.map((r) => (
                  <li key={r.id}>
                    <div className="flex items-center gap-2 text-sm"><Stars value={r.rating} /><span className="font-medium">{r.customer.name.split(" ")[0]}</span><span className="text-xs text-muted">{r.createdAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}</span><Badge tone="ok">Verified booking</Badge></div>
                    {r.comment && <p className="mt-1.5 text-sm">{r.comment}</p>}
                    {r.providerResponse && <p className="mt-2 border-l-2 border-brand-soft pl-3 text-sm text-muted"><span className="font-medium text-ink">Response: </span>{r.providerResponse}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <aside className="space-y-6">
          {p.bio && <Card title="About"><p className="whitespace-pre-line text-sm leading-relaxed">{p.bio}</p></Card>}
          <Card title="Opening hours">
            <dl className="space-y-1.5 text-sm">{[1, 2, 3, 4, 5, 6, 0].map((d) => <div key={d} className="flex justify-between gap-4"><dt className="text-muted">{DAYS[d]}</dt><dd className="tabular text-right">{hours.get(d)?.join(", ") ?? "Closed"}</dd></div>)}</dl>
            <p className="mt-3 text-xs text-muted">Times shown in {p.timezone.replace("_", " ")}.</p>
          </Card>
          <Card title="Booking details">
            <ul className="space-y-2 text-sm">
              <li>{p.offersStudio && p.offersHome ? "Studio and home appointments" : p.offersHome ? "Home appointments only" : "Studio appointments"}</li>
              {p.serviceAreas.length > 0 && <li className="text-muted">Travels to: {p.serviceAreas.map((a) => a.city.name).join(", ")}</li>}
              <li>{p.bookingMode === "APPROVAL" ? "Requests are confirmed by the professional — you only pay once accepted." : "Instant confirmation when you pay."}</li>
              <li>Free cancellation up to {p.freeCancelHours} hours before.</li>
              {p.cancellationPolicy && <li className="text-muted">{p.cancellationPolicy}</li>}
              <li className="text-muted">The exact studio address is shared after your booking is confirmed.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
