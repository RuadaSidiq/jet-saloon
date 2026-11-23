import { pageProvider } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ConsentForm, DocumentsManager } from "@/components/business/sections";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
export default async function Verification() {
  const { provider } = await pageProvider("/business/verification");
  const p = await db.providerProfile.findUniqueOrThrow({ where: { id: provider.id }, include: { documents: true, country: true, reviewLog: { orderBy: { createdAt: "desc" }, take: 10 } } });
  return (<><PageHeader title="Verification" actions={<StatusBadge status={p.status} />} />
    <div className="space-y-6"><Card title="Documents"><DocumentsManager docs={p.documents} required={p.country.requiresIdDocument} /></Card><ConsentForm consent={p.verificationConsent} />
      {p.reviewLog.length > 0 && <Card title="History"><ul className="space-y-2 text-sm">{p.reviewLog.map((l) => <li key={l.id}><StatusBadge status={l.toStatus} /> <span className="text-muted">{l.createdAt.toLocaleDateString("en-GB")}</span>{l.note && <span> — {l.note}</span>}</li>)}</ul></Card>}</div></>);
}
