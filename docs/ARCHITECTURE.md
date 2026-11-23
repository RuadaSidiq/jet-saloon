# Architecture

## Layout

```
prisma/schema.prisma            data model (money = integer minor units + currency code)
prisma/migrations/*_integrity   constraints Prisma can't express (exclusion, ledger triggers, checks)
src/server/
  auth/                         password hashing, DB sessions (cookie + Bearer), guards
  rbac.ts                       granular admin permissions + default roles
  modules/                      business logic — no UI imports
    availability.ts             slot computation (timezone, buffers, breaks, time off, notice)
    bookings.ts                 creation, state machine, cancel/reschedule/complete
    payments/                   gateway-independent layer: paystack, flutterwave, dev (test only)
    ledger.ts                   double-entry posting + balances
    refunds.ts settlement.ts payouts.ts commission.ts coupons.ts
    providers.ts accounts.ts search.ts reviews.ts messaging.ts support.ts reports.ts jobs.ts
  notify/                       outbox → email (Resend) / SMS (Hubtel) with retries
src/app/                        Next.js routes; server actions in src/app/actions/*
```

Every server action authenticates and authorises inside the action. Ownership is always derived from the session, never from IDs in the request. Other people's records return "not found".

## Booking state machine

```
AWAITING_APPROVAL ──accept──▶ PENDING_PAYMENT ──payment verified──▶ CONFIRMED ──▶ IN_PROGRESS ──▶ COMPLETED
        │ reject/expire              │ cancel/expire                    │ cancel / no-show
        ▼                            ▼                                  ▼
     REJECTED/EXPIRED         CANCELLED/EXPIRED                  CANCELLED / NO_SHOW
```
`EXPIRED → CONFIRMED` is allowed only when a late payment arrives and the slot is still free; otherwise the payment is captured and refunded automatically. Booking status and payment status are separate fields. Every transition is guarded (`UPDATE … WHERE status = from`) and written to `BookingStatusHistory`.

**Approval mode never charges a rejected booking.** The customer's slot is held while the provider decides. Payment is requested only after acceptance.

## Concurrency and double-booking

Four layers stop double bookings:
1. A per-provider row lock (`SELECT … FOR UPDATE`) serialises validate-then-insert.
2. Slots are recomputed server-side inside the transaction. The client's chosen time is only a request.
3. A Postgres exclusion constraint, `EXCLUDE USING gist (staffId WITH =, tsrange(blockStart, blockEnd) WITH &&)`, covers active statuses, so overlaps are impossible even if application code is bypassed.
4. `(customerId, idempotencyKey)` is unique, so retries and double clicks return the same booking.

Expired holds are released lazily on every booking attempt and by the worker.

## Payments

`PaymentGateway` interface: `initialize / verify / verifyWebhookSignature / parseWebhook / refund`. Countries list their gateways in priority order. The first one that is configured and supports the currency is used.

- The frontend never decides payment state. Success requires server-side `verify()` against the gateway API, with amount and currency matched to the booking.
- Webhooks: the signature is verified (Paystack HMAC-SHA512, Flutterwave `verif-hash`), the event is deduplicated via `WebhookEvent(gateway, eventKey)`, and the payment is re-verified with the API.
- A reconciliation job re-verifies payments left in `INITIATED`.
- Paystack takes subunit amounts. Flutterwave takes major units, converted using each currency's precision.

Before enabling a country, confirm the gateway's support for that country, currency, payment methods and payout destinations on your account.

## Ledger

Double entry: debit is positive, credit is negative. Each `LedgerTransaction` must sum to zero per currency, which a deferred constraint trigger enforces at commit. Entries and transactions are **immutable** (UPDATE and DELETE raise an error), and corrections are new transactions. Every posting has a unique idempotency key.

| Event | Entries |
|---|---|
| Payment captured | Dr gateway_clearing (total), Dr promotions (platform-funded discount) / Cr provider:pending (net), Cr platform:commission |
| Gateway fee | Dr gateway_fees / Cr gateway_clearing |
| Settlement (completed + delay) | Dr provider:pending / Cr provider:available |
| Refund | Dr provider:pending-or-available (pro-rata share), Dr commission / Cr gateway_clearing |
| Payout requested | Dr provider:available / Cr provider:payout_reserved (balance checked under row lock) |
| Payout paid | Dr payout_reserved / Cr gateway_clearing |
| Payout failed/rejected | Dr payout_reserved / Cr provider:available |

Gross booking value (customer spend) is reported separately from platform revenue (commission account). Amounts in different currencies are never summed together.

## Commission

Resolution order: provider → category → country → global → settings fallback, using whichever rule is in force at booking time. The rate, rule id and amounts are snapshotted on the booking. Creating a rule closes the previous one for the same target, keeping history. Rules cannot be back-dated. Commission applies to the service subtotal, while travel fees pass through to the provider.

## Security summary

bcrypt (cost 12) passwords; random session tokens stored only as SHA-256 hashes; HttpOnly, SameSite=Lax, Secure cookies; Next.js server-action origin checks (CSRF); Zod validation; Prisma parameterised queries; rate limits on auth, booking, messaging and availability; uploads validated by magic bytes and size; private identity documents served only to the owner or to admins with `providers.documents` (every view audited); payout account numbers encrypted with AES-256-GCM, with reveals audited; append-only audit log; security headers (HSTS, frame-deny, nosniff).

The rate limiter is per-process. With more than one app instance, back it with Redis.
