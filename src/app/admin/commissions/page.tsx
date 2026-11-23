import { pageAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { QuickForm } from "@/components/ui/act";
import { commissionRuleAction } from "@/app/actions/admin";
import { getSetting } from "@/server/modules/settings";
import { Badge, Card, Notice, PageHeader, Table } from "@/components/ui";

export default async function Commissions() {
  await pageAdmin("finance.commissions");
  const [rules, countries, categories, providers, fallback] = await Promise.all([
    db.commissionRule.findMany({ orderBy: [{ scope: "asc" }, { effectiveFrom: "desc" }], include: { country: true, category: true, provider: true } }),
    db.country.findMany({ orderBy: { name: "asc" } }), db.category.findMany({ where: { parentId: null }, orderBy: { sortOrder: "asc" } }),
    db.providerProfile.findMany({ where: { status: "APPROVED" }, orderBy: { businessName: "asc" }, select: { id: true, businessName: true } }), getSetting("finance.defaultCommissionBps"),
  ]);
  const now = new Date();
  return (
    <>
      <PageHeader title="Commissions" description="Most specific rule wins: provider → category → country → global." />
      <div className="mb-6"><Notice>Each booking stores the rate in force when it was made. New rules never change existing bookings. Fallback when no rule matches: {fallback / 100}%.</Notice></div>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Table head={["Scope", "Applies to", "Rate", "Effective from", "Until", "State", "Note"]}>
          {rules.map((r) => {
            const live = r.effectiveFrom <= now && (!r.effectiveTo || r.effectiveTo > now);
            return <tr key={r.id}><td>{r.scope.toLowerCase()}</td><td>{r.provider?.businessName ?? r.category?.name ?? r.country?.name ?? "Everyone"}</td><td className="tabular font-medium">{(r.rateBps / 100).toFixed(2)}%</td><td>{r.effectiveFrom.toLocaleDateString("en-GB")}</td><td>{r.effectiveTo?.toLocaleDateString("en-GB") ?? "—"}</td><td>{live ? <Badge tone="ok">In force</Badge> : r.effectiveFrom > now ? <Badge tone="brand">Scheduled</Badge> : <Badge>Ended</Badge>}</td><td className="text-xs text-muted">{r.note}</td></tr>;
          })}
        </Table>
        <Card title="New rule">
          <QuickForm action={commissionRuleAction} resetOnSuccess submit="Create rule" columns={1} fields={[
            { name: "scope", label: "Scope", type: "select", options: [["GLOBAL", "Global default"], ["COUNTRY", "Country"], ["CATEGORY", "Category"], ["PROVIDER", "Provider"]] },
            { name: "countryId", label: "Country (for country scope)", type: "select", options: [["", "—"], ...countries.map((c) => [c.id, c.name] as [string, string])] },
            { name: "categoryId", label: "Category (for category scope)", type: "select", options: [["", "—"], ...categories.map((c) => [c.id, c.name] as [string, string])] },
            { name: "providerId", label: "Provider (for provider scope)", type: "select", options: [["", "—"], ...providers.map((p) => [p.id, p.businessName] as [string, string])] },
            { name: "percent", label: "Rate (%)", required: true, placeholder: "15" },
            { name: "effectiveFrom", label: "Effective from", type: "datetime-local", hint: "Leave empty for immediately" },
            { name: "note", label: "Note" },
          ]} />
        </Card>
      </div>
    </>
  );
}
