import Link from "next/link";
import { Logo } from "@/components/site/header";
import { logoutAction } from "@/app/actions/auth";
import { SectionTabs, SideNav } from "./navlink";

export type NavTab = { href: string; label: string; exact?: boolean; badge?: number };
export type NavItem = { href: string; label: string; icon: string; badge?: number; exact?: boolean; tabs?: NavTab[] };

/** Dashboard frame: a short icon sidebar of top-level sections; related pages appear as tabs inside each section. */
export function DashShell({ nav, children, title, variant, user, links = [] }: {
  nav: NavItem[]; children: React.ReactNode; title: string; variant: "customer" | "business" | "admin"; user: { name: string; email: string }; links?: { href: string; label: string }[];
}) {
  const dark = variant === "admin";
  return (
    <div className="min-h-dvh lg:flex">
      <input type="checkbox" id="nav-toggle" className="peer hidden" />
      <aside className={`${dark ? "glass-dark" : "glass-strong border-r border-white/70"} fixed inset-y-0 left-0 z-40 w-64 -translate-x-full overflow-y-auto transition-transform peer-checked:translate-x-0 lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:translate-x-0`}>
        <div className="flex h-16 items-center px-5"><Logo light={dark} /></div>
        <p className={`truncate px-6 pb-4 text-xs font-medium ${dark ? "text-white/55" : "text-muted"}`}>{title}</p>
        <SideNav items={nav} dark={dark} />
      </aside>
      <label htmlFor="nav-toggle" className="fixed inset-0 z-30 hidden bg-brand-dark/20 backdrop-blur-sm peer-checked:block lg:hidden" aria-hidden />
      <div className="min-w-0 flex-1">
        <header className="glass-strong sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/70 px-4 sm:px-6">
          <label htmlFor="nav-toggle" className="cursor-pointer rounded-full border border-white/80 bg-white/60 px-3 py-1.5 text-sm lg:hidden">Menu</label>
          <div className="ml-auto flex items-center gap-2 text-sm sm:gap-4">
            {links.map((l) => <Link key={l.href} href={l.href} className="hidden rounded-full px-3 py-1.5 text-muted hover:bg-white/60 hover:text-brand md:block">{l.label}</Link>)}
            <Link href="/" className="hidden rounded-full px-3 py-1.5 text-muted hover:bg-white/60 hover:text-brand sm:block">View site</Link>
            <span className="hidden text-right sm:block"><span className="block font-medium leading-tight">{user.name}</span><span className="block text-xs text-muted">{user.email}</span></span>
            <form action={logoutAction}><button className="rounded-full border border-white/80 bg-white/60 px-3 py-1.5 text-muted backdrop-blur-md hover:text-ink">Sign out</button></form>
          </div>
        </header>
        <main className={`mx-auto px-4 py-6 sm:px-6 sm:py-8 ${dark ? "max-w-[1400px]" : "max-w-6xl"}`}>
          <SectionTabs items={nav} />
          {children}
        </main>
      </div>
    </div>
  );
}
