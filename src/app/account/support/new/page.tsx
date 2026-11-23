import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { QuickForm } from "@/components/ui/act";
import { openTicketAction } from "@/app/actions/booking";
import { TICKET_CATEGORIES } from "@/server/modules/support";
import { Card, PageHeader } from "@/components/ui";

export default async function NewTicket({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const user = await pageUser("/account/support/new");
  const { booking } = await searchParams;
  const bookings = await db.booking.findMany({ where: { OR: [{ customerId: user.id }, { provider: { userId: user.id } }] }, orderBy: { createdAt: "desc" }, take: 30, select: { reference: true, providerNameSnapshot: true } });
  return (
    <>
      <PageHeader title="Open a support ticket" />
      <Card>
        <QuickForm action={openTicketAction} submit="Submit ticket" fields={[
          { name: "subject", label: "Subject", required: true, full: true },
          { name: "category", label: "Category", type: "select", options: TICKET_CATEGORIES.map((c) => [c, c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, " ")]) },
          { name: "bookingRef", label: "Related booking (optional)", type: "select", defaultValue: booking ?? "", options: [["", "None"], ...bookings.map((b) => [b.reference, `${b.reference} · ${b.providerNameSnapshot}`] as [string, string])] },
          { name: "body", label: "What happened?", type: "textarea", required: true },
        ]} />
      </Card>
    </>
  );
}
