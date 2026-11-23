import { pageProvider } from "@/server/auth/guards";
import { db } from "@/server/db";
import { BasicsForm } from "@/components/business/basics-form";
import { formData } from "@/components/business/data";
import { Card, PageHeader } from "@/components/ui";

export default async function Profile() {
  const { provider } = await pageProvider("/business/profile");
  const p = await db.providerProfile.findUniqueOrThrow({ where: { id: provider.id }, include: { categories: true } });
  const { countries, categories } = await formData();
  return (<><PageHeader title="Business profile" description="This is what customers see on your public page." />
    <Card><BasicsForm countries={countries} categories={categories} initial={{ ...p, studioAddress: p.studioAddress ?? "", bio: p.bio ?? "", contactPhone: p.contactPhone ?? "", neighbourhoodId: p.neighbourhoodId ?? "", cityId: p.cityId ?? "", categoryIds: p.categories.map((c) => c.categoryId) }} /></Card></>);
}
