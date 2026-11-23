import Link from "next/link";
import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { Act } from "@/components/ui/act";
import { markNotificationsReadAction } from "@/app/actions/account";
import { Empty, PageHeader } from "@/components/ui";

export default async function Notifications() {
  const user = await pageUser("/account/notifications");
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <PageHeader title="Notifications" actions={items.some((n) => !n.readAt) && <Act action={markNotificationsReadAction} fields={{}} label="Mark all as read" />} />
      {items.length === 0 ? <Empty title="You're all caught up" /> : (
        <ul className="divide-y divide-line glass rounded-(--radius-card)">
          {items.map((n) => (
            <li key={n.id} className={`flex gap-3 px-4 py-3 ${n.readAt ? "" : "bg-brand-soft/50"}`}>
              {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
              <div className="flex-1">
                <p className="text-sm font-medium">{n.link ? <Link href={n.link} className="hover:text-brand">{n.title}</Link> : n.title}</p>
                <p className="text-sm text-muted">{n.body}</p>
              </div>
              <time className="shrink-0 text-xs text-muted">{n.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</time>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
