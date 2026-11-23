import { NextResponse } from "next/server";
import { runAllJobs } from "@/server/modules/jobs";
import { safeEqual } from "@/server/crypto";

/** For platforms with HTTP cron (e.g. Vercel Cron): GET/POST with `Authorization: Bearer $CRON_SECRET`. */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || !safeEqual(secret, got)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runAllJobs());
}
export { handle as GET, handle as POST };
