import { db, type Tx } from "./db";
import type { Prisma } from "@prisma/client";

export async function audit(
  entry: { actorId?: string | null; action: string; entityType: string; entityId?: string | null; metadata?: Prisma.InputJsonValue; ip?: string | null },
  tx: Tx = db,
) {
  await tx.auditLog.create({ data: { ...entry, actorId: entry.actorId ?? null } });
}
