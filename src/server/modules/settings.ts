import { db } from "../db";

/** Platform settings with typed defaults. Stored as JSON rows in PlatformSetting. */
export const SETTING_DEFAULTS = {
  "general.platformName": "Jet Saloon",
  "general.supportEmail": "support@example.com",
  "general.supportPhone": "",
  "booking.defaultMode": "INSTANT" as "INSTANT" | "APPROVAL",
  "booking.paymentHoldMinutes": 15,
  "booking.approvalWindowHours": 24,
  "booking.reminderHoursBefore": 24,
  "booking.customerFreeCancelHours": 24,
  "finance.settlementDelayHours": 48,
  "finance.defaultCommissionBps": 1500,
  "provider.requireIdDocument": true,
  "seo.title": "Jet Saloon — Book trusted beauty professionals",
  "seo.description": "Discover and book verified makeup artists, barbers, stylists, nail and lash technicians near you.",
  "legal.terms": "",
  "legal.privacy": "",
  "legal.refundPolicy": "Bookings cancelled at least 24 hours before the appointment are refunded in full. Late cancellations may be non-refundable.",
};
export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting<K extends SettingKey>(key: K): Promise<(typeof SETTING_DEFAULTS)[K]> {
  const row = await db.platformSetting.findUnique({ where: { key } });
  return (row?.value ?? SETTING_DEFAULTS[key]) as (typeof SETTING_DEFAULTS)[K];
}

export async function getAllSettings() {
  const rows = await db.platformSetting.findMany();
  const out: Record<string, unknown> = { ...SETTING_DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out as typeof SETTING_DEFAULTS;
}

export async function setSetting(key: SettingKey, value: unknown) {
  const def = SETTING_DEFAULTS[key];
  if (typeof def !== typeof value) throw new Error(`Setting ${key} expects ${typeof def}`);
  await db.platformSetting.upsert({ where: { key }, create: { key, value: value as never }, update: { value: value as never } });
}
