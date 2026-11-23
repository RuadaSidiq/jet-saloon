/**
 * Fixed-window rate limiter. In-memory per instance — adequate for a single node.
 * For multiple instances, back this with Redis (REDIS_URL) — see docs/DEPLOYMENT.md.
 */
import { AppError } from "./errors";
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowSec: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return;
  }
  if (++b.count > limit) throw new AppError("RATE_LIMITED", "Too many attempts. Please wait a moment and try again.", 429);
}
export function resetRateLimits() {
  buckets.clear();
}
