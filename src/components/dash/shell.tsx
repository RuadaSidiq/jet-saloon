import Link from "next/link";
import { Logo } from "@/components/site/header";
import { logoutAction } from "@/app/actions/auth";
import { NavLink } from "./navlink";

export type NavItem = { href: string; label: string; badge?: number; exact?: boolean };

/** Dashboard frame. `variant` changes density and chrome so each role has its own feel. */
export function DashShell({ nav, children, title, variant, user }: { nav: (NavItem | { section: string })[]; children: React.ReactNode; title: string; variant: "customer" | "business" | "admin"; user: { name: string; email: string } }) {
  const dark = variant === "admin";
  return (
    <div className="min-h-dvh bg-canvas lg:flex">
      <input type="checkbox" id="nav-toggle" className="peer hidden" />
      <aside className={`${dark ? "bg-brand-dark text-white/80" : "border-r border-line bg-white"} fixed inset-y-0 left-0 z-40 w-64 -translate-x-full overflow-y-auto transition-transform peer-checked:translate-x-0 lg:static lg:translate-x-0 ${variant === "admin" ? "lg:w-60" : ""}`}>
        <div className="flex h-16 items-center px-5"><Logo light={dark} /></div>
        <p className={`px-5 pb-3 text-xs font-medium uppercase tracking-wider ${dark ? "text-white/50" : "text-muted"}`}>{title}</p>
        <nav className="space-y-0.5 px-3 pb-8 text-sm">
          {nav.map((n, i) => "section" in n
            ? <p key={i} className={`px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider ${dark ? "text-white/40" : "text-muted"}`}>{n.section}</p>
            : <NavLink key={n.href} href={n.href} exact={n.exact} dark={dark} badge={n.badge}>{n.label}</NavLink>)}
        </nav>
      </aside>
      <label htmlFor="nav-toggle" className="fixed inset-0 z-30 hidden bg-black/30 peer-checked:block lg:hidden" aria-hidden />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white px-4 sm:px-6">
          <label htmlFor="nav-toggle" className="cursor-pointer rounded-md border border-line px-2.5 py-1.5 text-sm lg:hidden">Menu</label>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <Link href="/" className="hidden text-muted hover:text-brand sm:block">View site</Link>
            <span className="hidden text-right sm:block"><span className="block font-medium leading-tight">{user.name}</span><span className="block text-xs text-muted">{user.email}</span></span>
            <form action={logoutAction}><button className="rounded-md border border-line px-3 py-1.5 text-muted hover:text-ink">Sign out</button></form>
          </div>
        </header>
        <main className={`mx-auto px-4 py-6 sm:px-6 sm:py-8 ${variant === "admin" ? "max-w-[1400px]" : "max-w-6xl"}`}>{children}</main>
      </div>
    </div>
  );
}
