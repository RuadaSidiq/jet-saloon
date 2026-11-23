import { pageProvider } from "@/server/auth/guards";
import { db } from "@/server/db";
import { PortfolioManager } from "@/components/business/sections";
import { Card, PageHeader } from "@/components/ui";
export default async function Portfolio() {
  const { provider } = await pageProvider("/business/portfolio");
  const items = await db.portfolioItem.findMany({ where: { providerId: provider.id }, orderBy: { sortOrder: "asc" } });
  return <><PageHeader title="Portfolio" /><Card><PortfolioManager items={items} /></Card></>;
}
