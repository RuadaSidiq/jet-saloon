import { pageProvider } from "@/server/auth/guards";
import { db } from "@/server/db";
import { HoursForm } from "@/components/business/hours-form";
import { Act, QuickForm } from "@/components/ui/act";
import { staffAction, timeOffAction } from "@/app/actions/business";
import { dt } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function Availability() {
  const { provider: p } = await pageProvider("/business/availability");
  const staff = await db.staff.findMany({ where: { providerId: p.id }, orderBy: [{ isOwner: "desc" }, { name: "asc" }], include: { workingHours: true, timeOff: { where: { endsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" } } } });
  return (
    <>
      <PageHeader title="Hours & time off" description="Customers can only book times inside your working hours, outside time off and existing bookings." />
      <div className="space-y-6">
        {staff.map((s) => (
          <Card key={s.id} title={<span className="flex items-center gap-2">{s.name}{s.isOwner && <Badge tone="brand">You</Badge>}{!s.active && <Badge>Inactive</Badge>}</span>} action={!s.isOwner && <Act action={staffAction} fields={{ toggle: s.id }} label={s.active ? "Deactivate" : "Activate"} variant="ghost" />}>
            <HoursForm staffId={s.id} hours={s.workingHours} />
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-sm font-semibold">Holidays & blocked time</h3>
              {s.timeOff.length > 0 && <ul className="mt-3 space-y-2 text-sm">{s.timeOff.map((t) => <li key={t.id} className="flex items-center justify-between rounded border border-line px-3 py-2"><span>{dt(t.startsAt, p.timezone)} → {dt(t.endsAt, p.timezone)}{t.reason && <span className="text-muted"> · {t.reason}</span>}</span><Act action={timeOffAction} fields={{ delete: t.id }} label="Remove" variant="ghost" /></li>)}</ul>}
              <div className="mt-4"><QuickForm action={timeOffAction} hidden={{ staffId: s.id }} resetOnSuccess submit="Block this time" columns={3} fields={[
                { name: "from", label: "From date", type: "date", required: true }, { name: "fromTime", label: "From time", placeholder: "00:00", hint: "Leave blank for whole day" }, { name: "to", label: "To date", type: "date", required: true },
                { name: "toTime", label: "To time", placeholder: "23:59" }, { name: "reason", label: "Reason (private)", placeholder: "Holiday" },
              ]} /></div>
            </div>
          </Card>
        ))}
        <Card title="Add a team member" ><p className="mb-3 text-sm text-muted">Each team member has their own calendar, so you can take parallel bookings.</p><QuickForm action={staffAction} resetOnSuccess submit="Add" columns={1} fields={[{ name: "name", label: "Name", required: true }]} /></Card>
      </div>
    </>
  );
}
