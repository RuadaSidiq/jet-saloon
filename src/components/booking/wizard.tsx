"use client";
import { useEffect, useMemo, useState } from "react";
import { createBookingAction } from "@/app/actions/booking";
import { ActionForm, Submit } from "@/components/ui/form";
import { Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { money, type Cur } from "@/lib/format";
import { cn } from "@/lib/cn";

type Service = { id: string; name: string; durationMinutes: number; priceMinor: number; promoPriceMinor: number | null; homeServiceAvailable: boolean; homeTravelFeeMinor: number };
type Props = {
  provider: { id: string; timezone: string; offersStudio: boolean; offersHome: boolean; bookingMode: "INSTANT" | "APPROVAL"; maxAdvanceDays: number };
  services: Service[]; currency: Cur; preselect?: string; areas: { cityId: string; name: string; feeMinor: number }[];
};

function localDays(tz: string, n: number) {
  const out: { iso: string; label: string; wd: string }[] = [];
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const lab = new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short" });
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" });
  for (let i = 0; i < n; i++) { const d = new Date(Date.now() + i * 864e5); out.push({ iso: fmt.format(d), label: lab.format(d), wd: wd.format(d) }); }
  return out;
}

export function BookingWizard({ provider, services, currency, preselect, areas }: Props) {
  const [selected, setSelected] = useState<string[]>(preselect ? [preselect] : services.length === 1 ? [services[0].id] : []);
  const [location, setLocation] = useState<"STUDIO" | "HOME">(provider.offersStudio ? "STUDIO" : "HOME");
  const [homeCity, setHomeCity] = useState(areas[0]?.cityId ?? "");
  const days = useMemo(() => localDays(provider.timezone, Math.min(provider.maxAdvanceDays, 30)), [provider]);
  const [date, setDate] = useState(days[0].iso);
  const [slots, setSlots] = useState<{ startsAt: string }[] | null>(null);
  const [slot, setSlot] = useState("");
  const [idem] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random()));

  const chosen = services.filter((s) => selected.includes(s.id));
  const homeOk = provider.offersHome && chosen.length > 0 && chosen.every((s) => s.homeServiceAvailable);
  const subtotal = chosen.reduce((s, x) => s + (x.promoPriceMinor ?? x.priceMinor), 0);
  const travel = location === "HOME" ? Math.max(areas.find((a) => a.cityId === homeCity)?.feeMinor ?? 0, ...chosen.map((s) => s.homeTravelFeeMinor)) : 0;
  const duration = chosen.reduce((s, x) => s + x.durationMinutes, 0);
  const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: provider.timezone, hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    if (location === "HOME" && !homeOk) setLocation("STUDIO");
  }, [homeOk, location]);

  useEffect(() => {
    setSlot("");
    if (!chosen.length) { setSlots(null); return; }
    let live = true;
    setSlots(null);
    fetch(`/api/availability?provider=${provider.id}&services=${selected.join(",")}&date=${date}`, { cache: "no-store" })
      .then((r) => r.json()).then((d) => live && setSlots(d.slots ?? [])).catch(() => live && setSlots([]));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.join(","), date, provider.id]);

  return (
    <ActionForm action={createBookingAction} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className="rounded-[--radius-card] border border-line bg-white p-5">
          <h2 className="font-semibold">1. Choose services</h2>
          <ul className="mt-4 space-y-2">
            {services.map((s) => (
              <li key={s.id}>
                <label className={cn("flex cursor-pointer items-center gap-3 rounded-md border p-3", selected.includes(s.id) ? "border-brand bg-brand-soft" : "border-line")}>
                  <input type="checkbox" name="serviceIds" value={s.id} checked={selected.includes(s.id)} onChange={(e) => setSelected((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)))} className="size-4 accent-brand" />
                  <span className="flex-1"><span className="font-medium">{s.name}</span><span className="block text-xs text-muted">{s.durationMinutes} min</span></span>
                  <span className="tabular text-sm font-semibold">{money(s.promoPriceMinor ?? s.priceMinor, currency)}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[--radius-card] border border-line bg-white p-5">
          <h2 className="font-semibold">2. Where?</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {provider.offersStudio && <button type="button" onClick={() => setLocation("STUDIO")} className={cn("rounded-md border px-4 py-2 text-sm", location === "STUDIO" ? "border-brand bg-brand-soft text-brand-dark" : "border-line")}>At the studio</button>}
            {provider.offersHome && <button type="button" disabled={!homeOk} onClick={() => setLocation("HOME")} className={cn("rounded-md border px-4 py-2 text-sm disabled:opacity-40", location === "HOME" ? "border-brand bg-brand-soft text-brand-dark" : "border-line")}>At my home</button>}
          </div>
          {provider.offersHome && !homeOk && chosen.length > 0 && <p className="mt-2 text-xs text-muted">Home service isn&apos;t available for every selected service.</p>}
          <input type="hidden" name="locationType" value={location} />
          {location === "HOME" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {areas.length > 0 && <Field label="Your area"><Select name="homeCityId" value={homeCity} onChange={(e) => setHomeCity(e.target.value)}>{areas.map((a) => <option key={a.cityId} value={a.cityId}>{a.name}</option>)}</Select></Field>}
              <Field label="Address" hint="Only shared with your professional." className="sm:col-span-2"><Input name="homeAddress" required minLength={5} placeholder="House number, street, landmark" /></Field>
            </div>
          )}
        </section>

        <section className="rounded-[--radius-card] border border-line bg-white p-5">
          <h2 className="font-semibold">3. Pick a time</h2>
          <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2">
            {days.map((d) => (
              <button type="button" key={d.iso} onClick={() => setDate(d.iso)} className={cn("flex w-16 shrink-0 flex-col items-center rounded-md border py-2 text-sm", date === d.iso ? "border-brand bg-brand text-white" : "border-line hover:border-brand-mid")}>
                <span className="text-xs opacity-80">{d.wd}</span><span className="font-medium">{d.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-3">
            {!chosen.length ? <p className="text-sm text-muted">Choose a service to see available times.</p>
              : slots === null ? <p className="text-sm text-muted">Checking availability…</p>
              : slots.length === 0 ? <p className="text-sm text-muted">No openings on this day. Try another date.</p>
              : <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{slots.map((s) => (
                  <button type="button" key={s.startsAt} onClick={() => setSlot(s.startsAt)} className={cn("tabular rounded-md border py-2 text-sm", slot === s.startsAt ? "border-brand bg-brand text-white" : "border-line hover:border-brand-mid")}>{timeFmt.format(new Date(s.startsAt))}</button>
                ))}</div>}
          </div>
          <input type="hidden" name="startsAt" value={slot} />
          <p className="mt-3 text-xs text-muted">Times are local to the professional ({provider.timezone.replace("_", " ")}).</p>
        </section>

        <section className="rounded-[--radius-card] border border-line bg-white p-5">
          <h2 className="font-semibold">4. Anything else?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Note for your professional (optional)" className="sm:col-span-2"><Textarea name="note" rows={3} maxLength={1000} /></Field>
            <Field label="Promo code (optional)"><Input name="couponCode" autoCapitalize="characters" /></Field>
          </div>
        </section>
      </div>

      <aside className="h-fit space-y-4 rounded-[--radius-card] border border-line bg-white p-5 lg:sticky lg:top-20">
        <h2 className="font-semibold">Summary</h2>
        <dl className="space-y-2 text-sm">
          {chosen.map((s) => <div key={s.id} className="flex justify-between gap-2"><dt>{s.name}</dt><dd className="tabular">{money(s.promoPriceMinor ?? s.priceMinor, currency)}</dd></div>)}
          {travel > 0 && <div className="flex justify-between"><dt>Travel fee</dt><dd className="tabular">{money(travel, currency)}</dd></div>}
          <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Total</dt><dd className="tabular">{money(subtotal + travel, currency)}</dd></div>
          {duration > 0 && <div className="flex justify-between text-muted"><dt>Duration</dt><dd>{duration} min</dd></div>}
          {slot && <div className="flex justify-between text-muted"><dt>Time</dt><dd>{new Date(slot).toLocaleString("en-GB", { timeZone: provider.timezone, dateStyle: "medium", timeStyle: "short" })}</dd></div>}
        </dl>
        <p className="text-xs text-muted">Promo codes are applied on the next step.</p>
        <input type="hidden" name="providerId" value={provider.id} />
        <input type="hidden" name="idempotencyKey" value={idem} />
        {provider.bookingMode === "APPROVAL" && <Notice>This professional confirms requests first. You won&apos;t be charged unless they accept.</Notice>}
        <Submit size="lg" className="w-full" pendingText="Reserving your slot…">{provider.bookingMode === "APPROVAL" ? "Send request" : "Continue to payment"}</Submit>
      </aside>
    </ActionForm>
  );
}
