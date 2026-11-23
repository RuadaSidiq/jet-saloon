import Link from "next/link";
import { notFound } from "next/navigation";
import { pageAdmin, hasPermission } from "@/server/auth/guards";
import { db } from "@/server/db";
import { providerBalances } from "@/server/modules/ledger";
import { applicationChecklist } from "@/server/modules/providers";
import { Act, QuickForm } from "@/components/ui/act";
import { portfolioModerationAction, providerDecisionAction, providerEditAction, providerFeatureAction } from "@/app/actions/admin";
import { dt, money } from "@/lib/format";
import { Badge, Card, PageHeader, StatusBadge, Table } from "@/components/ui";

export default async function ProviderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await pageAdmin("providers.view", `/admin/providers/${id}`);
  const p = await db.providerProfile.findUnique({
    where: { id },
    include: { user: true, city: true, neighbourhood: true, country: true, categories: { include: { category: true } }, services: { where: { deletedAt: null } }, portfolio: true, documents: true, payoutMethods: true, reviewLog: { orderBy: { createdAt: "desc" } }, staff: { include: { workingHours: true } },
      bookings: { orderBy: { createdAt: "desc" }, take: 15, include: { items: true } }, commissionRules: { orderBy: { effectiveFrom: "desc" } } },
  });
  if (!p) notFound();
  const [canVerify, canDocs, canManage, canPromote, canContent, canFinance] = await Promise.all(["providers.verify", "providers.documents", "providers.manage", "promotions.manage", "content.manage", "finance.view"].map((x) => hasPermission(admin.id, x as never)));
  const [checklist, balances, tickets] = await Promise.all([applicationChecklist(p.id), canFinance ? providerBalances(p.id) : Promise.resolve({} as Awaited<ReturnType<typeof providerBalances>>), db.supportTicket.count({ where: { category: "PROVIDER_COMPLAINT", booking: { providerId: p.id } } })]);
  const pid = { providerId: p.id };
  return (
    <>
      <PageHeader title={p.businessName} description={<>{p.user.email} · {p.user.phone ?? p.contactPhone} · {p.status === "APPROVED" ? <Link className="text-brand" href={`/provider/${p.slug}`}>public profile</Link> : `/provider/${p.slug}`}</>} actions={<StatusBadge status={p.status} />} />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Application">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-muted">Name</dt><dd>{p.displayName}</dd></div><div><dt className="text-muted">Type</dt><dd>{p.businessType.toLowerCase()}</dd></div><div><dt className="text-muted">Experience</dt><dd>{p.yearsExperience} yrs</dd></div>
              <div><dt className="text-muted">Location</dt><dd>{[p.neighbourhood?.name, p.city?.name, p.country.name].filter(Boolean).join(", ")}</dd></div>
              <div><dt className="text-muted">Delivery</dt><dd>{[p.offersStudio && "Studio", p.offersHome && "Home"].filter(Boolean).join(" + ")}</dd></div>
              <div><dt className="text-muted">Categories</dt><dd>{p.categories.map((c) => c.category.name).join(", ")}</dd></div>
              <div className="sm:col-span-3"><dt className="text-muted">Bio</dt><dd className="whitespace-pre-line">{p.bio ?? "—"}</dd></div>
              <div className="sm:col-span-3"><dt className="text-muted">Checklist</dt><dd className="flex flex-wrap gap-2">{checklist.map((c) => <Badge key={c.key} tone={c.done ? "ok" : "bad"}>{c.done ? "✓" : "✗"} {c.label}</Badge>)}</dd></div>
            </dl>
          </Card>
          <Card title="Verification documents">
            {!canDocs ? <p className="text-sm text-muted">Your role does not include access to identity documents.</p> : p.documents.length === 0 ? <p className="text-sm text-muted">None uploaded.</p> : (
              <ul className="space-y-2 text-sm">{p.documents.map((d) => <li key={d.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-2"><a href={`/api/files/document/${d.id}`} target="_blank" rel="noreferrer" className="text-brand">{d.type.replace(/_/g, " ").toLowerCase()} · {d.fileName}</a><span className="text-xs text-muted">{(d.sizeBytes / 1024).toFixed(0)} KB · {d.createdAt.toLocaleDateString("en-GB")}</span></li>)}</ul>
            )}
            {canDocs && <p className="mt-3 text-xs text-muted">Every document view is recorded in the audit log.</p>}
          </Card>
          <Card title={`Portfolio (${p.portfolio.length})`}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{p.portfolio.map((m) => (
              <div key={m.id} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.mediaType === "VIDEO" ? <video src={m.url} className="aspect-square w-full rounded-xl bg-black object-cover" /> : <img src={m.url} alt="" className={`aspect-square w-full rounded-xl object-cover ${m.approved ? "" : "opacity-40"}`} />}
                {canContent && <Act action={portfolioModerationAction} fields={{ id: m.id, approved: m.approved ? "false" : "true" }} label={m.approved ? "Hide" : "Show"} variant="ghost" />}
              </div>))}</div>
          </Card>
          <Card title="Services">
            <ul className="divide-y divide-line text-sm">{p.services.map((s) => <li key={s.id} className="flex justify-between py-2"><span>{s.name} {!s.active && <Badge>inactive</Badge>}</span><span className="tabular">{money(s.priceMinor, s.currency)} · {s.durationMinutes}m</span></li>)}</ul>
          </Card>
          <Card title="Recent bookings" action={<Link href={`/admin/bookings?provider=${p.id}`} className="text-sm text-brand">All</Link>}>
            <Table head={["Ref", "When", "Services", "Total", "Status"]}>{p.bookings.map((b) => <tr key={b.id}><td><Link className="text-brand" href={`/admin/bookings/${b.reference}`}>{b.reference}</Link></td><td>{dt(b.startsAt, b.timezone)}</td><td>{b.items.map((i) => i.nameSnapshot).join(", ")}</td><td className="tabular">{money(b.totalMinor, b.currency)}</td><td><StatusBadge status={b.status} /></td></tr>)}</Table>
            <p className="mt-2 text-xs text-muted">{tickets} complaint ticket(s) linked to this provider&apos;s bookings.</p>
          </Card>
        </div>
        <aside className="space-y-6">
          {canVerify && ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"].includes(p.status) && (
            <Card title="Decision">
              <div className="space-y-4">
                {p.status === "SUBMITTED" && <Act action={providerDecisionAction} fields={{ ...pid, to: "UNDER_REVIEW" }} label="Start review" />}
                {p.status !== "INFO_REQUESTED" && <Act action={providerDecisionAction} fields={{ ...pid, to: "APPROVED" }} label="Approve" variant="primary" size="md" confirm="Approve this provider? Their profile will go live." />}
                <QuickForm action={providerDecisionAction} hidden={{ ...pid, to: "INFO_REQUESTED" }} submit="Request more information" columns={1} fields={[{ name: "note", label: "What do you need?", type: "textarea", required: true }]} />
                <QuickForm action={providerDecisionAction} hidden={{ ...pid, to: "REJECTED" }} submit="Reject" columns={1} confirm="Reject this application?" fields={[{ name: "note", label: "Reason (sent to the applicant)", type: "textarea", required: true }]} />
              </div>
            </Card>
          )}
          {canManage && p.status === "APPROVED" && <Card title="Suspend"><QuickForm action={providerDecisionAction} hidden={{ ...pid, to: "SUSPENDED" }} submit="Suspend provider" columns={1} confirm="Suspend? They will disappear from search and can't take new bookings." fields={[{ name: "note", label: "Reason", type: "textarea", required: true }]} /></Card>}
          {canManage && p.status === "SUSPENDED" && <Card title="Reactivate"><Act action={providerDecisionAction} fields={{ ...pid, to: "APPROVED", reactivate: "1" }} label="Reactivate provider" variant="primary" /></Card>}
          {canPromote && p.status === "APPROVED" && <Card title="Featured listing"><QuickForm action={providerFeatureAction} hidden={pid} columns={1} fields={[{ name: "featured", label: "Feature on homepage and search", type: "checkbox", defaultValue: String(p.featured) }, { name: "until", label: "Until (optional)", type: "date", defaultValue: p.featuredUntil?.toISOString().slice(0, 10) }]} /></Card>}
          {canManage && <Card title="Edit"><QuickForm action={providerEditAction} hidden={pid} columns={1} fields={[{ name: "businessName", label: "Business name", defaultValue: p.businessName }, { name: "bookingMode", label: "Booking mode", type: "select", defaultValue: p.bookingMode, options: [["INSTANT", "Instant"], ["APPROVAL", "Approval"]] }, { name: "bio", label: "Bio", type: "textarea", defaultValue: p.bio ?? "" }]} /></Card>}
          {canFinance && <Card title="Balances">{Object.entries(balances).length === 0 ? <p className="text-sm text-muted">No ledger activity.</p> : Object.entries(balances).map(([c, b]) => <dl key={c} className="space-y-1 text-sm"><div className="flex justify-between"><dt>Pending</dt><dd className="tabular">{money(b.pending, c)}</dd></div><div className="flex justify-between"><dt>Available</dt><dd className="tabular">{money(b.available, c)}</dd></div><div className="flex justify-between"><dt>In payout</dt><dd className="tabular">{money(b.reserved, c)}</dd></div></dl>)}
            <p className="mt-3 text-xs text-muted">{p.payoutMethods.length} payout method(s) · commission overrides: {p.commissionRules.length ? p.commissionRules.map((r) => `${r.rateBps / 100}%`).join(", ") : "none"}</p></Card>}
          <Card title="Status history"><ul className="space-y-2 text-sm">{p.reviewLog.map((l) => <li key={l.id}><StatusBadge status={l.toStatus} /> <span className="text-xs text-muted">{l.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>{l.note && <p className="text-xs">{l.note}</p>}</li>)}</ul></Card>
        </aside>
      </div>
    </>
  );
}
