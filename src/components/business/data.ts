import { db } from "@/server/db";

export async function formData() {
  const [countries, categories] = await Promise.all([
    db.country.findMany({ where: { active: true }, orderBy: { name: "asc" }, include: { cities: { where: { active: true }, orderBy: { name: "asc" }, include: { neighbourhoods: { orderBy: { name: "asc" } } } } } }),
    db.category.findMany({ where: { parentId: null, active: true }, orderBy: { sortOrder: "asc" }, include: { children: { where: { active: true }, orderBy: { sortOrder: "asc" } } } }),
  ]);
  return { countries, categories };
}
