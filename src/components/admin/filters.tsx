import Link from "next/link";
import { cn } from "@/lib/cn";

export const PRESETS: [string, string][] = [["today", "Today"], ["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["year", "This year"]];

export function DateFilter({ current, from, to }: { current?: string; from?: string; to?: string }) {
  const c = current ?? "30d";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex overflow-hidden rounded-md border border-line bg-white text-sm">
        {PRESETS.map(([k, l]) => <Link key={k} href={`?range=${k}`} className={cn("px-3 py-1.5", c === k ? "bg-brand text-white" : "hover:bg-canvas")}>{l}</Link>)}
      </div>
      <form className="flex items-center gap-1 text-sm">
        <input type="hidden" name="range" value="custom" />
        <input type="date" name="from" defaultValue={from} className="h-8 rounded border border-line px-2" aria-label="From" />
        <input type="date" name="to" defaultValue={to} className="h-8 rounded border border-line px-2" aria-label="To" />
        <button className="h-8 rounded border border-line px-2 hover:border-brand">Apply</button>
      </form>
    </div>
  );
}

export function SearchBar({ placeholder, defaultValue, children }: { placeholder: string; defaultValue?: string; children?: React.ReactNode }) {
  return (
    <form className="mb-4 flex flex-wrap gap-2">
      <input name="q" defaultValue={defaultValue} placeholder={placeholder} className="h-9 min-w-60 flex-1 rounded-md border border-line px-3 text-sm" />
      {children}
      <button className="h-9 rounded-md bg-brand px-4 text-sm text-white">Filter</button>
    </form>
  );
}
