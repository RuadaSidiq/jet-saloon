"use client";
import { useEffect, useState } from "react";
import { rescheduleAction, rescheduleRequestAction } from "@/app/actions/booking";
import { ActionForm, Submit } from "@/components/ui/form";
import { Input } from "@/components/ui";

export function Reschedule({ bookingRef, providerId, serviceIds, timezone, as }: { bookingRef: string; providerId: string; serviceIds: string[]; timezone: string; as: "customer" | "provider" }) {
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ startsAt: string }[]>([]);
  const [slot, setSlot] = useState("");
  useEffect(() => {
    if (!date) return;
    fetch(`/api/availability?provider=${providerId}&services=${serviceIds.join(",")}&date=${date}`).then((r) => r.json()).then((d) => setSlots(d.slots ?? []));
  }, [date, providerId, serviceIds]);
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
  return (
    <div className="space-y-4">
      <ActionForm action={rescheduleAction}>
        <input type="hidden" name="ref" value={bookingRef} /><input type="hidden" name="as" value={as} /><input type="hidden" name="startsAt" value={slot} />
        <label className="text-sm font-medium">Move to a new time</label>
        <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSlot(""); }} className="mt-1.5" />
        {date && <div className="mt-2 flex flex-wrap gap-1.5">{slots.length ? slots.map((s) => <button type="button" key={s.startsAt} onClick={() => setSlot(s.startsAt)} className={`tabular rounded-xl border px-2 py-1 text-xs ${slot === s.startsAt ? "border-brand bg-brand text-white" : "border-line"}`}>{fmt.format(new Date(s.startsAt))}</button>) : <span className="text-xs text-muted">No openings that day</span>}</div>}
        <div className="mt-3"><Submit size="sm">Confirm new time</Submit></div>
      </ActionForm>
      <ActionForm action={rescheduleRequestAction} resetOnSuccess>
        <input type="hidden" name="ref" value={bookingRef} /><input type="hidden" name="as" value={as} />
        <label className="text-sm font-medium">Or ask the other party to suggest a time</label>
        <Input name="note" required placeholder="e.g. Could we do Saturday morning instead?" className="mt-1.5" />
        <div className="mt-2"><Submit size="sm" variant="secondary">Send request</Submit></div>
      </ActionForm>
    </div>
  );
}
