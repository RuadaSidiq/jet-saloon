import { pageUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { QuickForm } from "@/components/ui/act";
import { Act } from "@/components/ui/act";
import { addressAction, passwordAction, prefsAction, profileAction } from "@/app/actions/account";
import { Card, PageHeader } from "@/components/ui";

export default async function Settings() {
  const user = await pageUser("/account/settings");
  const [countries, addresses] = await Promise.all([
    db.country.findMany({ where: { active: true }, include: { cities: { orderBy: { name: "asc" } } } }),
    db.address.findMany({ where: { userId: user.id } }),
  ]);
  const prefs = user.notificationPrefs as { email?: boolean; sms?: boolean; marketing?: boolean };
  return (
    <>
      <PageHeader title="Settings" description={`Referral code: ${user.referralCode} — share it with friends when they sign up.`} />
      <div className="space-y-6">
        <Card title="Profile">
          <QuickForm action={profileAction} fields={[
            { name: "name", label: "Full name", defaultValue: user.name, required: true },
            { name: "phone", label: "Phone number", defaultValue: user.phone ?? "", hint: user.phone ? (user.phoneVerifiedAt ? "Verified" : "Not yet verified") : "Used for appointment SMS" },
            { name: "countryId", label: "Country", type: "select", defaultValue: user.countryId ?? "", options: countries.map((c) => [c.id, c.name]) },
            { name: "cityId", label: "City", type: "select", defaultValue: user.cityId ?? "", options: [["", "—"], ...countries.flatMap((c) => c.cities.map((ci) => [ci.id, ci.name] as [string, string]))] },
            { name: "avatar", label: "Profile photo", type: "file" },
          ]} />
          <p className="mt-4 text-xs text-muted">Email: {user.email} {user.emailVerifiedAt ? "(verified)" : "(not verified)"}</p>
        </Card>
        <Card title="Saved addresses">
          {addresses.length > 0 && <ul className="mb-4 space-y-2 text-sm">{addresses.map((a) => <li key={a.id} className="flex items-center justify-between gap-2 rounded border border-line p-3"><span><span className="font-medium">{a.label}:</span> {a.line1}, {a.cityName}</span><Act action={addressAction} fields={{ delete: a.id }} label="Remove" variant="ghost" /></li>)}</ul>}
          <QuickForm action={addressAction} resetOnSuccess submit="Add address" columns={3} fields={[{ name: "label", label: "Label", placeholder: "Home" }, { name: "line1", label: "Address", required: true }, { name: "cityName", label: "City", required: true }]} />
        </Card>
        <Card title="Notifications & privacy">
          <QuickForm action={prefsAction} columns={1} fields={[
            { name: "email", label: "Email me about my bookings", type: "checkbox", defaultValue: String(prefs.email !== false) },
            { name: "sms", label: "Send SMS reminders and confirmations", type: "checkbox", defaultValue: String(prefs.sms !== false) },
            { name: "marketing", label: "Send me offers and news", type: "checkbox", defaultValue: String(!!prefs.marketing) },
            { name: "showProfile", label: "Show my profile photo to professionals I book", type: "checkbox", defaultValue: String(user.showProfileToProviders) },
          ]} />
        </Card>
        <Card title="Password">
          <QuickForm action={passwordAction} resetOnSuccess submit="Change password" fields={[{ name: "current", label: "Current password", type: "password", required: true }, { name: "next", label: "New password", type: "password", required: true, hint: "At least 8 characters with a letter and a number" }]} />
        </Card>
      </div>
    </>
  );
}
