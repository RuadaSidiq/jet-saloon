"use client";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/server/errors";
import { btn } from "./index";
import { cn } from "@/lib/cn";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/** Form bound to a server action: shows pending state, server errors and success, and can redirect or reset. */
export function ActionForm({ action, children, className, resetOnSuccess, redirectTo, confirm, id }: { action: Action; children: React.ReactNode; className?: string; resetOnSuccess?: boolean; redirectTo?: string; confirm?: string; id?: string }) {
  const [state, run] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      const to = (state.data as { redirect?: string } | undefined)?.redirect ?? redirectTo;
      if (to && /^https?:\/\//.test(to)) window.location.assign(to);
      else if (to) router.push(to);
      else router.refresh();
    }
  }, [state, resetOnSuccess, redirectTo, router]);
  return (
    <form id={id} ref={ref} action={run} className={className} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {children}
      {state && !state.ok && <p role="alert" className="mt-3 rounded-2xl bg-bad-soft px-3 py-2 text-sm text-bad">{state.error}</p>}
      {state?.ok && state.message && <p role="status" className="mt-3 rounded-2xl bg-ok-soft px-3 py-2 text-sm text-ok">{state.message}</p>}
    </form>
  );
}

export function Submit({ children, variant = "primary", size = "md", className, pendingText = "Saving…" }: { children: React.ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" | "md" | "lg"; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={cn(btn({ variant, size }), className)}>{pending ? pendingText : children}</button>;
}
