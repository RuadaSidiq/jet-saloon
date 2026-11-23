"use client";
import { useState, useTransition } from "react";
import { revealAccountAction } from "@/app/actions/admin-reveal";

/** Shows the full account number on demand. Each reveal is audited server-side. */
export function RevealAccount({ payoutId }: { payoutId: string }) {
  const [v, setV] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return v ? <span className="mt-1 block font-mono">{v}</span> : (
    <button type="button" disabled={pending} onClick={() => start(async () => setV(await revealAccountAction(payoutId)))} className="mt-1 block text-brand underline">{pending ? "…" : "Show full number"}</button>
  );
}
