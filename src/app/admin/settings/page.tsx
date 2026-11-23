import { pageAdmin } from "@/server/auth/guards";
import { getAllSettings, SETTING_DEFAULTS } from "@/server/modules/settings";
import { QuickForm, type FieldDef } from "@/components/ui/act";
import { settingsAction } from "@/app/actions/admin";
import { Card, PageHeader } from "@/components/ui";

const LABELS: Record<string, [string, string?]> = {
  "general.platformName": ["Platform name"], "general.supportEmail": ["Support email"], "general.supportPhone": ["Support phone"],
  "booking.defaultMode": ["Default booking mode for new providers"], "booking.paymentHoldMinutes": ["Payment hold (minutes)", "How long a slot is held while the customer pays"],
  "booking.approvalWindowHours": ["Approval / payment window (hours)", "For approval-mode bookings"], "booking.reminderHoursBefore": ["Reminder (hours before)"],
  "booking.customerFreeCancelHours": ["Default free-cancellation window (hours)"], "finance.settlementDelayHours": ["Settlement delay (hours)", "Time after completion before earnings are withdrawable"],
  "finance.defaultCommissionBps": ["Fallback commission (basis points)", "1500 = 15%. Used only when no commission rule matches"], "provider.requireIdDocument": ["Require ID documents (global)"],
  "seo.title": ["SEO title"], "seo.description": ["SEO description"], "legal.terms": ["Terms of service"], "legal.privacy": ["Privacy policy"], "legal.refundPolicy": ["Refund policy"],
};
const GROUPS: [string, string][] = [["general", "General & branding"], ["booking", "Booking policies"], ["finance", "Finance"], ["provider", "Provider verification"], ["seo", "SEO"], ["legal", "Legal documents"]];

export default async function SettingsPage() {
  await pageAdmin("settings.manage");
  const s = await getAllSettings();
  const field = (k: keyof typeof SETTING_DEFAULTS): FieldDef => {
    const def = SETTING_DEFAULTS[k];
    const [label, hint] = LABELS[k] ?? [k];
    if (k === "booking.defaultMode") return { name: k, label, type: "select", defaultValue: String(s[k]), options: [["INSTANT", "Instant"], ["APPROVAL", "Approval"]] };
    if (typeof def === "boolean") return { name: k, label, hint, type: "select", defaultValue: String(s[k]), options: [["true", "Yes"], ["false", "No"]] };
    if (k.startsWith("legal.")) return { name: k, label, type: "textarea", defaultValue: String(s[k]) };
    return { name: k, label, hint, type: typeof def === "number" ? "number" : "text", defaultValue: String(s[k]) };
  };
  return (
    <>
      <PageHeader title="Platform settings" description="Payment gateway, email and SMS credentials are configured as environment variables (see docs/DEPLOYMENT.md) — never stored here." />
      <div className="space-y-6">{GROUPS.map(([g, title]) => (
        <Card key={g} title={title}><QuickForm action={settingsAction} fields={(Object.keys(SETTING_DEFAULTS) as (keyof typeof SETTING_DEFAULTS)[]).filter((k) => k.startsWith(g + ".")).map(field)} /></Card>
      ))}</div>
    </>
  );
}
