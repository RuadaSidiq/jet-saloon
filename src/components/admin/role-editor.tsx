"use client";
import { roleAction } from "@/app/actions/admin";
import { ActionForm, Submit } from "@/components/ui/form";
import { Input } from "@/components/ui";

export function RoleEditor({ role, all }: { role?: { id: string; name: string; permissions: string[] }; all: Record<string, string> }) {
  return (
    <ActionForm action={roleAction} resetOnSuccess={!role}>
      {role && <input type="hidden" name="id" value={role.id} />}
      <Input name="name" defaultValue={role?.name} placeholder="Role name" required className="mb-3 max-w-sm" />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(all).map(([k, label]) => (
          <label key={k} className="flex items-start gap-2 text-sm"><input type="checkbox" name="permissions" value={k} defaultChecked={role?.permissions.includes(k)} className="mt-0.5 accent-brand" /><span><span className="font-mono text-xs">{k}</span><span className="block text-xs text-muted">{label}</span></span></label>
        ))}
      </div>
      <div className="mt-4"><Submit size="sm">{role ? "Save role" : "Create role"}</Submit></div>
    </ActionForm>
  );
}
