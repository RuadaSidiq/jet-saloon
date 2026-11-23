"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export function NavLink({ href, children, exact, dark, badge }: { href: string; children: React.ReactNode; exact?: boolean; dark?: boolean; badge?: number }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} className={cn("flex items-center justify-between rounded-md px-3 py-2",
      dark ? (active ? "bg-white/10 font-medium text-white" : "hover:bg-white/5 hover:text-white") : (active ? "bg-brand-soft font-medium text-brand-dark" : "text-ink hover:bg-canvas"))}>
      {children}{badge ? <span className={cn("rounded px-1.5 text-xs", dark ? "bg-brand-mid text-white" : "bg-brand text-white")}>{badge}</span> : null}
    </Link>
  );
}
