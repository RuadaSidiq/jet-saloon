import Link from "next/link";
import { cn } from "@/lib/cn";

type BtnProps = { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; className?: string };
export const btn = ({ variant = "primary", size = "md", className }: BtnProps = {}) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
    size === "sm" && "h-8 px-3 text-sm", size === "md" && "h-10 px-4 text-sm", size === "lg" && "h-12 px-6 text-base",
    variant === "primary" && "bg-brand text-white hover:bg-brand-dark",
    variant === "secondary" && "border border-line bg-white text-ink hover:border-brand-mid hover:text-brand",
    variant === "ghost" && "text-brand hover:bg-brand-soft",
    variant === "danger" && "border border-bad/30 bg-white text-bad hover:bg-bad-soft",
    className,
  );

export function Button({ variant, size, className, ...p }: BtnProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={btn({ variant, size, className })} {...p} />;
}
export function LinkButton({ variant, size, className, ...p }: BtnProps & React.ComponentProps<typeof Link>) {
  return <Link className={btn({ variant, size, className })} {...p} />;
}

export const inputCls = "h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-canvas";
export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...p} className={cn(inputCls, p.className)} />; }
export function Textarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea rows={4} {...p} className={cn(inputCls, "h-auto py-2", p.className)} />; }
export function Select({ children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) { return <select {...p} className={cn(inputCls, "pr-8", p.className)}>{children}</select>; }

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? <span className="block text-xs text-bad">{error}</span> : hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
export function Check({ label, ...p }: { label: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 size-4 accent-brand" {...p} /><span>{label}</span></label>;
}

export function Card({ className, children, title, action }: { className?: string; children: React.ReactNode; title?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className={cn("rounded-[--radius-card] border border-line bg-white", className)}>
      {title && <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5"><h2 className="text-sm font-semibold">{title}</h2>{action}</header>}
      <div className="p-5">{children}</div>
    </section>
  );
}

const TONES = {
  neutral: "bg-slate-100 text-slate-700", brand: "bg-brand-soft text-brand-dark", ok: "bg-ok-soft text-ok", warn: "bg-warn-soft text-warn", bad: "bg-bad-soft text-bad",
};
export function Badge({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium", TONES[tone])}>{children}</span>;
}

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  CONFIRMED: "ok", COMPLETED: "ok", PAID: "ok", APPROVED: "ok", SUCCEEDED: "ok", PUBLISHED: "ok", RESOLVED: "ok", ACTIVE: "ok",
  PENDING_PAYMENT: "warn", AWAITING_APPROVAL: "warn", PROCESSING: "warn", SUBMITTED: "warn", UNDER_REVIEW: "warn", INFO_REQUESTED: "warn", REQUESTED: "warn", OPEN: "warn", IN_PROGRESS: "brand", PARTIALLY_REFUNDED: "warn", INITIATED: "warn", WAITING_ON_USER: "brand",
  CANCELLED: "bad", REJECTED: "bad", FAILED: "bad", SUSPENDED: "bad", NO_SHOW: "bad", HIDDEN: "bad",
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>{description && <p className="mt-1 text-sm text-muted">{description}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-[--radius-card] border border-line bg-white px-4 py-3.5">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="tabular mt-1 text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[--radius-card] border border-dashed border-line bg-canvas px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Table({ head, children, empty }: { head: React.ReactNode[]; children: React.ReactNode; empty?: React.ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="overflow-x-auto rounded-[--radius-card] border border-line bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted"><tr>{head.map((h, i) => <th key={i} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line [&_td]:px-4 [&_td]:py-3">{hasRows ? children : <tr><td colSpan={head.length} className="py-10 text-center text-muted">{empty ?? "Nothing here yet"}</td></tr>}</tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
      {page > 1 && <Link className={btn({ variant: "secondary", size: "sm" })} href={href(page - 1)}>Previous</Link>}
      <span className="px-2 text-muted">Page {page} of {pages}</span>
      {page < pages && <Link className={btn({ variant: "secondary", size: "sm" })} href={href(page + 1)}>Next</Link>}
    </nav>
  );
}

export function Notice({ tone = "brand", children }: { tone?: "brand" | "warn" | "bad" | "ok"; children: React.ReactNode }) {
  const c = { brand: "border-brand/20 bg-brand-soft text-brand-dark", warn: "border-warn/20 bg-warn-soft text-warn", bad: "border-bad/20 bg-bad-soft text-bad", ok: "border-ok/20 bg-ok-soft text-ok" }[tone];
  return <div className={cn("rounded-md border px-4 py-3 text-sm", c)}>{children}</div>;
}

export function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  return (
    <span className={cn("inline-flex text-amber-500", size === "md" ? "text-base" : "text-sm")} aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} aria-hidden className={i <= Math.round(value) ? "" : "text-slate-300"}>★</span>)}
    </span>
  );
}
