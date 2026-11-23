import Link from "next/link";
import { Logo } from "@/components/site/header";
import { logoutAction } from "@/app/actions/auth";
import { SectionTabs, SideNav } from "./navlink";

export type NavTab = { href: string; label: string; exact?: boolean; badge?: number };
export type NavItem = { href: string; label: string; icon: string; badge?: number; exact?: boolean; tabs?: NavTab[] };

/** Dashboard frame: icon sidebar with sections on top and the account card pinned at the bottom. */
export function DashShell({ nav, children, title, variant, user, links = [] }: {
  nav: NavItem[]; children: React.ReactNode; title: string; variant: "customer" | "business" | "admin"; user: { name: string; email: string; avatarUrl?: string | null }; links?: { href: string; label: string }[];
}) {
  const dark = variant === "admin";
  const muted = dark ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-muted hover:bg-white/70 hover:text-brand";
  const initials = user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="min-h-dvh lg:flex">
      <input type="checkbox" id="nav-toggle" className="peer hidden" />
      <aside className={`${dark ? "glass-dark" : "glass-strong border-r border-white/70"} fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col transition-transform peer-checked:translate-x-0 lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:translate-x-0`}>
        <div className="flex h-16 shrink-0 items-center px-5"><Logo light={dark} /></div>
        <p className={`truncate px-6 pb-4 text-xs font-medium ${dark ? "text-white/55" : "text-muted"}`}>{title}</p>
        <div className="min-h-0 flex-1 overflow-y-auto"><SideNav items={nav} dark={dark} /></div>

        <div className="shrink-0 p-3">
          <div className={`rounded-3xl p-3 ${dark ? "bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.12)]" : "glass"}`}>
            <div className="flex items-center gap-3 px-1">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
              ) : <span className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${dark ? "bg-white/20 text-white" : "bg-brand-soft text-brand"}`}>{initials}</span>}
              <span className="min-w-0">
                <span className={`block truncate text-sm font-medium ${dark ? "text-white" : "text-ink"}`}>{user.name}</span>
                <span className={`block truncate text-xs ${dark ? "text-white/60" : "text-muted"}`}>{user.email}</span>
              </span>
            </div>
            <div className="mt-3 space-y-0.5 text-sm">
              {links.map((l) => <Link key={l.href} href={l.href} className={`block rounded-2xl px-3 py-1.5 ${muted}`}>{l.label}</Link>)}
              <Link href="/" className={`block rounded-2xl px-3 py-1.5 ${muted}`}>View site</Link>
              <form action={logoutAction}><button className={`w-full rounded-2xl px-3 py-1.5 text-left ${muted}`}>Sign out</button></form>
            </div>
          </div>
        </div>
      </aside>
      <label htmlFor="nav-toggle" className="fixed inset-0 z-30 hidden bg-brand-dark/20 backdrop-blur-sm peer-checked:block lg:hidden" aria-hidden />
      <div className="min-w-0 flex-1">
        <header className="glass-strong sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-white/70 px-4 lg:hidden">
          <label htmlFor="nav-toggle" className="cursor-pointer rounded-full border border-white/80 bg-white/60 px-3 py-1.5 text-sm">Menu</label>
          <Logo />
        </header>
        <main className={`mx-auto px-4 py-6 sm:px-6 sm:py-8 ${dark ? "max-w-[1400px]" : "max-w-6xl"}`}>
          <SectionTabs items={nav} />
          {children}
        </main>
      </div>
    </div>
  );
}
