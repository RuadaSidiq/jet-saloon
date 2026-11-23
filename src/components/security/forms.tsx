"use client";
import { useState, useTransition } from "react";
import { mfaVerifyAction } from "@/app/actions/auth";
import { beginMfaAction, confirmMfaAction } from "@/app/actions/security";
import { ActionForm, Submit } from "@/components/ui/form";
import { Button, Field, Input, Notice } from "@/components/ui";

export function MfaVerifyForm({ next }: { next?: string }) {
  return (
    <ActionForm action={mfaVerifyAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Verification code"><Input name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus required maxLength={14} placeholder="123 456" /></Field>
      <Submit className="w-full" size="lg" pendingText="Verifying…">Verify and sign in</Submit>
    </ActionForm>
  );
}

export function MfaSetup() {
  const [qr, setQr] = useState<{ qr: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (codes) {
    return (
      <div className="space-y-4">
        <Notice tone="ok">Two-factor authentication is on.</Notice>
        <p className="text-sm">Save these recovery codes somewhere safe. Each works once if you lose your phone. <strong>They won&apos;t be shown again.</strong></p>
        <ul className="grid grid-cols-2 gap-2 rounded-2xl bg-white/70 p-4 font-mono text-sm">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
        <Button variant="secondary" onClick={() => navigator.clipboard.writeText(codes.join("\n"))}>Copy codes</Button>
        <Button onClick={() => location.reload()}>Done</Button>
      </div>
    );
  }
  if (!qr) {
    return (
      <div>
        <Button disabled={pending} onClick={() => start(async () => { const r = await beginMfaAction(); if (r.ok) setQr(r.data as { qr: string; secret: string }); else setErr(r.error); })}>{pending ? "Preparing…" : "Set up two-factor authentication"}</Button>
        {err && <p className="mt-2 text-sm text-bad">{err}</p>}
      </div>
    );
  }
  return (
    <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr.qr} alt="QR code to scan with your authenticator app" className="size-[220px] rounded-2xl bg-white p-2" />
      <div className="space-y-3 text-sm">
        <p>1. Scan this QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy).</p>
        <p className="text-muted">Can&apos;t scan? Enter this key: <code className="break-all rounded bg-white/70 px-1.5 py-0.5 text-ink">{qr.secret}</code></p>
        <p>2. Enter the 6-digit code it shows:</p>
        <ActionForm action={async (prev, fd) => { const r = await confirmMfaAction(prev, fd); if (r.ok) setCodes((r.data as { codes: string[] }).codes); return r.ok ? { ok: true } : r; }} className="flex max-w-xs gap-2">
          <Input name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={7} placeholder="123456" />
          <Submit pendingText="…">Confirm</Submit>
        </ActionForm>
      </div>
    </div>
  );
}
