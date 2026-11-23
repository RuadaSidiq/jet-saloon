import { pageProvider } from "@/server/auth/guards";
import { db } from "@/server/db";
import { Act, QuickForm } from "@/components/ui/act";
import { bookingSettingsAction, serviceAreaAction } from "@/app/actions/business";
import { money } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui";
export default async function BookingSettings() {
  const { provider: p } = await pageProvider("/business/settings");
  const [areas, cities, cur] = await Promise.all([db.serviceArea.findMany({ where: { providerId: p.id }, include: { city: true } }), db.city.findMany({ where: { countryId: p.countryId, active: true }, orderBy: { name: "asc" } }), db.currency.findFirstOrThrow({ where: { countries: { some: { id: p.countryId } } } })]);
  return (<><PageHeader title="Booking settings" />
    <div className="space-y-6">
      <Card title="How customers book you">
        <QuickForm action={bookingSettingsAction} fields={[
          { name: "bookingMode", label: "Booking mode", type: "select", defaultValue: p.bookingMode, options: [["INSTANT", "Instant — confirmed when the customer pays"], ["APPROVAL", "Approval — I accept each request before the customer pays"]], full: true },
          { name: "minNoticeMinutes", label: "Minimum notice (minutes)", type: "number", defaultValue: String(p.minNoticeMinutes), hint: "e.g. 120 = at least 2 hours ahead" },
          { name: "maxAdvanceDays", label: "Book up to (days ahead)", type: "number", defaultValue: String(p.maxAdvanceDays) },
          { name: "slotStepMinutes", label: "Start times every (minutes)", type: "number", defaultValue: String(p.slotStepMinutes) },
          { name: "freeCancelHours", label: "Free cancellation up to (hours before)", type: "number", defaultValue: String(p.freeCancelHours) },
          { name: "cancellationPolicy", label: "Your booking policy (shown on your profile)", type: "textarea", defaultValue: p.cancellationPolicy ?? "" },
        ]} />
      </Card>
      {p.offersHome && <Card title="Home-service areas & travel fees">
        {areas.length > 0 && <ul className="mb-4 space-y-2 text-sm">{areas.map((a) => <li key={a.id} className="flex items-center justify-between rounded border border-line px-3 py-2"><span>{a.city.name} · travel fee {money(a.travelFeeMinor, cur)}</span><Act action={serviceAreaAction} fields={{ delete: a.id }} label="Remove" variant="ghost" /></li>)}</ul>}
        <QuickForm action={serviceAreaAction} resetOnSuccess submit="Add area" fields={[{ name: "cityId", label: "City", type: "select", options: cities.map((c) => [c.id, c.name]) }, { name: "fee", label: "Travel fee", placeholder: "0" }]} />
        <p className="mt-3 text-xs text-muted">If you list areas, home bookings are only accepted in those cities.</p>
      </Card>}
    </div></>);
}
