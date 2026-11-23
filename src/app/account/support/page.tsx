import Link from "next/link";
import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { Empty, PageHeader, StatusBadge, Table, btn } from "@/components/ui";

export default async function Support() {
  const user = await pageUser("/account/support");
  const tickets = await db.supportTicket.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
  return (
    <>
      <PageHeader title="Support" actions={<Link href="/account/support/new" className={btn()}>New ticket</Link>} />
      {tickets.length === 0 ? <Empty title="No support tickets" body="If something goes wrong with a booking or payment, open a ticket and our team will help." /> : (
        <Table head={["Reference", "Subject", "Category", "Status", "Updated"]}>
          {tickets.map((t) => <tr key={t.id}><td><Link className="text-brand" href={`/account/support/${t.reference}`}>{t.reference}</Link></td><td>{t.subject}</td><td>{t.category.toLowerCase().replace(/_/g, " ")}</td><td><StatusBadge status={t.status} /></td><td>{t.updatedAt.toLocaleDateString("en-GB")}</td></tr>)}
        </Table>
      )}
    </>
  );
}
