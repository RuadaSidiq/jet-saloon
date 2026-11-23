import type { Metadata } from "next";
import { db } from "@/server/db";
import { searchProviders, type SearchParams } from "@/server/modules/search";
import { toMinor } from "@/server/money";
import { ProviderCard } from "@/components/site/provider-card";
import { Empty, Pagination, btn, inputCls } from "@/components/ui";

export const metadata: Metadata = { title: "Find beauty professionals" };

type SP = Record<string, string | undefined>;

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [countries, categories] = await Promise.all([
    db.country.findMany({ where: { active: true }, include: { currency: true, cities: { where: { active: true }, orderBy: { name: "asc" }, include: { neighbourhoods: { orderBy: { name: "asc" } } } } } }),
    db.category.findMany({ where: { active: true, parentId: null }, orderBy: { sortOrder: "asc" }, include: { children: { where: { active: true }, orderBy: { sortOrder: "asc" } } } }),
  ]);
  const country = countries.find((c) => c.code === (sp.country ?? "").toUpperCase()) ?? countries[0];
  const city = country?.cities.find((c) => c.slug === sp.city);
  const mu = country?.currency.minorUnits ?? 2;
  const price = (v?: string) => { try { return v ? toMinor(v, mu) : undefined; } catch { return undefined; } };
  const params: SearchParams = {
    q: sp.q, country: sp.country, city: sp.city, area: sp.area, category: sp.category, service: sp.service,
    minPrice: price(sp.min), maxPrice: price(sp.max), rating: sp.rating ? Number(sp.rating) : undefined,
    home: sp.home === "1", studio: sp.studio === "1", sort: (sp.sort as SearchParams["sort"]) ?? "relevance", page: Number(sp.page ?? 1) || 1,
    lat: sp.lat ? Number(sp.lat) : undefined, lng: sp.lng ? Number(sp.lng) : undefined,
  };
  const res = await searchProviders(params);
  const qs = (patch: SP) => "/search?" + new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]).toString();
  const heading = sp.q ? `Results for “${sp.q}”` : sp.category ? categories.flatMap((c) => [c, ...c.children]).find((c) => c.slug === sp.category)?.name ?? "Professionals" : "All professionals";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <form className="rounded-[--radius-card] border border-line bg-white p-3" action="/search">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input name="q" defaultValue={sp.q} placeholder="Service, professional or “lashes in East Legon”" className={inputCls + " h-11 flex-1"} aria-label="Search" />
          <button className={btn({ size: "lg" })}>Search</button>
        </div>
        <details className="mt-3 group" open={!!(sp.city || sp.category || sp.min || sp.max || sp.rating || sp.home || sp.studio)}>
          <summary className="cursor-pointer text-sm font-medium text-brand">Filters</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {countries.length > 1 && <select name="country" defaultValue={sp.country ?? ""} className={inputCls} aria-label="Country"><option value="">Any country</option>{countries.map((c) => <option key={c.id} value={c.code}>{c.name}</option>)}</select>}
            <select name="city" defaultValue={sp.city ?? ""} className={inputCls} aria-label="City"><option value="">Any city</option>{countries.flatMap((c) => c.cities).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select>
            <select name="area" defaultValue={sp.area ?? ""} className={inputCls} aria-label="Neighbourhood" disabled={!city}><option value="">{city ? "Any neighbourhood" : "Choose a city first"}</option>{city?.neighbourhoods.map((n) => <option key={n.id} value={n.slug}>{n.name}</option>)}</select>
            <select name="category" defaultValue={sp.category ?? ""} className={inputCls} aria-label="Category">
              <option value="">Any service</option>
              {categories.map((c) => <optgroup key={c.id} label={c.name}><option value={c.slug}>All {c.name.toLowerCase()}</option>{c.children.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}</optgroup>)}
            </select>
            <div className="flex gap-2"><input name="min" defaultValue={sp.min} inputMode="decimal" placeholder={`Min ${country?.currency.symbol ?? ""}`} className={inputCls} aria-label="Minimum price" /><input name="max" defaultValue={sp.max} inputMode="decimal" placeholder={`Max ${country?.currency.symbol ?? ""}`} className={inputCls} aria-label="Maximum price" /></div>
            <select name="rating" defaultValue={sp.rating ?? ""} className={inputCls} aria-label="Minimum rating"><option value="">Any rating</option><option value="4.5">4.5+ stars</option><option value="4">4+ stars</option><option value="3">3+ stars</option></select>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="home" value="1" defaultChecked={sp.home === "1"} className="accent-brand" />Home service</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="studio" value="1" defaultChecked={sp.studio === "1"} className="accent-brand" />Studio</label>
            </div>
            <select name="sort" defaultValue={sp.sort ?? "relevance"} className={inputCls} aria-label="Sort"><option value="relevance">Recommended</option><option value="rating">Highest rated</option><option value="price_low">Price: low to high</option><option value="price_high">Price: high to low</option><option value="newest">Newest</option></select>
          </div>
          <p className="mt-3 text-xs text-muted">All professionals shown are verified by our team.</p>
        </details>
      </form>

      <div className="mt-8 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">{heading}</h1>
        <p className="text-sm text-muted tabular">{res.total} {res.total === 1 ? "professional" : "professionals"}</p>
      </div>
      {res.results.length === 0 ? (
        <div className="mt-6"><Empty title="No professionals match yet" body="Try a broader search, another city, or remove some filters." /></div>
      ) : (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{res.results.map((p) => <ProviderCard key={p.id} p={p} />)}</div>
      )}
      <Pagination page={res.page} pages={res.pages} href={(p) => qs({ page: String(p) })} />
    </div>
  );
}
