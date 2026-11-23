import { notFound } from "next/navigation";
import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { QuickForm } from "@/components/ui/act";
import { ticketReplyAction } from "@/app/actions/booking";
import { Card, PageHeader, StatusBadge } from "@/components/ui";

export default async function Ticket({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const user = await pageUser(`/account/support/${ref}`);
  const t = await db.supportTicket.findUnique({ where: { reference: ref }, include: { messages: { where: { internal: false }, orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, role: true } } } } } });
  if (!t || t.userId !== user.id) notFound();
  return (
    <>
      <PageHeader title={t.subject} description={`Ticket ${t.reference}`} actions={<StatusBadge status={t.status} />} />
      <Card>
        <ul className="space-y-4">{t.messages.map((m) => (
          <li key={m.id} className={m.author.id === user.id ? "" : "rounded-2xl bg-brand-soft p-3"}>
            <p className="text-xs text-muted">{m.author.id === user.id ? "You" : "Jet Saloon support"} · {m.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
            <p className="mt-1 whitespace-pre-line text-sm">{m.body}</p>
          </li>
        ))}</ul>
        {t.resolution && <p className="mt-4 rounded-2xl bg-ok-soft p-3 text-sm text-ok">Resolution: {t.resolution}</p>}
        {t.status !== "CLOSED" && <div className="mt-6 border-t border-line pt-4"><QuickForm action={ticketReplyAction} hidden={{ ticketId: t.id }} resetOnSuccess submit="Send reply" columns={1} fields={[{ name: "body", label: "Reply", type: "textarea", required: true }]} /></div>}
      </Card>
    </>
  );
}
