"use client";
import { useState } from "react";
import { serviceAction } from "@/app/actions/business";
import { ActionForm, Submit } from "@/components/ui/form";
import { Check, Field, Input, Select, Textarea } from "@/components/ui";

type Cat = { id: string; name: string; children: { id: string; name: string }[] };
export type ServiceInitial = { id?: string; name?: string; categoryId?: string; subcategoryId?: string | null; description?: string | null; price?: string; promoPrice?: string; durationMinutes?: number; prepMinutes?: number; cleanupMinutes?: number; homeServiceAvailable?: boolean; homeTravelFee?: string; active?: boolean };

export function ServiceForm({ categories, initial = {}, currencySymbol, offersHome, next }: { categories: Cat[]; initial?: ServiceInitial; currencySymbol: string; offersHome: boolean; next?: string }) {
  const [cat, setCat] = useState(initial.categoryId ?? categories[0]?.id ?? "");
  const subs = categories.find((c) => c.id === cat)?.children ?? [];
  return (
    <ActionForm action={serviceAction} className="space-y-4" resetOnSuccess={!initial.id && !!next}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service name" className="sm:col-span-2"><Input name="name" defaultValue={initial.name} required placeholder="e.g. Bridal makeup" /></Field>
        <Field label="Category"><Select name="categoryId" value={cat} onChange={(e) => setCat(e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Subcategory"><Select name="subcategoryId" defaultValue={initial.subcategoryId ?? ""}><option value="">—</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label={`Price (${currencySymbol})`}><Input name="price" inputMode="decimal" defaultValue={initial.price} required placeholder="250" /></Field>
        <Field label={`Promotional price (${currencySymbol}, optional)`}><Input name="promoPrice" inputMode="decimal" defaultValue={initial.promoPrice} /></Field>
        <Field label="Duration (minutes)"><Input name="durationMinutes" type="number" min={5} max={720} step={5} defaultValue={initial.durationMinutes ?? 60} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prep time (min)" hint="Blocked before"><Input name="prepMinutes" type="number" min={0} max={240} step={5} defaultValue={initial.prepMinutes ?? 0} /></Field>
          <Field label="Clean-up (min)" hint="Blocked after"><Input name="cleanupMinutes" type="number" min={0} max={240} step={5} defaultValue={initial.cleanupMinutes ?? 0} /></Field>
        </div>
      </div>
      <Field label="Description"><Textarea name="description" defaultValue={initial.description ?? ""} rows={3} maxLength={1500} /></Field>
      {offersHome && <div className="grid items-end gap-4 sm:grid-cols-2"><Check name="homeServiceAvailable" defaultChecked={initial.homeServiceAvailable} label="Available as a home service" /><Field label={`Travel fee (${currencySymbol})`}><Input name="homeTravelFee" inputMode="decimal" defaultValue={initial.homeTravelFee} /></Field></div>}
      <Field label="Photo (optional)"><Input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="pt-1.5" /></Field>
      {initial.id && <Check name="active" defaultChecked={initial.active ?? true} label="Active (bookable)" />}
      {initial.id && <input type="hidden" name="active" value="false" />}
      <Submit>{initial.id ? "Save changes" : "Add service"}</Submit>
    </ActionForm>
  );
}
