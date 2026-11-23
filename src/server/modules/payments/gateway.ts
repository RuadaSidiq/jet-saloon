/** Gateway-independent contract. Each adapter translates to/from a specific provider's API. */
export type VerifyResult = {
  status: "success" | "failed" | "pending" | "abandoned";
  amountMinor: number;
  currency: string;
  gatewayTxId?: string;
  channel?: string;
  feeMinor?: number;
  failureReason?: string;
  raw: unknown;
};

export interface PaymentGateway {
  key: string;
  label: string;
  /** Currencies this adapter is configured for. Verify against the provider's docs before enabling a country. */
  currencies: string[];
  isConfigured(): boolean;
  initialize(i: { reference: string; amountMinor: number; minorUnits: number; currency: string; email: string; callbackUrl: string; metadata: Record<string, string> }): Promise<{ authorizationUrl: string }>;
  verify(reference: string, minorUnits: number): Promise<VerifyResult>;
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean;
  parseWebhook(rawBody: string): { eventKey: string; eventType: string; reference?: string; refundReference?: string; refundStatus?: "completed" | "failed" };
  refund(r: { reference: string; gatewayTxId?: string | null; amountMinor: number; minorUnits: number; currency: string }): Promise<{ gatewayRef: string; status: "processing" | "completed" }>;
}

export async function httpJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 20_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const body = (await res.json().catch(() => ({}))) as T & { message?: string };
    if (!res.ok) throw new Error(`Gateway HTTP ${res.status}: ${body?.message ?? "request failed"}`);
    return body;
  } finally {
    clearTimeout(t);
  }
}
