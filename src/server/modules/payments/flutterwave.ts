import "server-only"; // never bundle this module (or the secrets it reads) into browser code
import { safeEqual, sha256 } from "../../crypto";
import { toMajorString, toMinor } from "../../money";
import { httpJson, type PaymentGateway } from "./gateway";

const API = "https://api.flutterwave.com/v3";
const secret = () => process.env.FLUTTERWAVE_SECRET_KEY ?? "";
const auth = () => ({ Authorization: `Bearer ${secret()}`, "Content-Type": "application/json" });

/** Flutterwave v3 uses major-unit amounts, so we convert explicitly using the currency's precision. */
export const flutterwave: PaymentGateway = {
  key: "flutterwave",
  label: "Flutterwave",
  currencies: ["GHS", "NGN", "KES", "ZAR", "UGX", "TZS", "RWF", "XOF", "XAF", "USD"],
  isConfigured: () => !!secret() && !!process.env.FLUTTERWAVE_WEBHOOK_HASH,

  async initialize(i) {
    const r = await httpJson<{ data: { link: string } }>(`${API}/payments`, {
      method: "POST", headers: auth(),
      body: JSON.stringify({ tx_ref: i.reference, amount: toMajorString(i.amountMinor, i.minorUnits), currency: i.currency, redirect_url: i.callbackUrl, customer: { email: i.email }, meta: i.metadata }),
    });
    return { authorizationUrl: r.data.link };
  },

  async verify(reference, minorUnits) {
    const r = await httpJson<{ data: { status: string; amount: number; currency: string; id: number; payment_type: string; app_fee?: number; processor_response?: string } }>(
      `${API}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, { headers: auth() });
    const d = r.data;
    const status = d.status === "successful" ? "success" : d.status === "failed" ? "failed" : "pending";
    return {
      status, amountMinor: toMinor(d.amount.toFixed(minorUnits), minorUnits), currency: d.currency, gatewayTxId: String(d.id), channel: d.payment_type,
      feeMinor: d.app_fee != null ? toMinor(d.app_fee.toFixed(minorUnits), minorUnits) : undefined, failureReason: status === "failed" ? d.processor_response : undefined, raw: d,
    };
  },

  verifyWebhookSignature(_raw, headers) {
    const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH ?? "";
    const got = headers.get("verif-hash") ?? "";
    return !!expected && safeEqual(expected, got);
  },

  parseWebhook(rawBody) {
    const e = JSON.parse(rawBody) as { event?: string; data?: { id?: number; tx_ref?: string } };
    return { eventKey: e.data?.id ? `${e.event}:${e.data.id}` : sha256(rawBody), eventType: e.event ?? "unknown", reference: e.data?.tx_ref };
  },

  async refund(r) {
    if (!r.gatewayTxId) throw new Error("Flutterwave refunds require the gateway transaction id");
    const res = await httpJson<{ data: { id: number; status: string } }>(`${API}/transactions/${r.gatewayTxId}/refund`, {
      method: "POST", headers: auth(), body: JSON.stringify({ amount: toMajorString(r.amountMinor, r.minorUnits) }),
    });
    return { gatewayRef: String(res.data.id), status: res.data.status === "completed" ? "completed" : "processing" };
  },
};
