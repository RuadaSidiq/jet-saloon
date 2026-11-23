import Link from "next/link";
import type { ProviderCard as P } from "@/server/modules/search";
import { money } from "@/lib/format";
import { Badge, btn } from "@/components/ui";


export function ProviderCard({ p }: { p: P }) {
  return (
    <article className="group flex flex-col overflow-hidden glass glass-hover rounded-3xl">
      <Link href={`/provider/${p.slug}`} className="relative block aspect-[4/3] shrink-0 overflow-hidden bg-brand-soft">
        {p.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.coverUrl} alt={`Work by ${p.businessName}`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center text-3xl font-semibold text-brand/40">{p.businessName.slice(0, 1)}</div>
        )}
        <span className="absolute left-3 top-3">{p.sample ? <Badge>Sample</Badge> : p.featured ? <Badge tone="brand">Featured</Badge> : <Badge tone="ok">✓ Verified</Badge>}</span>
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 truncate font-semibold"><Link href={`/provider/${p.slug}`} className="hover:text-brand">{p.businessName}</Link></h3>
          {p.ratingCount > 0 && <span className="flex shrink-0 items-center gap-1 text-sm"><span className="text-amber-500" aria-hidden>★</span><span className="tabular font-medium">{p.ratingAvg.toFixed(1)}</span></span>}
        </div>
        <p className="truncate text-sm text-muted">{[p.categories[0], p.location.split(", ").pop()].filter(Boolean).join(" · ")}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <p className="text-sm">{p.fromPriceMinor != null && <><span className="text-muted">From </span><span className="tabular font-semibold">{money(p.fromPriceMinor, p.currency)}</span></>}</p>
          <Link href={p.sample ? `/provider/${p.slug}` : `/book/${p.slug}`} className={btn({ variant: p.sample ? "secondary" : "primary", size: "sm" })}>{p.sample ? "View" : "Book"}</Link>
        </div>
      </div>
    </article>
  );
}
