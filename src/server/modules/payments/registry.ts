import { AppError } from "../../errors";
import { devGateway } from "./dev";
import { flutterwave } from "./flutterwave";
import type { PaymentGateway } from "./gateway";
import { paystack } from "./paystack";

const ALL: PaymentGateway[] = [paystack, flutterwave, devGateway];

export function gatewayByKey(key: string): PaymentGateway {
  const g = ALL.find((x) => x.key === key);
  if (!g) throw new AppError("GATEWAY", `Unknown payment gateway ${key}`);
  return g;
}

/** First gateway enabled for the country that is configured and supports the currency. */
export function pickGateway(country: { paymentGateways: string[] }, currency: string): PaymentGateway {
  const candidates = [...country.paymentGateways, ...(devGateway.isConfigured() ? ["dev"] : [])];
  for (const k of candidates) {
    const g = ALL.find((x) => x.key === k);
    if (g && g.isConfigured() && g.currencies.includes(currency)) return g;
  }
  throw new AppError("NO_GATEWAY", "Online payment is not yet available in this country. Please try again later.");
}

export const allGateways = () => ALL.map((g) => ({ key: g.key, label: g.label, configured: g.isConfigured(), currencies: g.currencies }));
