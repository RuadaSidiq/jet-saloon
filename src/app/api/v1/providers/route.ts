import { NextResponse } from "next/server";
import { searchProviders } from "@/server/modules/search";

/** Public JSON search API for mobile apps: same discovery engine as the website. */
export async function GET(req: Request) {
  const s = new URL(req.url).searchParams;
  const r = await searchProviders({
    q: s.get("q") ?? undefined, country: s.get("country") ?? undefined, city: s.get("city") ?? undefined, area: s.get("area") ?? undefined,
    category: s.get("category") ?? undefined, rating: s.get("rating") ? Number(s.get("rating")) : undefined, home: s.get("home") === "1",
    sort: (s.get("sort") as "rating") ?? undefined, page: Number(s.get("page") ?? 1),
    lat: s.get("lat") ? Number(s.get("lat")) : undefined, lng: s.get("lng") ? Number(s.get("lng")) : undefined,
  });
  return NextResponse.json({ ...r, results: r.results.map(({ latitude: _a, longitude: _b, ...rest }) => rest) });
}
