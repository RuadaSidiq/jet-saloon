/** Money helpers. All amounts are integer minor units + ISO currency. Never use floats for stored money. */
export type CurrencyInfo = { code: string; symbol: string; minorUnits: number };

export function toMinor(major: string | number, minorUnits: number): number {
  const s = String(major).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("Invalid amount");
  const [whole, frac = ""] = s.split(".");
  if (frac.length > minorUnits) throw new Error(`At most ${minorUnits} decimal places allowed`);
  return Number(whole) * 10 ** minorUnits + Number((frac + "0".repeat(minorUnits)).slice(0, minorUnits) || 0);
}

export function toMajorString(minor: number, minorUnits: number): string {
  if (minorUnits === 0) return String(minor);
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const base = 10 ** minorUnits;
  return `${neg ? "-" : ""}${Math.floor(abs / base)}.${String(abs % base).padStart(minorUnits, "0")}`;
}

export function formatMoney(minor: number, c: CurrencyInfo): string {
  const [w, f] = toMajorString(Math.abs(minor), c.minorUnits).split(".");
  const grouped = w.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${minor < 0 ? "-" : ""}${c.symbol}${grouped}${f ? "." + f : ""}`;
}

/** Basis-point percentage, rounded half-up to the nearest minor unit. */
export function applyBps(amountMinor: number, bps: number): number {
  return Math.floor((amountMinor * bps + 5000) / 10000);
}

/** Totals must never mix currencies. */
export function sumByCurrency(rows: { currency: string; amountMinor: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.currency] = (out[r.currency] ?? 0) + r.amountMinor;
  return out;
}
