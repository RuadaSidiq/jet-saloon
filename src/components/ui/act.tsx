"use client";
import type { ActionResult } from "@/server/errors";
import { ActionForm, Submit } from "./form";
import { Field, Input, Select, Textarea } from "./index";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/** One-click action button with hidden fields (optionally confirmed). */
export function Act({ action, fields, label, variant = "secondary", size = "sm", confirm, reason, reasonName = "reason" }: {
  action: Action; fields: Record<string, string>; label: string; variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" | "md"; confirm?: string; reason?: string; reasonName?: string;
}) {
  return (
    <ActionForm action={action} confirm={confirm} className="inline-block">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {reason && <Input name={reasonName} placeholder={reason} className="mb-2 h-9" required />}
      <Submit variant={variant} size={size} pendingText="…">{label}</Submit>
    </ActionForm>
  );
}

export type FieldDef = { name: string; label: string; type?: "text" | "textarea" | "number" | "date" | "datetime-local" | "email" | "select" | "checkbox" | "file" | "password"; options?: [string, string][]; defaultValue?: string; required?: boolean; hint?: string; placeholder?: string; full?: boolean };

/** Declarative form for admin/provider settings screens. */
export function QuickForm({ action, fields, hidden = {}, submit = "Save", columns = 2, resetOnSuccess, confirm }: {
  action: Action; fields: FieldDef[]; hidden?: Record<string, string>; submit?: string; columns?: 1 | 2 | 3; resetOnSuccess?: boolean; confirm?: string;
}) {
  const cols = columns === 1 ? "" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
  return (
    <ActionForm action={action} resetOnSuccess={resetOnSuccess} confirm={confirm}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className={`grid gap-4 ${cols}`}>
        {fields.map((f) => {
          const span = f.full || f.type === "textarea" ? "sm:col-span-full" : "";
          if (f.type === "checkbox") return <label key={f.name} className={`flex items-center gap-2 text-sm ${span}`}><input type="checkbox" name={f.name} defaultChecked={f.defaultValue === "true"} className="size-4 accent-brand" />{f.label}</label>;
          return (
            <Field key={f.name} label={f.label} hint={f.hint} className={span}>
              {f.type === "textarea" ? <Textarea name={f.name} defaultValue={f.defaultValue} required={f.required} placeholder={f.placeholder} />
                : f.type === "select" ? <Select name={f.name} defaultValue={f.defaultValue} required={f.required}>{f.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
                : <Input name={f.name} type={f.type ?? "text"} defaultValue={f.defaultValue} required={f.required} placeholder={f.placeholder} className={f.type === "file" ? "pt-1.5" : ""} />}
            </Field>
          );
        })}
      </div>
      <div className="mt-5"><Submit>{submit}</Submit></div>
    </ActionForm>
  );
}
