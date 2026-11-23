"use client";
import { useState } from "react";
import { basicsAction } from "@/app/actions/business";
import { ActionForm, Submit } from "@/components/ui/form";
import { Check, Field, Input, Select, Textarea } from "@/components/ui";

type Country = { id: string; name: string; phoneCountryCode: string; cities: { id: string; name: string; neighbourhoods: { id: string; name: string }[] }[] };
type Initial = Partial<{ displayName: string; businessName: string; businessType: string; contactPhone: string; countryId: string; cityId: string; neighbourhoodId: string; bio: string; yearsExperience: number; offersStudio: boolean; offersHome: boolean; studioAddress: string; categoryIds: string[] }>;

export function BasicsForm({ countries, categories, initial, next }: { countries: Country[]; categories: { id: string; name: string }[]; initial: Initial; next?: string }) {
  const [countryId, setCountryId] = useState(initial.countryId ?? countries[0]?.id ?? "");
  const country = countries.find((c) => c.id === countryId);
  const [cityId, setCityId] = useState(initial.cityId ?? "");
  const city = country?.cities.find((c) => c.id === cityId);
  return (
    <ActionForm action={basicsAction} className="space-y-6">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name (as shown to customers)"><Input name="displayName" defaultValue={initial.displayName} required /></Field>
        <Field label="Business name" hint="Your profile link is based on this."><Input name="businessName" defaultValue={initial.businessName} required /></Field>
        <Field label="Business type"><Select name="businessType" defaultValue={initial.businessType ?? "INDIVIDUAL"}><option value="INDIVIDUAL">Independent professional</option><option value="STUDIO">Studio</option><option value="SALON">Salon / barbershop</option><option value="MOBILE">Mobile-only service</option></Select></Field>
        <Field label="Years of experience"><Input name="yearsExperience" type="number" min={0} max={70} defaultValue={initial.yearsExperience ?? 0} /></Field>
        <Field label="Country"><Select name="countryId" value={countryId} onChange={(e) => { setCountryId(e.target.value); setCityId(""); }}>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label={`Phone number (${country?.phoneCountryCode ?? ""})`}><Input name="phone" type="tel" defaultValue={initial.contactPhone ?? ""} required placeholder="024 123 4567" /></Field>
        <Field label="City"><Select name="cityId" value={cityId} onChange={(e) => setCityId(e.target.value)} required><option value="">Choose…</option>{country?.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Neighbourhood"><Select name="neighbourhoodId" defaultValue={initial.neighbourhoodId ?? ""}><option value="">—</option>{city?.neighbourhoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</Select></Field>
      </div>
      <Field label="About you" hint="Tell customers about your experience, style and specialities."><Textarea name="bio" defaultValue={initial.bio ?? ""} rows={5} maxLength={2000} /></Field>
      <fieldset>
        <legend className="text-sm font-medium">Service categories</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">{categories.map((c) => <Check key={c.id} name="categoryIds" value={c.id} defaultChecked={initial.categoryIds?.includes(c.id)} label={c.name} />)}</div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Where do you work?</legend>
        <Check name="offersStudio" defaultChecked={initial.offersStudio ?? true} label="Customers come to my studio / salon" />
        <Check name="offersHome" defaultChecked={initial.offersHome ?? false} label="I travel to customers' homes" />
        <Field label="Studio address" hint="Private — only shared with customers after a booking is confirmed."><Input name="studioAddress" defaultValue={initial.studioAddress ?? ""} /></Field>
      </fieldset>
      <Field label="Profile photo"><Input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" className="pt-1.5" /></Field>
      <Submit>{next ? "Save and continue" : "Save"}</Submit>
    </ActionForm>
  );
}
