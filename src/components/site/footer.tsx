import Link from "next/link";
import { db } from "@/server/db";
import { Logo } from "./header";

export async function SiteFooter() {
  const [cats, cities] = await Promise.all([
    db.category.findMany({ where: { parentId: null, active: true }, orderBy: { sortOrder: "asc" }, take: 6 }),
    db.city.findMany({ where: { active: true, country: { active: true } }, take: 6, orderBy: { name: "asc" } }),
  ]);
  return (
    <footer className="mt-20 bg-brand-dark text-sm text-white/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo light />
          <p className="mt-3 max-w-sm leading-relaxed">Book trusted, verified beauty and personal care professionals. Secure online payments, real availability, real reviews.</p>
        </div>
        <div><h3 className="mb-3 font-semibold text-white">Services</h3><ul className="space-y-2">{cats.map((c) => <li key={c.id}><Link className="hover:text-white" href={`/search?category=${c.slug}`}>{c.name}</Link></li>)}</ul></div>
        <div><h3 className="mb-3 font-semibold text-white">Cities</h3><ul className="space-y-2">{cities.map((c) => <li key={c.id}><Link className="hover:text-white" href={`/search?city=${c.slug}`}>{c.name}</Link></li>)}</ul></div>
        <div><h3 className="mb-3 font-semibold text-white">Company</h3><ul className="space-y-2">
          <li><Link className="hover:text-white" href="/become-a-provider">Become a provider</Link></li>
          <li><Link className="hover:text-white" href="/help">Help & FAQ</Link></li>
          <li><Link className="hover:text-white" href="/legal/terms">Terms</Link></li>
          <li><Link className="hover:text-white" href="/legal/privacy">Privacy</Link></li>
          <li><Link className="hover:text-white" href="/legal/refunds">Refund policy</Link></li>
        </ul></div>
      </div>
      <div className="border-t border-white/10"><div className="mx-auto max-w-7xl px-4 py-5 text-xs sm:px-6">© {new Date().getFullYear()} Jet Saloon. All rights reserved.</div></div>
    </footer>
  );
}
