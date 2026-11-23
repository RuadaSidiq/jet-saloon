import { pageAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { Act, QuickForm } from "@/components/ui/act";
import { categoryAction } from "@/app/actions/admin";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function Categories() {
  await pageAdmin("catalog.manage");
  const cats = await db.category.findMany({ where: { parentId: null }, orderBy: { sortOrder: "asc" }, include: { children: { orderBy: { sortOrder: "asc" } }, _count: { select: { services: true } } } });
  const Row = ({ c, sub }: { c: { id: string; name: string; active: boolean; featured: boolean; icon: string | null }; sub?: boolean }) => (
    <div className={`flex flex-wrap items-center gap-2 py-2 ${sub ? "pl-6 text-sm" : ""}`}>
      <span className={`flex-1 ${sub ? "" : "font-medium"}`}>{c.name}{c.icon && <span className="ml-2 text-xs text-muted">{c.icon}</span>}</span>
      {!c.active && <Badge>Inactive</Badge>}{c.featured && !sub && <Badge tone="brand">Featured</Badge>}
      <Act action={categoryAction} fields={{ id: c.id, op: "up" }} label="↑" variant="ghost" /><Act action={categoryAction} fields={{ id: c.id, op: "down" }} label="↓" variant="ghost" />
      {!sub && <Act action={categoryAction} fields={{ id: c.id, op: "feature" }} label={c.featured ? "Unfeature" : "Feature"} variant="ghost" />}
      <Act action={categoryAction} fields={{ id: c.id, op: "toggle" }} label={c.active ? "Deactivate" : "Activate"} variant="ghost" />
      <Act action={categoryAction} fields={{ id: c.id, op: "delete" }} label="Delete" variant="ghost" confirm="Delete this category? Only possible if no services use it." />
    </div>
  );
  return (
    <>
      <PageHeader title="Categories" description="Shown across search, provider onboarding and the homepage." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <div className="divide-y divide-line">{cats.map((c) => (
            <details key={c.id} className="group">
              <summary className="cursor-pointer list-none"><Row c={c} /></summary>
              <div className="border-l-2 border-brand-soft">{c.children.map((s) => <Row key={s.id} c={s} sub />)}</div>
              <div className="py-3 pl-6"><QuickForm action={categoryAction} hidden={{ id: c.id }} submit="Update" columns={3} fields={[{ name: "name", label: "Name", defaultValue: c.name }, { name: "icon", label: "Icon", defaultValue: c.icon ?? "" }, { name: "image", label: "Image", type: "file" }, { name: "description", label: "Description", type: "textarea", defaultValue: c.description ?? "" }]} /></div>
            </details>
          ))}</div>
        </Card>
        <Card title="New category or subcategory">
          <QuickForm action={categoryAction} resetOnSuccess submit="Create" columns={1} fields={[
            { name: "name", label: "Name", required: true },
            { name: "parentId", label: "Parent", type: "select", options: [["", "— Top-level category —"], ...cats.map((c) => [c.id, c.name] as [string, string])] },
            { name: "icon", label: "Icon name (lucide)", placeholder: "sparkles" }, { name: "image", label: "Image", type: "file" }, { name: "description", label: "Description", type: "textarea" },
          ]} />
        </Card>
      </div>
    </>
  );
}
