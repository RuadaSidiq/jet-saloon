import { db } from "@/server/db";
import { currentUser } from "@/server/auth/session";
import { hasPermission } from "@/server/auth/guards";
import { audit } from "@/server/audit";
import { readStored } from "@/server/storage";

/** Private verification documents: only the owning provider or staff with `providers.documents`. Every admin view is audited. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const doc = await db.providerDocument.findUnique({ where: { id }, include: { provider: true } });
  if (!doc) return new Response("Not found", { status: 404 });
  const owner = doc.provider.userId === user.id;
  const staff = !owner && (await hasPermission(user.id, "providers.documents"));
  if (!owner && !staff) return new Response("Not found", { status: 404 });
  if (staff) await audit({ actorId: user.id, action: "document.view", entityType: "ProviderDocument", entityId: doc.id });
  const buf = await readStored("private", doc.storageKey);
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": doc.mimeType, "Content-Disposition": `inline; filename="${doc.fileName.replace(/[^\w.-]/g, "_")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
