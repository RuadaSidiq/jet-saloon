import Link from "next/link";
import { pageAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { Act, QuickForm } from "@/components/ui/act";
import { bannerAction, couponAction } from "@/app/actions/admin";
import { money } from "@/lib/format";
import { Badge, Card, PageHeader, Table } from "@/components/ui";

export default async function Promotions() {
  await pageAdmin("promotions.manage");
  const [coupons, banners, featured, currencies, countries] = await Promise.all([
    db.coupon.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { redemptions: true } }, provider: true } }),
    db.banner.findMany({ orderBy: [{ placement: "asc" }, { sortOrder: "asc" }] }),
    db.providerProfile.findMany({ where: { featured: true }, select: { id: true, businessName: true, featuredUntil: true } }),
    db.currency.findMany(), db.country.findMany(),
  ]);
  return (
    <>
      <PageHeader title="Promotions" />
      <div className="space-y-8">
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div><h2 className="mb-3 font-semibold">Promo codes</h2>
            <Table head={["Code", "Discount", "Scope", "Used", "Window", "State", ""]}>{coupons.map((c) => <tr key={c.id}><td className="font-mono font-medium">{c.code}</td><td>{c.kind === "PERCENT" ? `${c.value / 100}%` : money(c.value, c.currency!)}{c.maxDiscountMinor && c.currency ? ` (max ${money(c.maxDiscountMinor, c.currency)})` : ""}</td><td className="text-xs">{c.provider ? `${c.provider.businessName} (provider-funded)` : "Platform-funded"}</td><td className="tabular">{c._count.redemptions}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}</td><td className="text-xs">{c.startsAt.toLocaleDateString("en-GB")} – {c.endsAt?.toLocaleDateString("en-GB") ?? "open"}</td><td>{c.active ? <Badge tone="ok">Active</Badge> : <Badge>Off</Badge>}</td><td><Act action={couponAction} fields={{ toggle: c.id }} label={c.active ? "Disable" : "Enable"} variant="ghost" /></td></tr>)}</Table>
          </div>
          <Card title="New promo code">
            <QuickForm action={couponAction} resetOnSuccess submit="Create code" columns={1} fields={[
              { name: "code", label: "Code", required: true, placeholder: "WELCOME10" }, { name: "kind", label: "Type", type: "select", options: [["PERCENT", "Percentage"], ["FIXED", "Fixed amount"]] },
              { name: "value", label: "Value (% or amount)", required: true }, { name: "currency", label: "Currency (fixed only)", type: "select", options: [["", "—"], ...currencies.map((c) => [c.code, c.code] as [string, string])] },
              { name: "countryId", label: "Country", type: "select", options: [["", "All countries"], ...countries.map((c) => [c.id, c.name] as [string, string])] },
              { name: "maxRedemptions", label: "Total uses (optional)", type: "number" }, { name: "perUserLimit", label: "Uses per customer", type: "number", defaultValue: "1" },
              { name: "startsAt", label: "Starts", type: "date" }, { name: "endsAt", label: "Ends", type: "date" }, { name: "description", label: "Internal description" },
            ]} />
          </Card>
        </div>
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div><h2 className="mb-3 font-semibold">Homepage banners</h2>
            <Table head={["Title", "Placement", "Link", "State", ""]}>{banners.map((b) => <tr key={b.id}><td>{b.title}<div className="text-xs text-muted">{b.subtitle}</div></td><td>{b.placement}</td><td className="text-xs">{b.linkUrl}</td><td>{b.active ? <Badge tone="ok">Live</Badge> : <Badge>Off</Badge>}</td><td className="whitespace-nowrap"><Act action={bannerAction} fields={{ toggle: b.id }} label={b.active ? "Hide" : "Show"} variant="ghost" /><Act action={bannerAction} fields={{ delete: b.id }} label="Delete" variant="ghost" confirm="Delete banner?" /></td></tr>)}</Table>
          </div>
          <Card title="New banner"><QuickForm action={bannerAction} resetOnSuccess submit="Create banner" columns={1} fields={[{ name: "title", label: "Title", required: true }, { name: "subtitle", label: "Subtitle" }, { name: "linkUrl", label: "Link", placeholder: "/search?category=makeup-artists" }, { name: "image", label: "Image", type: "file" }, { name: "placement", label: "Placement", type: "select", options: [["HOME_HERO", "Homepage hero"]] }]} /></Card>
        </div>
        <Card title="Featured providers"><ul className="space-y-1 text-sm">{featured.length ? featured.map((f) => <li key={f.id}><Link className="text-brand" href={`/admin/providers/${f.id}`}>{f.businessName}</Link>{f.featuredUntil && <span className="text-muted"> until {f.featuredUntil.toLocaleDateString("en-GB")}</span>}</li>) : <li className="text-muted">None. Feature a provider from their admin page.</li>}</ul><p className="mt-3 text-xs text-muted">Featured categories are managed on the Categories page.</p></Card>
      </div>
    </>
  );
}
