"use client";
import { useState } from "react";
import { hoursAction } from "@/app/actions/business";
import { ActionForm, Submit } from "@/components/ui/form";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Weekly hours with an optional second window per day (models a lunch break). */
export function HoursForm({ staffId, hours }: { staffId: string; hours: { weekday: number; startMinute: number; endMinute: number }[] }) {
  const byDay = (d: number) => hours.filter((h) => h.weekday === d).sort((a, b) => a.startMinute - b.startMinute);
  const [on, setOn] = useState(() => DAYS.map((_, d) => byDay(d).length > 0));
  return (
    <ActionForm action={hoursAction}>
      <input type="hidden" name="staffId" value={staffId} />
      <div className="divide-y divide-line">
        {DAYS.map((name, d) => {
          const w = byDay(d);
          return (
            <div key={d} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <label className="flex w-40 items-center gap-2 text-sm font-medium"><input type="checkbox" name={`d${d}_on`} checked={on[d]} onChange={(e) => setOn((o) => o.map((v, i) => (i === d ? e.target.checked : v)))} className="size-4 accent-brand" />{name}</label>
              {on[d] ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <input type="time" name={`d${d}_s1`} defaultValue={w[0] ? hm(w[0].startMinute) : "09:00"} className="h-9 rounded-xl border border-line px-2" aria-label={`${name} opens`} />–
                  <input type="time" name={`d${d}_e1`} defaultValue={w[0] ? hm(w[0].endMinute) : "17:00"} className="h-9 rounded-xl border border-line px-2" aria-label={`${name} closes`} />
                  <span className="px-1 text-xs text-muted">then (optional, after a break)</span>
                  <input type="time" name={`d${d}_s2`} defaultValue={w[1] ? hm(w[1].startMinute) : ""} className="h-9 rounded-xl border border-line px-2" aria-label={`${name} reopens`} />–
                  <input type="time" name={`d${d}_e2`} defaultValue={w[1] ? hm(w[1].endMinute) : ""} className="h-9 rounded-xl border border-line px-2" aria-label={`${name} closes again`} />
                </div>
              ) : <span className="text-sm text-muted">Closed</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-4"><Submit>Save hours</Submit></div>
    </ActionForm>
  );
}
