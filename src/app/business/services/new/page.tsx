import { pageProvider } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ServiceForm } from "@/components/business/service-form";
import { formData } from "@/components/business/data";
import { Card, PageHeader } from "@/components/ui";

export default async function NewService() {
  const { provider } = await pageProvider("/business/services/new");
  const cur = await db.currency.findFirstOrThrow({ where: { countries: { some: { id: provider.countryId } } } });
  const { categories } = await formData();
  return <><PageHeader title="Add a service" /><Card><ServiceForm categories={categories} currencySymbol={cur.symbol} offersHome={provider.offersHome} /></Card></>;
}
