"use client";
import Link from "next/link";
import { forgotAction, loginAction, registerAction, resetAction } from "@/app/actions/auth";
import { ActionForm, Submit } from "@/components/ui/form";
import { Field, Input, Select } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={loginAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email"><Input name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password"><Input name="password" type="password" autoComplete="current-password" required /></Field>
      <div className="text-right text-sm"><Link href="/forgot-password" className="text-brand">Forgot password?</Link></div>
      <Submit className="w-full" size="lg" pendingText="Signing in…">Sign in</Submit>
    </ActionForm>
  );
}

export function RegisterForm({ next, countries, refCode }: { next?: string; countries: { code: string; name: string }[]; refCode?: string }) {
  return (
    <ActionForm action={registerAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Full name"><Input name="name" autoComplete="name" required minLength={2} /></Field>
      <Field label="Email"><Input name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password" hint="At least 8 characters, including a letter and a number."><Input name="password" type="password" autoComplete="new-password" required minLength={8} /></Field>
      <Field label="Country"><Select name="country" defaultValue={countries[0]?.code}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Select></Field>
      <Field label="Referral code (optional)"><Input name="ref" defaultValue={refCode} /></Field>
      <p className="text-xs text-muted">By creating an account you agree to our <Link href="/legal/terms" className="text-brand">Terms</Link> and <Link href="/legal/privacy" className="text-brand">Privacy Policy</Link>.</p>
      <Submit className="w-full" size="lg" pendingText="Creating account…">Create account</Submit>
    </ActionForm>
  );
}

export function ForgotForm() {
  return (
    <ActionForm action={forgotAction} className="space-y-4">
      <Field label="Email"><Input name="email" type="email" required /></Field>
      <Submit className="w-full" size="lg" pendingText="Sending…">Send reset link</Submit>
    </ActionForm>
  );
}

export function ResetForm({ token }: { token: string }) {
  return (
    <ActionForm action={resetAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" hint="At least 8 characters, including a letter and a number."><Input name="password" type="password" autoComplete="new-password" required minLength={8} /></Field>
      <Submit className="w-full" size="lg">Set new password</Submit>
    </ActionForm>
  );
}
