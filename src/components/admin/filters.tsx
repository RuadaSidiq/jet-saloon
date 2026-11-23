import Link from "next/link";
import { cn } from "@/lib/cn";

export const PRESETS: [string, string][] = [["today", "Today"], ["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["year", "This year"]];

export function DateFilter({ current, from, to }: { current?: string; from?: string; to?: string }) {
  const c = current ?? "30d";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex overflow-hidden glass rounded-2xl text-sm">
        {PRESETS.map(([k, l]) => <Link key={k} href={`?range=${k}`} className={cn("rounded-full px-3 py-1", c === k ? "bg-brand text-white shadow-[0_4px_12px_-6px_rgba(23,105,210,.7)]" : "hover:bg-white/70")}>{l}</Link>)}
      </div>
      <form className="flex items-center gap-1 text-sm">
        <input type="hidden" name="range" value="custom" />
        <input type="date" name="from" defaultValue={from} className="h-8 rounded-full border border-white/80 bg-white/60 px-3" aria-label="From" />
        <input type="date" name="to" defaultValue={to} className="h-8 rounded-full border border-white/80 bg-white/60 px-3" aria-label="To" />
        <button className="h-8 rounded-full border border-white/80 bg-white/60 px-3 hover:text-brand">Apply</button>
      </form>
    </div>
  );
}

export function SearchBar({ placeholder, defaultValue, children }: { placeholder: string; defaultValue?: string; children?: React.ReactNode }) {
  return (
    <form className="mb-4 flex flex-wrap gap-2">
      <input name="q" defaultValue={defaultValue} placeholder={placeholder} className="h-9 min-w-60 flex-1 rounded-full border border-white/80 bg-white/65 px-4 text-sm backdrop-blur-md" />
      {children}
      <button className="h-9 rounded-full bg-brand px-5 text-sm text-white">Filter</button>
    </form>
  );
}
