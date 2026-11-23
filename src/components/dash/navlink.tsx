"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck, CalendarCheck, ClipboardCheck, Clock, CreditCard, Heart, Home, LayoutDashboard, LifeBuoy, Bell,
  Scissors, Settings, ShieldCheck, Star, Store, Tag, Users, Wallet, Briefcase, Layers, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { NavItem } from "./shell";

const ICONS: Record<string, LucideIcon> = {
  home: Home, dashboard: LayoutDashboard, calendar: CalendarCheck, clock: Clock, scissors: Scissors, store: Store, star: Star,
  wallet: Wallet, clipboard: ClipboardCheck, card: CreditCard, heart: Heart, bell: Bell, support: LifeBuoy, settings: Settings,
  users: Users, shield: ShieldCheck, tag: Tag, badge: BadgeCheck, briefcase: Briefcase, layers: Layers,
};

const matches = (path: string, href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + "/"));
export const isActive = (path: string, item: NavItem) => matches(path, item.href, item.exact) || !!item.tabs?.some((t) => matches(path, t.href, t.exact));

export function SideNav({ items, dark }: { items: NavItem[]; dark: boolean }) {
  const path = usePathname();
  return (
    <nav className="space-y-1 px-3 pb-8 text-sm">
      {items.map((n) => {
        const Icon = ICONS[n.icon] ?? LayoutDashboard;
        const active = isActive(path, n);
        return (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors",
            dark ? (active ? "bg-white/15 font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15)]" : "text-white/75 hover:bg-white/10 hover:text-white")
              : (active ? "bg-white/85 font-medium text-brand-dark shadow-[0_4px_14px_-8px_rgba(18,61,117,.35)]" : "text-ink hover:bg-white/50"))}>
            <Icon className={cn("size-[18px] shrink-0", active ? (dark ? "text-white" : "text-brand") : dark ? "text-white/60" : "text-muted")} strokeWidth={1.8} aria-hidden />
            <span className="flex-1">{n.label}</span>
            {n.badge ? <span className={cn("rounded-full px-2 text-xs", dark ? "bg-white/25 text-white" : "bg-brand text-white")}>{n.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Tabs for the active section (e.g. Bookings · Calendar). Rendered by the shell above page content. */
export function SectionTabs({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const active = items.find((i) => isActive(path, i));
  if (!active?.tabs || active.tabs.length < 2) return null;
  return (
    <div className="mb-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/80 bg-white/55 p-1 backdrop-blur-md">
      {active.tabs.map((t) => {
        const on = matches(path, t.href, t.exact);
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors", on ? "bg-white font-medium text-brand-dark shadow-[0_4px_12px_-6px_rgba(18,61,117,.35)]" : "text-muted hover:text-ink")}>
            {t.label}{t.badge ? <span className="ml-1.5 rounded-full bg-brand px-1.5 text-xs text-white">{t.badge}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}
