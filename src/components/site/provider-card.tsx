import Link from "next/link";
import type { ProviderCard as P } from "@/server/modules/search";
import { money } from "@/lib/format";
import { Badge, Stars, btn } from "@/components/ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ProviderCard({ p }: { p: P }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-[--radius-card] border border-line bg-white transition-shadow hover:shadow-[0_6px_24px_-12px_rgba(18,61,117,.35)]">
      <Link href={`/provider/${p.slug}`} className="relative block aspect-[4/3] bg-brand-soft">
        {p.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.coverUrl} alt={`Work by ${p.businessName}`} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center text-3xl font-semibold text-brand/40">{p.businessName.slice(0, 1)}</div>
        )}
        {p.featured && <span className="absolute left-3 top-3"><Badge tone="brand">Featured</Badge></span>}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          {p.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
          ) : <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{p.displayName.slice(0, 1)}</div>}
          <div className="min-w-0">
            <h3 className="truncate font-semibold"><Link href={`/provider/${p.slug}`} className="hover:text-brand">{p.businessName}</Link></h3>
            <p className="flex items-center gap-1 text-xs text-ok"><span aria-hidden>✓</span> Verified professional</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">{p.categories.slice(0, 2).join(" · ")}{p.location && ` — ${p.location}`}</p>
        <div className="mt-2 flex items-center gap-2 text-sm">
          {p.ratingCount > 0 ? <><Stars value={p.ratingAvg} /><span className="tabular">{p.ratingAvg.toFixed(1)}</span><span className="text-muted">({p.ratingCount})</span></> : <span className="text-muted">New on Jet Saloon</span>}
        </div>
        <p className="mt-1 text-xs text-muted">{p.openDays.length ? `Open ${p.openDays.map((d) => DAYS[d]).join(", ")}` : "Availability on profile"}{p.offersHome && " · Home service"}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div className="text-sm">{p.fromPriceMinor != null && <><span className="text-muted">From </span><span className="tabular font-semibold">{money(p.fromPriceMinor, p.currency)}</span></>}</div>
          <div className="flex gap-2">
            <Link href={`/provider/${p.slug}`} className={btn({ variant: "secondary", size: "sm" })}>Profile</Link>
            <Link href={`/book/${p.slug}`} className={btn({ size: "sm" })}>Book now</Link>
          </div>
        </div>
      </div>
    </article>
  );
}
