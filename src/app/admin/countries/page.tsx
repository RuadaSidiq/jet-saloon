import { pageAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { QuickForm } from "@/components/ui/act";
import { cityAction, countryAction } from "@/app/actions/admin";
import { toMajorString } from "@/server/money";
import { allGateways } from "@/server/modules/payments/registry";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";

export default async function Countries() {
  await pageAdmin("settings.manage");
  const countries = await db.country.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { currency: true, cities: { orderBy: { name: "asc" }, include: { region: true, _count: { select: { neighbourhoods: true } } } } } });
  const gws = allGateways();
  return (
    <>
      <PageHeader title="Countries & currencies" />
      <div className="mb-6"><Notice tone="warn">Before activating a country, confirm with each payment gateway that it supports that country, currency, payment methods and payouts for your account. Gateway keys: {gws.map((g) => `${g.key}${g.configured ? " ✓" : ""}`).join(", ")}.</Notice></div>
      <div className="space-y-6">{countries.map((c) => (
        <Card key={c.id} title={<span className="flex items-center gap-2">{c.name} ({c.code}) {c.active ? <Badge tone="ok">Active</Badge> : <Badge>Inactive</Badge>}</span>} action={<span className="text-xs text-muted">{c.currency.code} · {c.currency.symbol} · {c.currency.minorUnits} decimals · {c.phoneCountryCode}</span>}>
          <QuickForm action={countryAction} hidden={{ id: c.id }} columns={3} fields={[
            { name: "active", label: "Active (visible and bookable)", type: "checkbox", defaultValue: String(c.active) },
            { name: "requiresIdDocument", label: "Require ID document for providers", type: "checkbox", defaultValue: String(c.requiresIdDocument) },
            { name: "timezone", label: "Timezone", defaultValue: c.timezone },
            { name: "paymentGateways", label: "Payment gateways (comma-separated, in priority order)", defaultValue: c.paymentGateways.join(", ") },
            { name: "payoutChannels", label: "Payout channels", defaultValue: c.payoutChannels.join(", "), hint: "MOBILE_MONEY, BANK" },
            { name: "phonePattern", label: "Phone number pattern (regex)", defaultValue: c.phonePattern },
            { name: "minPayout", label: `Minimum payout (${c.currency.code})`, defaultValue: toMajorString(c.minPayoutMinor, c.currency.minorUnits) },
            { name: "taxPercent", label: "Tax rate (%)", defaultValue: String(c.taxRateBps / 100) },
          ]} />
          <details className="mt-5 border-t border-line pt-4">
            <summary className="cursor-pointer text-sm font-medium">{c.cities.length} cities</summary>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-3">{c.cities.map((ci) => <li key={ci.id}>{ci.name} <span className="text-xs text-muted">{ci.region?.name} · {ci._count.neighbourhoods} areas</span></li>)}</ul>
            <div className="mt-4"><QuickForm action={cityAction} hidden={{ countryId: c.id }} resetOnSuccess submit="Add city / areas" columns={3} fields={[{ name: "name", label: "City", required: true }, { name: "region", label: "Region" }, { name: "neighbourhoods", label: "Neighbourhoods (comma-separated)" }]} /></div>
          </details>
        </Card>
      ))}</div>
    </>
  );
}
