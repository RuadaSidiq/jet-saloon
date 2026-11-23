/**
 * Sample providers that illustrate the marketplace before real professionals join.
 * They are flagged isSample: shown with a "Sample profile" badge and never bookable.
 *   SAMPLE_PROVIDERS=true    create/update them (idempotent)
 *   SAMPLE_PROVIDERS=remove  delete them
 *   unset                    do nothing
 * Runs during `vercel-build`, after migrations and the reference seed.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const mode = process.env.SAMPLE_PROVIDERS;

type S = { name: string; sub: string; price: number; mins: number; desc: string };
const SAMPLES: { slug: string; business: string; display: string; cat: string; city: string; area: string; years: number; home: boolean; bio: string; photos: string[]; services: S[] }[] = [
  { slug: "adwoa-glam-studio", business: "Adwoa Glam Studio", display: "Adwoa", cat: "makeup-artists", city: "accra", area: "east-legon", years: 7, home: true,
    bio: "Soft glam, bridal and editorial makeup with a focus on flawless, long-wearing skin for every complexion.", photos: ["makeup-1", "makeup-2"],
    services: [{ name: "Bridal Makeup", sub: "bridal-makeup", price: 60000, mins: 150, desc: "Trial consultation, lashes and touch-up kit included." }, { name: "Party Glam", sub: "party-makeup", price: 25000, mins: 75, desc: "Full glam with lashes." }, { name: "Photoshoot Makeup", sub: "photoshoot-makeup", price: 30000, mins: 90, desc: "Camera-ready makeup for shoots." }] },
  { slug: "kwame-fades", business: "Kwame Fades", display: "Kwame", cat: "barbers", city: "accra", area: "osu", years: 9, home: false,
    bio: "Clean fades, sharp line-ups and beard sculpting in a relaxed Osu barbershop.", photos: ["barber-1", "barber-2"],
    services: [{ name: "Skin Fade", sub: "haircuts", price: 8000, mins: 45, desc: "Fade with a crisp line-up." }, { name: "Beard Sculpt", sub: "beard-grooming", price: 5000, mins: 30, desc: "Shape, line and hot towel." }, { name: "Cut & Beard", sub: "haircuts", price: 12000, mins: 60, desc: "Haircut plus full beard service." }] },
  { slug: "nana-braids-locs", business: "Nana Braids & Locs", display: "Nana", cat: "hair-stylists", city: "accra", area: "madina", years: 6, home: true,
    bio: "Knotless braids, boho braids and loc maintenance — neat parts, light tension, long-lasting styles.", photos: ["braids-1"],
    services: [{ name: "Knotless Braids (mid-back)", sub: "braiding", price: 35000, mins: 300, desc: "Medium size, hair included." }, { name: "Boho Braids", sub: "braiding", price: 45000, mins: 360, desc: "Curly-ends boho style." }, { name: "Loc Retwist", sub: "locs", price: 20000, mins: 120, desc: "Retwist and style." }] },
  { slug: "polished-by-efua", business: "Polished by Efua", display: "Efua", cat: "nail-technicians", city: "kumasi", area: "ahodwo", years: 4, home: false,
    bio: "Gel, acrylic and minimalist nail art in a calm Ahodwo studio.", photos: ["nails-1"],
    services: [{ name: "Gel Manicure", sub: "gel-nails", price: 15000, mins: 60, desc: "Shape, cuticle care and gel colour." }, { name: "Acrylic Full Set", sub: "acrylic-nails", price: 25000, mins: 90, desc: "Any length, one colour." }, { name: "Spa Pedicure", sub: "pedicure", price: 12000, mins: 60, desc: "Soak, scrub and polish." }] },
  { slug: "lash-lab-accra", business: "Lash Lab Accra", display: "Akosua", cat: "lash-technicians", city: "accra", area: "airport-residential", years: 5, home: false,
    bio: "Classic, hybrid and volume lash extensions applied with care for natural lash health.", photos: ["lashes-1", "lashes-2"],
    services: [{ name: "Classic Full Set", sub: "classic-lashes", price: 25000, mins: 120, desc: "One extension per natural lash." }, { name: "Volume Full Set", sub: "volume-lashes", price: 35000, mins: 150, desc: "Fuller, fluffier look." }, { name: "Lash Lift & Tint", sub: "lash-lift", price: 18000, mins: 60, desc: "Lift and tint your natural lashes." }] },
  { slug: "glow-skin-tema", business: "Glow Skin Tema", display: "Esi", cat: "skincare-specialists", city: "tema", area: "community-25", years: 8, home: false,
    bio: "Results-driven facials for melanin-rich skin: hyperpigmentation, acne and deep hydration.", photos: ["skin-1", "skin-2"],
    services: [{ name: "Signature Facial", sub: "facials", price: 30000, mins: 60, desc: "Cleanse, exfoliate, extract and mask." }, { name: "Brightening Peel", sub: "chemical-peels", price: 45000, mins: 45, desc: "Targets dark spots and uneven tone." }, { name: "Acne Clear Treatment", sub: "acne-treatment", price: 35000, mins: 60, desc: "Deep clean with soothing mask." }] },
];

async function create() {
  const gh = await db.country.findUniqueOrThrow({ where: { code: "GH" } });
  for (const [i, s] of SAMPLES.entries()) {
    const email = `sample-${s.slug}@muv.invalid`;
    const user = await db.user.upsert({ where: { email }, update: {}, create: { email, name: s.display, passwordHash: "!sample-account-no-login", role: "PROVIDER", referralCode: `SAMPLE${i + 1}${s.slug.slice(0, 4).toUpperCase()}`, countryId: gh.id } });
    if (await db.providerProfile.findUnique({ where: { userId: user.id } })) continue;
    const city = await db.city.findFirstOrThrow({ where: { slug: s.city, countryId: gh.id } });
    const area = await db.neighbourhood.findFirst({ where: { slug: s.area, cityId: city.id } });
    const cat = await db.category.findUniqueOrThrow({ where: { slug: s.cat } });
    const p = await db.providerProfile.create({
      data: {
        userId: user.id, slug: s.slug, businessName: s.business, displayName: s.display, bio: s.bio, yearsExperience: s.years,
        countryId: gh.id, cityId: city.id, neighbourhoodId: area?.id, timezone: gh.timezone, status: "APPROVED", approvedAt: new Date(), isSample: true,
        offersStudio: true, offersHome: s.home, verificationConsent: true,
        categories: { create: { categoryId: cat.id } },
        portfolio: { create: s.photos.map((ph, k) => ({ url: `/images/samples/${ph}.jpg`, sortOrder: k })) },
        staff: { create: { name: s.display, isOwner: true, workingHours: { create: [1, 2, 3, 4, 5, 6].map((wd) => ({ weekday: wd, startMinute: 540, endMinute: 1080 })) } } },
      },
    });
    for (const sv of s.services) {
      const sub = await db.category.findUnique({ where: { slug: sv.sub } });
      await db.service.create({ data: { providerId: p.id, categoryId: cat.id, subcategoryId: sub?.id, name: sv.name, description: sv.desc, priceMinor: sv.price, currency: "GHS", durationMinutes: sv.mins, homeServiceAvailable: s.home } });
    }
  }
  console.log(`Sample providers ready (${SAMPLES.length})`);
}

async function remove() {
  const ps = await db.providerProfile.findMany({ where: { isSample: true } });
  for (const p of ps) {
    if (await db.booking.count({ where: { providerId: p.id } })) { console.warn(`Skipping ${p.slug}: has bookings`); continue; }
    await db.$transaction([
      db.service.deleteMany({ where: { providerId: p.id } }),
      db.favourite.deleteMany({ where: { providerId: p.id } }),
      db.providerProfile.delete({ where: { id: p.id } }),
      db.session.deleteMany({ where: { userId: p.userId } }),
      db.user.delete({ where: { id: p.userId } }),
    ]);
  }
  console.log(`Removed ${ps.length} sample providers`);
}

(mode === "true" ? create() : mode === "remove" ? remove() : Promise.resolve())
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
