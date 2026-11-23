import Link from "next/link";
import { pageProvider } from "@/server/auth/guards";
import { db } from "@/server/db";
import { Act } from "@/components/ui/act";
import { serviceToggleAction } from "@/app/actions/business";
import { money } from "@/lib/format";
import { Badge, PageHeader, Table, btn } from "@/components/ui";

export default async function Services() {
  const { provider } = await pageProvider("/business/services");
  const services = await db.service.findMany({ where: { providerId: provider.id, deletedAt: null }, orderBy: [{ active: "desc" }, { name: "asc" }], include: { category: true, subcategory: true, _count: { select: { bookingItems: true } } } });
  return (
    <>
      <PageHeader title="Services" description="Prices and durations here drive your availability and checkout." actions={<Link href="/business/services/new" className={btn()}>Add service</Link>} />
      <Table head={["Service", "Category", "Price", "Duration", "Bookings", "Status", ""]} empty="No services yet — add your first one.">
        {services.map((s) => (
          <tr key={s.id}>
            <td><Link href={`/business/services/${s.id}`} className="font-medium hover:text-brand">{s.name}</Link>{s.homeServiceAvailable && <span className="ml-2 text-xs text-muted">Home</span>}</td>
            <td className="text-muted">{s.category.name}{s.subcategory && ` · ${s.subcategory.name}`}</td>
            <td className="tabular">{s.promoPriceMinor != null ? <><span className="text-muted line-through">{money(s.priceMinor, s.currency)}</span> {money(s.promoPriceMinor, s.currency)}</> : money(s.priceMinor, s.currency)}</td>
            <td>{s.durationMinutes} min{(s.prepMinutes || s.cleanupMinutes) ? <span className="text-xs text-muted"> (+{s.prepMinutes + s.cleanupMinutes} buffer)</span> : null}</td>
            <td className="tabular">{s._count.bookingItems}</td>
            <td>{s.active ? <Badge tone="ok">Active</Badge> : <Badge>Inactive</Badge>}</td>
            <td className="space-x-1 whitespace-nowrap text-right">
              <Act action={serviceToggleAction} fields={{ id: s.id, op: "toggle" }} label={s.active ? "Deactivate" : "Activate"} variant="ghost" />
              <Act action={serviceToggleAction} fields={{ id: s.id, op: "delete" }} label="Delete" variant="ghost" confirm="Delete this service? Past bookings keep their records." />
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
