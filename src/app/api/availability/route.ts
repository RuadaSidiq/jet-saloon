import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { computeSlots, planFor } from "@/server/modules/availability";
import { rateLimit } from "@/server/ratelimit";

/** GET /api/availability?provider=<id>&services=a,b&date=YYYY-MM-DD[&staff=<id>] — public, read-only. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  try {
    rateLimit(`avail:${req.headers.get("x-forwarded-for") ?? "local"}`, 120, 60);
  } catch {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const providerId = u.searchParams.get("provider") ?? "";
  const ids = (u.searchParams.get("services") ?? "").split(",").filter(Boolean).slice(0, 5);
  const date = u.searchParams.get("date") ?? "";
  const services = await db.service.findMany({ where: { id: { in: ids }, providerId, active: true, deletedAt: null } });
  if (!services.length || services.length !== ids.length || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ slots: [] });
  const slots = await computeSlots({ providerId, date, plan: planFor(services), staffId: u.searchParams.get("staff") || undefined });
  return NextResponse.json({ slots: slots.map((s) => ({ startsAt: s.startsAt, endsAt: s.endsAt })) }, { headers: { "Cache-Control": "no-store" } });
}
