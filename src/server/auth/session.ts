import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "../db";
import { randomToken, sha256 } from "../crypto";
import type { User } from "@prisma/client";

export const SESSION_COOKIE = "js_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string) {
  const token = randomToken();
  const h = await headers();
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5),
      ip: h.get("x-forwarded-for")?.split(",")[0] ?? null,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return token;
}

export async function destroySession() {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  c.delete(SESSION_COOKIE);
}

export async function userFromToken(token: string | undefined | null): Promise<User | null> {
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date() || s.user.status !== "ACTIVE") return null;
  if (Date.now() - s.lastSeenAt.getTime() > 15 * 60_000) {
    await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return s.user;
}

/** Current user from cookie (web) or `Authorization: Bearer` (mobile/API clients). Cached per request. */
export const currentUser = cache(async (): Promise<User | null> => {
  const c = await cookies();
  const cookieToken = c.get(SESSION_COOKIE)?.value;
  if (cookieToken) return userFromToken(cookieToken);
  const auth = (await headers()).get("authorization");
  if (auth?.startsWith("Bearer ")) return userFromToken(auth.slice(7));
  return null;
});
