import { Prisma } from "@prisma/client";
import { db } from "../db";

export type SearchParams = {
  q?: string; country?: string; city?: string; area?: string; category?: string; service?: string;
  minPrice?: number; maxPrice?: number; rating?: number; verified?: boolean; home?: boolean; studio?: boolean;
  sort?: "relevance" | "rating" | "price_low" | "price_high" | "newest"; page?: number; lat?: number; lng?: number;
};

/** Parse "lash technician in east legon" → text "lash technician", location hint "east legon". */
export function splitQuery(q: string) {
  const m = q.match(/^(.*?)\s+(?:in|near|around|at)\s+(.+)$/i);
  const text = (m ? m[1] : q).replace(/\bnear me\b/i, "").replace(/\bbest\b/i, "").trim();
  return { text, location: m?.[2]?.replace(/\bme\b/i, "").trim() || undefined, nearMe: /near me/i.test(q) };
}

const PAGE = 12;

/** Only APPROVED providers with at least one active service are discoverable. */
export async function searchProviders(p: SearchParams) {
  const page = Math.max(1, p.page ?? 1);
  const { text, location } = p.q ? splitQuery(p.q) : { text: "", location: undefined };
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 2).map((w) => w.replace(/s$/, ""));

  const where: Prisma.ProviderProfileWhereInput = { status: "APPROVED", user: { status: "ACTIVE" }, services: { some: { active: true, deletedAt: null } } };
  const and: Prisma.ProviderProfileWhereInput[] = [];
  if (p.country) and.push({ country: { code: p.country.toUpperCase() } });
  if (p.city) and.push({ city: { slug: p.city } });
  if (p.area) and.push({ neighbourhood: { slug: p.area } });
  if (p.category) and.push({ OR: [{ categories: { some: { category: { slug: p.category } } } }, { services: { some: { active: true, deletedAt: null, OR: [{ category: { slug: p.category } }, { subcategory: { slug: p.category } }] } } }] });
  if (p.service) and.push({ services: { some: { active: true, deletedAt: null, name: { contains: p.service, mode: "insensitive" } } } });
  if (p.rating) and.push({ ratingAvg: { gte: p.rating } });
  if (p.home) and.push({ offersHome: true });
  if (p.studio) and.push({ offersStudio: true });
  if (p.minPrice != null || p.maxPrice != null) and.push({ services: { some: { active: true, deletedAt: null, priceMinor: { ...(p.minPrice != null ? { gte: p.minPrice } : {}), ...(p.maxPrice != null ? { lte: p.maxPrice } : {}) } } } });
  if (location) {
    const loc = location.toLowerCase();
    and.push({ OR: [{ city: { name: { contains: loc, mode: "insensitive" } } }, { neighbourhood: { name: { contains: loc, mode: "insensitive" } } }, { city: { region: { name: { contains: loc, mode: "insensitive" } } } }] });
  }
  if (words.length) {
    and.push({
      OR: words.flatMap((w) => [
        { businessName: { contains: w, mode: "insensitive" as const } },
        { displayName: { contains: w, mode: "insensitive" as const } },
        { bio: { contains: w, mode: "insensitive" as const } },
        { categories: { some: { category: { OR: [{ name: { contains: w, mode: "insensitive" as const } }, { slug: { contains: w } }] } } } },
        { services: { some: { active: true, deletedAt: null, OR: [{ name: { contains: w, mode: "insensitive" as const } }, { subcategory: { name: { contains: w, mode: "insensitive" as const } } }] } } },
      ]),
    });
  }
  if (and.length) where.AND = and;

  const orderBy: Prisma.ProviderProfileOrderByWithRelationInput[] =
    p.sort === "rating" ? [{ ratingAvg: "desc" }, { ratingCount: "desc" }]
    : p.sort === "newest" ? [{ approvedAt: "desc" }]
    : [{ featured: "desc" }, { ratingAvg: "desc" }, { ratingCount: "desc" }];

  const [total, rows] = await Promise.all([
    db.providerProfile.count({ where }),
    db.providerProfile.findMany({
      where, orderBy, skip: (page - 1) * PAGE, take: PAGE,
      include: {
        city: true, neighbourhood: true, country: { include: { currency: true } },
        categories: { include: { category: true } },
        services: { where: { active: true, deletedAt: null }, orderBy: { priceMinor: "asc" }, take: 1 },
        portfolio: { where: { approved: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        staff: { where: { active: true }, include: { workingHours: { select: { weekday: true } } } },
      },
    }),
  ]);
  let results = rows.map((r) => ({
    id: r.id, slug: r.slug, businessName: r.businessName, displayName: r.displayName, avatarUrl: r.avatarUrl, coverUrl: r.portfolio[0]?.url ?? r.coverUrl,
    verified: !r.isSample, sample: r.isSample, featured: r.featured, ratingAvg: r.ratingAvg, ratingCount: r.ratingCount,
    location: [r.neighbourhood?.name, r.city?.name].filter(Boolean).join(", "), offersHome: r.offersHome, offersStudio: r.offersStudio,
    categories: r.categories.map((c) => c.category.name),
    fromPriceMinor: r.services[0]?.promoPriceMinor ?? r.services[0]?.priceMinor ?? null, currency: r.country.currency,
    openDays: [...new Set(r.staff.flatMap((s) => s.workingHours.map((w) => w.weekday)))].sort(),
    latitude: r.latitude, longitude: r.longitude,
  }));
  if (p.sort === "price_low") results = results.sort((a, b) => (a.fromPriceMinor ?? 0) - (b.fromPriceMinor ?? 0));
  if (p.sort === "price_high") results = results.sort((a, b) => (b.fromPriceMinor ?? 0) - (a.fromPriceMinor ?? 0));
  if (p.lat != null && p.lng != null) {
    const dist = (r: { latitude: number | null; longitude: number | null }) => r.latitude == null ? 1e9 : Math.hypot(r.latitude - p.lat!, (r.longitude! - p.lng!) * Math.cos((p.lat! * Math.PI) / 180));
    results = results.sort((a, b) => dist(a) - dist(b));
  }
  return { total, page, pages: Math.max(1, Math.ceil(total / PAGE)), results };
}

export type ProviderCard = Awaited<ReturnType<typeof searchProviders>>["results"][number];
