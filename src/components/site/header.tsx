import Link from "next/link";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { logoutAction } from "@/app/actions/auth";
import { btn } from "@/components/ui";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Jet Saloon home">
      <span className={`grid size-8 place-items-center rounded-md text-sm font-bold ${light ? "bg-white text-brand" : "bg-brand text-white"}`}>JS</span>
      <span className={light ? "text-white" : "text-ink"}>Jet Saloon</span>
    </Link>
  );
}

export async function SiteHeader() {
  const user = await currentUser();
  const unread = user ? await db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  const dash = user?.role === "ADMIN" ? "/admin" : user?.role === "PROVIDER" ? "/business" : "/account";
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <form action="/search" className="ml-4 hidden flex-1 md:block">
          <input name="q" placeholder="Search services or professionals" className="h-10 w-full max-w-md rounded-md border border-line bg-canvas px-3 text-sm focus:border-brand focus:bg-white focus:outline-none" />
        </form>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/search" className="hidden rounded-md px-3 py-2 text-ink hover:text-brand sm:block md:hidden">Search</Link>
          {user?.role !== "PROVIDER" && <Link href="/become-a-provider" className="hidden rounded-md px-3 py-2 text-ink hover:text-brand sm:block">Become a provider</Link>}
          {user ? (
            <>
              <Link href="/account/notifications" className="relative rounded-md px-3 py-2 hover:text-brand" aria-label={`Notifications, ${unread} unread`}>
                Alerts{unread > 0 && <span className="ml-1 rounded bg-brand px-1.5 text-xs text-white">{unread}</span>}
              </Link>
              <Link href={dash} className={btn({ variant: "secondary", size: "sm" })}>{user.role === "ADMIN" ? "Admin" : user.role === "PROVIDER" ? "My business" : "My account"}</Link>
              <form action={logoutAction}><button className="rounded-md px-3 py-2 text-muted hover:text-ink">Sign out</button></form>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md px-3 py-2 hover:text-brand">Sign in</Link>
              <Link href="/register" className={btn({ size: "sm" })}>Create account</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
