import { formatMoney } from "@/server/money";

export type Cur = { code: string; symbol: string; minorUnits: number };
const KNOWN: Record<string, Cur> = {
  GHS: { code: "GHS", symbol: "GH₵", minorUnits: 2 }, NGN: { code: "NGN", symbol: "₦", minorUnits: 2 },
  KES: { code: "KES", symbol: "KSh", minorUnits: 2 }, ZAR: { code: "ZAR", symbol: "R", minorUnits: 2 }, UGX: { code: "UGX", symbol: "USh", minorUnits: 0 },
};
/** Client-safe formatter; server pages should pass the DB currency where available. */
export const money = (minor: number | null | undefined, cur: string | Cur) => {
  if (minor == null) return "—";
  const c = typeof cur === "string" ? KNOWN[cur] ?? { code: cur, symbol: cur + " ", minorUnits: 2 } : cur;
  return formatMoney(minor, c);
};
export const dt = (d: Date | string, tz: string, style: "date" | "datetime" | "time" = "datetime") =>
  new Date(d).toLocaleString("en-GB", { timeZone: tz, ...(style === "date" ? { dateStyle: "medium" } : style === "time" ? { timeStyle: "short" } : { dateStyle: "medium", timeStyle: "short" }) });
export const titleCase = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
