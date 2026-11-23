import "server-only"; // never bundle this module (or the secrets it reads) into browser code
/**
 * DEVELOPMENT-ONLY test gateway, used for local development and automated tests without real credentials.
 * It is disabled when NODE_ENV=production regardless of configuration. It never moves real money and
 * its checkout page is clearly labelled as a test. The full server-side verification + signed-webhook
 * path is still exercised.
 */
import { db } from "../../db";
import { appUrl } from "../../app-url";
import { hmacHex, safeEqual, sha256 } from "../../crypto";
import type { PaymentGateway } from "./gateway";

export const devGatewayEnabled = () => process.env.NODE_ENV !== "production" && process.env.PAYMENTS_DEV_GATEWAY === "true";
const secret = () => process.env.DEV_GATEWAY_SECRET ?? "dev-gateway-secret";
const stateKey = (ref: string) => `devgw:${ref}`;

type DevState = { amountMinor: number; currency: string; outcome?: "success" | "failed"; refunded?: number };

export async function devSetOutcome(reference: string, outcome: "success" | "failed") {
  const row = await db.platformSetting.findUnique({ where: { key: stateKey(reference) } });
  if (!row) throw new Error("Unknown dev payment");
  await db.platformSetting.update({ where: { key: stateKey(reference) }, data: { value: { ...(row.value as DevState), outcome } } });
}

export function devSignWebhook(body: string) {
  return hmacHex("sha256", secret(), body);
}

export const devGateway: PaymentGateway = {
  key: "dev",
  label: "Test payments (development only)",
  currencies: ["GHS", "NGN", "KES", "ZAR", "UGX", "USD"],
  isConfigured: devGatewayEnabled,

  async initialize(i) {
    if (!devGatewayEnabled()) throw new Error("Dev gateway disabled");
    const value: DevState = { amountMinor: i.amountMinor, currency: i.currency };
    await db.platformSetting.upsert({ where: { key: stateKey(i.reference) }, create: { key: stateKey(i.reference), value }, update: { value } });
    return { authorizationUrl: `${appUrl()}/dev-checkout/${i.reference}` };
  },

  async verify(reference) {
    const row = await db.platformSetting.findUnique({ where: { key: stateKey(reference) } });
    const s = row?.value as DevState | undefined;
    if (!s) return { status: "failed", amountMinor: 0, currency: "", failureReason: "Unknown reference", raw: null };
    return { status: s.outcome ?? "pending", amountMinor: s.amountMinor, currency: s.currency, gatewayTxId: `dev_${reference}`, channel: "test", feeMinor: Math.round(s.amountMinor * 0.0195), raw: s };
  },

  verifyWebhookSignature(rawBody, headers) {
    return devGatewayEnabled() && safeEqual(devSignWebhook(rawBody), headers.get("x-dev-signature") ?? "");
  },

  parseWebhook(rawBody) {
    const e = JSON.parse(rawBody) as { event: string; reference: string };
    return { eventKey: sha256(rawBody), eventType: e.event, reference: e.reference };
  },

  async refund(r) {
    return { gatewayRef: `devrf_${r.reference}_${Date.now()}`, status: "completed" };
  },
};
