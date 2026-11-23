"use client";
import { newsletterAction } from "@/app/actions/account";
import { ActionForm, Submit } from "@/components/ui/form";

export function Newsletter() {
  return (
    <ActionForm action={newsletterAction} resetOnSuccess className="w-full max-w-md">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="nl-email">Email</label>
        <input id="nl-email" name="email" type="email" required placeholder="you@example.com" className="h-11 flex-1 rounded-2xl border border-white/30 bg-white px-3 text-sm text-ink" />
        <Submit size="lg" pendingText="…">Subscribe</Submit>
      </div>
    </ActionForm>
  );
}
