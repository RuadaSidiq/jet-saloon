import { pageUser } from "@/server/auth/guards";
import { adminMfaRequired } from "@/server/auth/mfa";
import { db } from "@/server/db";
import { MfaSetup } from "@/components/security/forms";
import { Act, QuickForm } from "@/components/ui/act";
import { disableMfaAction, signOutOthersAction } from "@/app/actions/security";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Security" };

export default async function Security({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const user = await pageUser("/account/security");
  const { required } = await searchParams;
  const sessions = await db.session.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } });
  const enforced = user.role === "ADMIN" && adminMfaRequired();
  return (
    <>
      <PageHeader title="Security" description="Protect your account with two-factor authentication and review where you're signed in." />
      {required && !user.totpEnabledAt && <div className="mb-6"><Notice tone="warn">Administrators must turn on two-factor authentication before using admin tools.</Notice></div>}
      <div className="space-y-6">
        <Card title={<span className="flex items-center gap-2">Two-factor authentication {user.totpEnabledAt ? <Badge tone="ok">On</Badge> : <Badge tone="warn">Off</Badge>}</span>}>
          {user.totpEnabledAt ? (
            <div className="space-y-4 text-sm">
              <p>Turned on {user.totpEnabledAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}. You&apos;ll be asked for a code from your authenticator app when you sign in. {user.recoveryCodeHashes.length} recovery codes left.</p>
              {enforced ? <p className="text-muted">Required for administrator accounts.</p> : (
                <details><summary className="cursor-pointer text-brand">Turn off two-factor authentication</summary>
                  <div className="mt-3 max-w-md"><QuickForm action={disableMfaAction} submit="Turn off" columns={1} fields={[{ name: "password", label: "Current password", type: "password", required: true }, { name: "code", label: "Code from your app (or a recovery code)", required: true }]} /></div>
                </details>
              )}
            </div>
          ) : <><p className="mb-4 text-sm text-muted">Even if someone learns your password, they can&apos;t sign in without your phone.</p><MfaSetup /></>}
        </Card>
        <Card title="Where you're signed in" action={sessions.length > 1 && <Act action={signOutOthersAction} fields={{}} label="Sign out other devices" />}>
          <ul className="divide-y divide-white/60 text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0 truncate">{(s.userAgent ?? "Unknown device").slice(0, 80)}</span>
                <span className="text-xs text-muted">Last active {s.lastSeenAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Changing your password also signs out every other device.</p>
        </Card>
      </div>
    </>
  );
}
