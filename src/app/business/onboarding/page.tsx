import Link from "next/link";
import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { applicationChecklist } from "@/server/modules/providers";
import { BasicsForm } from "@/components/business/basics-form";
import { ServiceForm } from "@/components/business/service-form";
import { HoursForm } from "@/components/business/hours-form";
import { formData } from "@/components/business/data";
import { PortfolioManager, DocumentsManager, PayoutMethods, ConsentForm, SubmitApplication } from "@/components/business/sections";
import { Card, Notice, PageHeader, btn } from "@/components/ui";
import { cn } from "@/lib/cn";

const STEPS = [["details", "Your details"], ["services", "Services"], ["hours", "Working hours"], ["portfolio", "Portfolio"], ["verification", "Verification"], ["payout", "Payout"], ["submit", "Review & submit"]] as const;

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const user = await pageUser("/business/onboarding");
  const { countries, categories } = await formData();
  const p = await db.providerProfile.findUnique({ where: { userId: user.id }, include: { categories: true, country: { include: { currency: true } }, services: { where: { deletedAt: null } }, staff: { where: { isOwner: true }, include: { workingHours: true } }, portfolio: true, documents: true, payoutMethods: true } });
  const sp = await searchParams;
  const step = p ? (STEPS.find(([k]) => k === sp.step)?.[0] ?? "details") : "details";
  const idx = STEPS.findIndex(([k]) => k === step);
  const nextHref = idx < STEPS.length - 1 ? `/business/onboarding?step=${STEPS[idx + 1][0]}` : undefined;
  const checklist = p ? await applicationChecklist(p.id) : [];
  const locked = p && ["SUBMITTED", "UNDER_REVIEW"].includes(p.status);

  return (
    <>
      <PageHeader title="Provider application" description="Complete each step. You can save and come back any time." />
      {locked && <div className="mb-6"><Notice>Your application is under review. You&apos;ll be notified when there&apos;s a decision.</Notice></div>}
      {p?.status === "INFO_REQUESTED" && <div className="mb-6"><Notice tone="warn">Our team asked: {p.statusReason}</Notice></div>}
      {p?.status === "REJECTED" && <div className="mb-6"><Notice tone="bad">Previous decision: {p.statusReason}. Make changes and resubmit.</Notice></div>}
      <ol className="mb-6 flex gap-1 overflow-x-auto pb-1 text-sm" aria-label="Progress">
        {STEPS.map(([k, label], i) => (
          <li key={k} className="shrink-0">
            {p ? <Link href={`?step=${k}`} className={cn("flex items-center gap-2 rounded-2xl px-3 py-2", k === step ? "bg-brand text-white" : "bg-white text-ink border border-line")}><span className="tabular text-xs opacity-75">{i + 1}</span>{label}</Link>
              : <span className={cn("flex items-center gap-2 rounded-2xl border border-line px-3 py-2", i === 0 ? "bg-brand text-white" : "bg-white text-muted")}><span className="text-xs">{i + 1}</span>{label}</span>}
          </li>
        ))}
      </ol>
      <Card>
        {step === "details" && <BasicsForm countries={countries} categories={categories} next="/business/onboarding?step=services" initial={p ? { ...p, studioAddress: p.studioAddress ?? "", bio: p.bio ?? "", contactPhone: p.contactPhone ?? "", neighbourhoodId: p.neighbourhoodId ?? "", cityId: p.cityId ?? "", categoryIds: p.categories.map((c) => c.categoryId) } : { displayName: user.name }} />}
        {p && step === "services" && (
          <div className="space-y-6">
            {p.services.length > 0 && <ul className="space-y-1 text-sm">{p.services.map((s) => <li key={s.id}>✓ {s.name}</li>)}</ul>}
            <ServiceForm categories={categories} currencySymbol={p.country.currency.symbol} offersHome={p.offersHome} next="/business/onboarding?step=services" />
            {p.services.length > 0 && nextHref && <Link href={nextHref} className={btn({ variant: "secondary" })}>Continue</Link>}
          </div>
        )}
        {p && step === "hours" && p.staff[0] && <div className="space-y-4"><HoursForm staffId={p.staff[0].id} hours={p.staff[0].workingHours} />{nextHref && <Link href={nextHref} className={btn({ variant: "secondary" })}>Continue</Link>}</div>}
        {p && step === "portfolio" && <div className="space-y-4"><PortfolioManager items={p.portfolio} />{nextHref && <Link href={nextHref} className={btn({ variant: "secondary" })}>Continue</Link>}</div>}
        {p && step === "verification" && <div className="space-y-6"><DocumentsManager docs={p.documents} required={p.country.requiresIdDocument} /><ConsentForm consent={p.verificationConsent} />{nextHref && <Link href={nextHref} className={btn({ variant: "secondary" })}>Continue</Link>}</div>}
        {p && step === "payout" && <div className="space-y-4"><PayoutMethods methods={p.payoutMethods} channels={p.country.payoutChannels} />{nextHref && <Link href={nextHref} className={btn({ variant: "secondary" })}>Continue</Link>}</div>}
        {p && step === "submit" && (
          <div className="space-y-4">
            <ul className="grid gap-2 text-sm sm:grid-cols-2">{checklist.map((c) => <li key={c.key} className={c.done ? "text-ok" : "text-bad"}>{c.done ? "✓" : "✗"} {c.label}</li>)}</ul>
            {!locked && p.status !== "APPROVED" && <SubmitApplication disabled={checklist.some((c) => !c.done)} />}
          </div>
        )}
      </Card>
    </>
  );
}
