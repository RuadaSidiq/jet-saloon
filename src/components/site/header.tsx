import Link from "next/link";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { logoutAction } from "@/app/actions/auth";
import { btn } from "@/components/ui";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Jet Saloon home">
      <span className={`grid size-9 place-items-center rounded-2xl text-sm font-bold ${light ? "bg-white/90 text-brand" : "bg-gradient-to-br from-brand-mid to-brand-dark text-white shadow-[0_6px_16px_-6px_rgba(23,105,210,.7)]"}`}>JS</span>
      <span className={light ? "text-white" : "text-ink"}>Jet Saloon</span>
    </Link>
  );
}

export async function SiteHeader() {
  const user = await currentUser();
  const unread = user ? await db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  const dash = user?.role === "ADMIN" ? "/admin" : user?.role === "PROVIDER" ? "/business" : "/account";
  return (
    <header className="glass-strong sticky top-0 z-30 border-b border-white/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <form action="/search" className="ml-4 hidden flex-1 md:block">
          <input name="q" placeholder="Search services or professionals" className="h-10 w-full max-w-md rounded-full border border-white/80 bg-white/60 px-4 text-sm backdrop-blur-md focus:border-brand/40 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand/15" />
        </form>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/search" className="hidden rounded-2xl px-3 py-2 text-ink hover:text-brand sm:block md:hidden">Search</Link>
          {user?.role !== "PROVIDER" && <Link href="/become-a-provider" className="hidden rounded-2xl px-3 py-2 text-ink hover:text-brand sm:block">Become a provider</Link>}
          {user ? (
            <>
              <Link href="/account/notifications" className="relative rounded-2xl px-3 py-2 hover:text-brand" aria-label={`Notifications, ${unread} unread`}>
                Alerts{unread > 0 && <span className="ml-1 rounded-xl bg-brand px-1.5 text-xs text-white">{unread}</span>}
              </Link>
              <Link href={dash} className={btn({ variant: "secondary", size: "sm" })}>{user.role === "ADMIN" ? "Admin" : user.role === "PROVIDER" ? "My business" : "My account"}</Link>
              <form action={logoutAction}><button className="rounded-2xl px-3 py-2 text-muted hover:text-ink">Sign out</button></form>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-2xl px-3 py-2 hover:text-brand">Sign in</Link>
              <Link href="/register" className={btn({ size: "sm" })}>Create account</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
