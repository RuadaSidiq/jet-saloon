/**
 * Reference data (safe in every environment): currencies, countries, Ghana geography, categories,
 * admin roles, a default global commission rule, and a super admin from SEED_ADMIN_EMAIL/PASSWORD.
 * Demo providers/customers are created ONLY when SEED_DEMO=true and NODE_ENV !== production.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLES, PERMISSIONS } from "../src/server/rbac";

const db = new PrismaClient();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  for (const c of [
    { code: "GHS", name: "Ghanaian cedi", symbol: "GH₵", minorUnits: 2 },
    { code: "NGN", name: "Nigerian naira", symbol: "₦", minorUnits: 2 },
    { code: "KES", name: "Kenyan shilling", symbol: "KSh", minorUnits: 2 },
    { code: "ZAR", name: "South African rand", symbol: "R", minorUnits: 2 },
    { code: "UGX", name: "Ugandan shilling", symbol: "USh", minorUnits: 0 },
  ]) await db.currency.upsert({ where: { code: c.code }, update: {}, create: c });

  const countries = [
    { code: "GH", name: "Ghana", currencyCode: "GHS", timezone: "Africa/Accra", phoneCountryCode: "+233", phonePattern: "[235]\\d{8}", active: true, paymentGateways: ["paystack"], payoutChannels: ["MOBILE_MONEY", "BANK"], minPayoutMinor: 5000 },
    { code: "NG", name: "Nigeria", currencyCode: "NGN", timezone: "Africa/Lagos", phoneCountryCode: "+234", phonePattern: "[789]\\d{9}", active: false, paymentGateways: ["paystack", "flutterwave"], payoutChannels: ["BANK"], minPayoutMinor: 500000 },
    { code: "KE", name: "Kenya", currencyCode: "KES", timezone: "Africa/Nairobi", phoneCountryCode: "+254", phonePattern: "[17]\\d{8}", active: false, paymentGateways: ["paystack", "flutterwave"], payoutChannels: ["MOBILE_MONEY", "BANK"], minPayoutMinor: 50000 },
    { code: "ZA", name: "South Africa", currencyCode: "ZAR", timezone: "Africa/Johannesburg", phoneCountryCode: "+27", phonePattern: "[6-8]\\d{8}", active: false, paymentGateways: ["paystack"], payoutChannels: ["BANK"], minPayoutMinor: 10000 },
  ];
  for (const c of countries) await db.country.upsert({ where: { code: c.code }, update: {}, create: c });
  const gh = await db.country.findUniqueOrThrow({ where: { code: "GH" } });

  const geo: Record<string, Record<string, string[]>> = {
    "Greater Accra": { Accra: ["East Legon", "Osu", "Airport Residential", "Cantonments", "Labone", "Spintex", "Dansoman", "Madina", "Adenta", "Achimota"], Tema: ["Community 25", "Community 1", "Sakumono"] },
    Ashanti: { Kumasi: ["Adum", "Ahodwo", "Asokwa", "Bantama", "Nhyiaeso"] },
    Western: { Takoradi: ["Market Circle", "Anaji"] },
    Central: { "Cape Coast": ["Abura", "Pedu"] },
    Northern: { Tamale: ["Lamashegu", "Vittin"] },
  };
  for (const [region, cities] of Object.entries(geo)) {
    const r = await db.region.upsert({ where: { countryId_name: { countryId: gh.id, name: region } }, update: {}, create: { countryId: gh.id, name: region } });
    for (const [city, hoods] of Object.entries(cities)) {
      const c = await db.city.upsert({ where: { countryId_slug: { countryId: gh.id, slug: slug(city) } }, update: {}, create: { countryId: gh.id, regionId: r.id, name: city, slug: slug(city) } });
      for (const h of hoods) await db.neighbourhood.upsert({ where: { cityId_slug: { cityId: c.id, slug: slug(h) } }, update: {}, create: { cityId: c.id, name: h, slug: slug(h) } });
    }
  }

  const cats: [string, string, string[]][] = [
    ["Makeup Artists", "palette", ["Bridal makeup", "Party makeup", "Natural makeup", "Photoshoot makeup", "Editorial makeup"]],
    ["Barbers", "scissors", ["Haircuts", "Beard grooming", "Hairline enhancement", "Hair treatments"]],
    ["Hair Stylists", "sparkles", ["Braiding", "Wig installation", "Silk press", "Locs", "Hair colouring"]],
    ["Lash Technicians", "eye", ["Classic lashes", "Volume lashes", "Lash lift"]],
    ["Nail Technicians", "hand", ["Manicure", "Pedicure", "Acrylic nails", "Gel nails", "Nail art"]],
    ["Skincare Specialists", "droplet", ["Facials", "Chemical peels", "Acne treatment"]],
    ["Eyebrow Technicians", "brush", ["Brow shaping", "Microblading", "Brow tint"]],
    ["Massage Therapists", "heart-handshake", ["Swedish massage", "Deep tissue", "Hot stone"]],
    ["Spa Therapists", "flower", ["Body scrub", "Spa packages"]],
    ["Waxing Specialists", "feather", ["Full body wax", "Brazilian wax", "Facial wax"]],
    ["Tattoo Artists", "pen-tool", ["Fine line", "Cover-ups"]],
    ["Other Beauty Services", "star", []],
  ];
  for (const [i, [name, icon, subs]] of cats.entries()) {
    const parent = await db.category.upsert({ where: { slug: slug(name) }, update: {}, create: { name, slug: slug(name), icon, sortOrder: i, featured: i < 8 } });
    for (const [j, s] of subs.entries()) await db.category.upsert({ where: { slug: slug(s) }, update: {}, create: { name: s, slug: slug(s), parentId: parent.id, sortOrder: j } });
  }

  for (const r of DEFAULT_ROLES) await db.adminRole.upsert({ where: { key: r.key }, update: { permissions: r.permissions }, create: { ...r, system: true } });
  await db.adminRole.upsert({ where: { key: "super_admin" }, update: {}, create: { key: "super_admin", name: "Super Admin", permissions: Object.keys(PERMISSIONS), system: true } });

  if (!(await db.commissionRule.findFirst({ where: { scope: "GLOBAL" } }))) {
    await db.commissionRule.create({ data: { scope: "GLOBAL", rateBps: 1500, effectiveFrom: new Date("2024-01-01"), note: "Launch default 15%" } });
  }

  const email = process.env.SEED_ADMIN_EMAIL;
  const pw = process.env.SEED_ADMIN_PASSWORD;
  if (email && pw) {
    await db.user.upsert({
      where: { email },
      update: {},
      create: { email, name: "Super Admin", passwordHash: await bcrypt.hash(pw, 12), role: "ADMIN", isSuperAdmin: true, emailVerifiedAt: new Date(), referralCode: "ADMIN0001", countryId: gh.id },
    });
    console.log(`Super admin ready: ${email}`);
  }

  if (process.env.SEED_DEMO === "true" && process.env.NODE_ENV !== "production") {
    const { seedDemo } = await import("./seed-demo");
    await seedDemo(db);
  }
}

main().finally(() => db.$disconnect());
