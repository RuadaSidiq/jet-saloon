import "server-only"; // never bundle this module (or the secrets it reads) into browser code
import { hmacHex, safeEqual, sha256 } from "../../crypto";
import { httpJson, type PaymentGateway } from "./gateway";

const API = "https://api.paystack.co";
const secret = () => process.env.PAYSTACK_SECRET_KEY ?? "";
const auth = () => ({ Authorization: `Bearer ${secret()}`, "Content-Type": "application/json" });

/** Paystack amounts are in the currency's subunit (pesewas, kobo, cents) — identical to our minor units for 2-dp currencies. */
export const paystack: PaymentGateway = {
  key: "paystack",
  label: "Paystack",
  currencies: ["GHS", "NGN", "KES", "ZAR", "USD"],
  isConfigured: () => !!secret(),

  async initialize(i) {
    const r = await httpJson<{ status: boolean; data: { authorization_url: string } }>(`${API}/transaction/initialize`, {
      method: "POST", headers: auth(),
      body: JSON.stringify({ email: i.email, amount: i.amountMinor, currency: i.currency, reference: i.reference, callback_url: i.callbackUrl, metadata: i.metadata }),
    });
    return { authorizationUrl: r.data.authorization_url };
  },

  async verify(reference) {
    const r = await httpJson<{ data: { status: string; amount: number; currency: string; id: number; channel: string; fees: number | null; gateway_response: string } }>(
      `${API}/transaction/verify/${encodeURIComponent(reference)}`, { headers: auth() });
    const d = r.data;
    const status = d.status === "success" ? "success" : d.status === "abandoned" ? "abandoned" : ["failed", "reversed"].includes(d.status) ? "failed" : "pending";
    return { status, amountMinor: d.amount, currency: d.currency, gatewayTxId: String(d.id), channel: d.channel, feeMinor: d.fees ?? undefined, failureReason: status === "failed" ? d.gateway_response : undefined, raw: d };
  },

  verifyWebhookSignature(rawBody, headers) {
    const sig = headers.get("x-paystack-signature") ?? "";
    return !!secret() && !!sig && safeEqual(hmacHex("sha512", secret(), rawBody), sig);
  },

  parseWebhook(rawBody) {
    const e = JSON.parse(rawBody) as { event: string; data: { id?: number; reference?: string; transaction_reference?: string; status?: string } };
    const eventKey = e.data?.id ? `${e.event}:${e.data.id}` : sha256(rawBody);
    if (e.event.startsWith("refund.")) {
      return { eventKey, eventType: e.event, refundReference: e.data.transaction_reference, refundStatus: e.event === "refund.processed" ? "completed" : e.event === "refund.failed" ? "failed" : undefined };
    }
    return { eventKey, eventType: e.event, reference: e.data?.reference };
  },

  async refund(r) {
    const res = await httpJson<{ data: { id: number; status: string } }>(`${API}/refund`, {
      method: "POST", headers: auth(), body: JSON.stringify({ transaction: r.reference, amount: r.amountMinor }),
    });
    return { gatewayRef: String(res.data.id), status: res.data.status === "processed" ? "completed" : "processing" };
  },
};
