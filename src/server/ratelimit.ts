/**
 * Fixed-window rate limiter backed by Postgres, so limits hold across every serverless instance.
 * One atomic upsert per check. Keys are SHA-256 hashed so emails/IPs aren't stored in clear.
 */
import { db } from "./db";
import { sha256 } from "./crypto";
import { AppError } from "./errors";

export async function rateLimit(key: string, limit: number, windowSec: number) {
  const k = sha256(key);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${k}, 1, now() + make_interval(secs => ${windowSec}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimitBucket"."resetAt" < now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" < now() THEN now() + make_interval(secs => ${windowSec}) ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count"`;
  if ((rows[0]?.count ?? 0) > limit) throw new AppError("RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.", 429);
}

/** Housekeeping for the worker. */
export async function purgeExpiredRateLimits() {
  const r = await db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 3600_000) } } });
  return r.count;
}
