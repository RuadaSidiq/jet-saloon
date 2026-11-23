import { notFound } from "next/navigation";
import { pageProvider } from "@/server/auth/guards";
import { db } from "@/server/db";
import { toMajorString } from "@/server/money";
import { ServiceForm } from "@/components/business/service-form";
import { formData } from "@/components/business/data";
import { Card, Notice, PageHeader } from "@/components/ui";

export default async function EditService({ params }: { params: Promise<{ id: string }> }) {
  const { provider } = await pageProvider("/business/services");
  const s = await db.service.findFirst({ where: { id: (await params).id, providerId: provider.id, deletedAt: null } });
  if (!s) notFound();
  const cur = await db.currency.findUniqueOrThrow({ where: { code: s.currency } });
  const { categories } = await formData();
  const m = (v: number | null) => (v == null ? undefined : toMajorString(v, cur.minorUnits));
  return (<><PageHeader title={`Edit ${s.name}`} />
    <div className="mb-4"><Notice>Changes apply to new bookings. Existing bookings keep the price and details they were made with.</Notice></div>
    <Card><ServiceForm categories={categories} currencySymbol={cur.symbol} offersHome={provider.offersHome} initial={{ ...s, price: m(s.priceMinor), promoPrice: m(s.promoPriceMinor), homeTravelFee: s.homeTravelFeeMinor ? m(s.homeTravelFeeMinor) : undefined }} /></Card></>);
}
