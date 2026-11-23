"use client";
import type { PayoutMethod, PortfolioItem, ProviderDocument } from "@prisma/client";
import { consentAction, documentAction, payoutMethodAction, portfolioAction, submitApplicationAction } from "@/app/actions/business";
import { ActionForm, Submit } from "@/components/ui/form";
import { Act } from "@/components/ui/act";
import { Check, Field, Input, Select, StatusBadge } from "@/components/ui";

export function PortfolioManager({ items }: { items: PortfolioItem[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Show your best work. Add at least 2 photos. JPG, PNG or WebP up to 8MB; MP4 video up to 50MB.</p>
      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((m) => (
            <li key={m.id} className="space-y-1">
              {m.mediaType === "VIDEO" ? <video src={m.url} className="aspect-square w-full rounded-2xl bg-black object-cover" /> : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.caption ?? ""} className="aspect-square w-full rounded-2xl object-cover" />
              )}
              <div className="flex items-center justify-between">{!m.approved ? <StatusBadge status="HIDDEN" /> : <span />}<Act action={portfolioAction} fields={{ delete: m.id }} label="Remove" variant="ghost" confirm="Remove this item?" /></div>
            </li>
          ))}
        </ul>
      )}
      <ActionForm action={portfolioAction} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Photos or videos"><Input name="files" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4" required className="pt-1.5" /></Field>
        <Field label="Caption (optional)"><Input name="caption" maxLength={140} /></Field>
        <Submit pendingText="Uploading…">Upload</Submit>
      </ActionForm>
    </div>
  );
}

const DOC_LABEL: Record<string, string> = { GOVERNMENT_ID: "Government-issued ID", BUSINESS_REGISTRATION: "Business registration", CERTIFICATE: "Certificate / training", OTHER: "Other" };

export function DocumentsManager({ docs, required }: { docs: ProviderDocument[]; required: boolean }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{required ? "A government-issued ID (e.g. Ghana Card or passport) is required." : "Identity documents help us verify you."} Documents are stored privately, seen only by our verification team, and never shown on your profile.</p>
      {docs.length > 0 && <ul className="space-y-2 text-sm">{docs.map((d) => <li key={d.id} className="flex items-center justify-between rounded-xl border border-line p-3"><span><a className="text-brand" href={`/api/files/document/${d.id}`} target="_blank" rel="noreferrer">{d.fileName}</a> <span className="text-muted">· {DOC_LABEL[d.type]}</span></span><StatusBadge status={d.status} /></li>)}</ul>}
      <ActionForm action={documentAction} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Document type"><Select name="type">{Object.entries(DOC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="File (PDF, JPG, PNG)"><Input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required className="pt-1.5" /></Field>
        <Submit pendingText="Uploading…">Upload securely</Submit>
      </ActionForm>
    </div>
  );
}

export function ConsentForm({ consent }: { consent: boolean }) {
  return (
    <ActionForm action={consentAction} className="rounded-2xl border border-line bg-canvas p-4">
      <Check name="consent" defaultChecked={consent} label="I confirm the information and documents I've provided are genuine, and I consent to Jet Saloon verifying them for the purpose of approving my account." />
      <div className="mt-3"><Submit size="sm" variant="secondary">Save consent</Submit></div>
    </ActionForm>
  );
}

export function PayoutMethods({ methods, channels }: { methods: PayoutMethod[]; channels: string[] }) {
  return (
    <div className="space-y-4">
      {methods.length > 0 && <ul className="space-y-2 text-sm">{methods.map((m) => <li key={m.id} className="rounded-xl border border-line p-3"><span className="font-medium">{m.type === "MOBILE_MONEY" ? "Mobile Money" : "Bank"} · {m.institution}</span> — {m.accountName} ••••{m.accountNumberLast4}{m.isDefault && <span className="ml-2 text-xs text-brand">Default</span>}</li>)}</ul>}
      <ActionForm action={payoutMethodAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
        <Field label="Method"><Select name="type">{channels.map((c) => <option key={c} value={c}>{c === "MOBILE_MONEY" ? "Mobile Money" : "Bank account"}</option>)}</Select></Field>
        <Field label="Network or bank" hint="e.g. MTN, Telecel, AirtelTigo, GCB, Ecobank"><Input name="institution" required /></Field>
        <Field label="Account holder name"><Input name="accountName" required /></Field>
        <Field label="Account / wallet number" hint="Stored encrypted"><Input name="accountNumber" inputMode="numeric" required /></Field>
        <div className="sm:col-span-2"><Submit>Save payout method</Submit></div>
      </ActionForm>
    </div>
  );
}

export function SubmitApplication({ disabled }: { disabled: boolean }) {
  return (
    <ActionForm action={async () => submitApplicationAction()}>
      <Submit size="lg" pendingText="Submitting…" className={disabled ? "opacity-60" : ""}>Submit application for review</Submit>
      {disabled && <p className="mt-2 text-xs text-muted">Complete the items marked ✗ first.</p>}
    </ActionForm>
  );
}
