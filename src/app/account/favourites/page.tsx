import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import Link from "next/link";
import { Act } from "@/components/ui/act";
import { toggleFavouriteAction } from "@/app/actions/booking";
import { Empty, PageHeader, btn } from "@/components/ui";

export default async function Favourites() {
  const user = await pageUser("/account/favourites");
  const favs = await db.favourite.findMany({ where: { customerId: user.id }, include: { provider: { include: { city: true } } }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Favourites" />
      {favs.length === 0 ? <Empty title="No saved professionals" body="Tap Save on a professional's profile to find them quickly later." action={<Link href="/search" className={btn({ size: "sm" })}>Browse professionals</Link>} /> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {favs.map((f) => (
            <li key={f.providerId} className="flex items-center gap-3 glass rounded-2xl p-4">
              <div className="flex-1"><Link href={`/provider/${f.provider.slug}`} className="font-medium hover:text-brand">{f.provider.businessName}</Link><p className="text-sm text-muted">{f.provider.city?.name}{f.provider.status !== "APPROVED" && " · currently unavailable"}</p></div>
              {f.provider.status === "APPROVED" && <Link href={`/book/${f.provider.slug}`} className={btn({ size: "sm" })}>Book</Link>}
              <Act action={toggleFavouriteAction} fields={{ providerId: f.providerId }} label="Remove" variant="ghost" />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
