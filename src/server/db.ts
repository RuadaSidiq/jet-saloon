import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
/** Neon's pooler runs PgBouncer in transaction mode; tell Prisma so prepared statements are handled correctly. */
function datasourceUrl() {
  const url = process.env.DATABASE_URL;
  if (!url || !url.includes("-pooler.") || url.includes("pgbouncer=")) return undefined;
  return url + (url.includes("?") ? "&" : "?") + "pgbouncer=true";
}
export const db = g.prisma ?? new PrismaClient({ datasourceUrl: datasourceUrl() });
if (process.env.NODE_ENV !== "production") g.prisma = db;

export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
