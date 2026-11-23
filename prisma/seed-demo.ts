/** DEVELOPMENT DEMO DATA ONLY. Never runs in production (guarded in seed.ts). */
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export async function seedDemo(db: PrismaClient) {
  const gh = await db.country.findUniqueOrThrow({ where: { code: "GH" } });
  const accra = await db.city.findFirstOrThrow({ where: { slug: "accra" } });
  const kumasi = await db.city.findFirstOrThrow({ where: { slug: "kumasi" } });
  const hood = (citySlug: string, s: string) => db.neighbourhood.findFirstOrThrow({ where: { slug: s, city: { slug: citySlug } } });
  const cat = (s: string) => db.category.findUniqueOrThrow({ where: { slug: s } });
  const pw = await bcrypt.hash("Password123", 12);

  await db.user.upsert({ where: { email: "customer@demo.test" }, update: {}, create: { email: "customer@demo.test", name: "Ama Mensah", passwordHash: pw, emailVerifiedAt: new Date(), referralCode: "DEMOCUST", countryId: gh.id, cityId: accra.id, phone: "+233241234567" } });

  const demos = [
    { email: "akua@demo.test", name: "Akua Boateng", business: "Akua Beauty Studio", slug: "akua-beauty-studio", city: accra, hood: "east-legon", cat: "makeup-artists", mode: "INSTANT" as const, home: true,
      services: [["Bridal Makeup", "bridal-makeup", 50000, 150], ["Party Makeup", "party-makeup", 25000, 75], ["Photoshoot Makeup", "photoshoot-makeup", 30000, 90], ["Natural Makeup", "natural-makeup", 15000, 60]] as const },
    { email: "kofi@demo.test", name: "Kofi Asante", business: "Kofi Cuts Barbershop", slug: "kofi-cuts", city: accra, hood: "osu", cat: "barbers", mode: "INSTANT" as const, home: false,
      services: [["Classic Haircut", "haircuts", 8000, 40], ["Beard Grooming", "beard-grooming", 5000, 25], ["Hairline Enhancement", "hairline-enhancement", 6000, 30]] as const },
    { email: "esi@demo.test", name: "Esi Owusu", business: "Esi Nails & Lashes", slug: "esi-nails-lashes", city: kumasi, hood: "ahodwo", cat: "nail-technicians", mode: "APPROVAL" as const, home: true,
      services: [["Gel Manicure", "gel-nails", 12000, 60], ["Acrylic Full Set", "acrylic-nails", 20000, 90], ["Spa Pedicure", "pedicure", 10000, 60]] as const },
  ];
  for (const d of demos) {
    const user = await db.user.upsert({ where: { email: d.email }, update: {}, create: { email: d.email, name: d.name, passwordHash: pw, role: "PROVIDER", emailVerifiedAt: new Date(), referralCode: d.slug.slice(0, 8).toUpperCase(), countryId: gh.id, cityId: d.city.id } });
    if (await db.providerProfile.findUnique({ where: { userId: user.id } })) continue;
    const parent = await cat(d.cat);
    const n = await hood(d.city.slug, d.hood);
    const p = await db.providerProfile.create({
      data: {
        userId: user.id, slug: d.slug, businessName: d.business, displayName: d.name, bio: `${d.name} has been serving clients in ${d.city.name} for years. Demo profile for development.`,
        yearsExperience: 6, countryId: gh.id, cityId: d.city.id, neighbourhoodId: n.id, timezone: gh.timezone, status: "APPROVED", approvedAt: new Date(), submittedAt: new Date(),
        offersStudio: true, offersHome: d.home, bookingMode: d.mode, contactPhone: "+233200000000", verificationConsent: true, minNoticeMinutes: 60,
        categories: { create: { categoryId: parent.id } },
        staff: { create: { name: d.name, isOwner: true, workingHours: { create: [1, 2, 3, 4, 5, 6].flatMap((wd) => [{ weekday: wd, startMinute: 540, endMinute: 780 }, { weekday: wd, startMinute: 840, endMinute: 1080 }]) } } },
      },
    });
    for (const [name, sub, price, dur] of d.services) {
      const sc = await cat(sub);
      await db.service.create({ data: { providerId: p.id, categoryId: parent.id, subcategoryId: sc.id, name, priceMinor: price, currency: "GHS", durationMinutes: dur, cleanupMinutes: 15, homeServiceAvailable: d.home, homeTravelFeeMinor: d.home ? 5000 : 0, description: `${name} by ${d.business}.` } });
    }
  }
  console.log("Demo data ready (password for all demo accounts: Password123)");
}
