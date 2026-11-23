# Jet Saloon — beauty services marketplace

A multi-vendor marketplace connecting customers with verified beauty and personal-care professionals across Africa. Ghana is the launch market; countries, currencies, gateways and payout channels are data, not code.

Three experiences on one backend:

| Who | Where | What |
|---|---|---|
| Customers | `/`, `/search`, `/provider/[slug]`, `/book/[slug]`, `/account` | Discover, compare, book real availability, pay online, cancel/reschedule, review, message, support tickets |
| Providers | `/become-a-provider`, `/business` | Multi-step application, services, hours/breaks/time off, team calendars, bookings, earnings, withdrawals |
| Admins | `/admin` | Verification, users, bookings & disputes, refunds, payouts, ledger, commissions, categories, promotions, countries, settings, roles, audit log |

**Stack:** Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS v4 · PostgreSQL · Prisma · Zod · Vitest · Playwright.
It's a modular monolith: business logic lives in `src/server/modules/*`, separate from the UI, so mobile apps can call the same services (see `src/app/api/v1`).

## Quick start (local)

```bash
cp .env.example .env          # then fill DATABASE_URL, ENCRYPTION_KEY, APP_URL=http://localhost:3000
npm install
npm run db:migrate            # applies prisma/migrations (incl. constraints & triggers)
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='ChangeMe123' SEED_DEMO=true npm run db:seed
npm run dev                   # http://localhost:3000
npm run worker                # second terminal: reminders, settlements, hold expiry, email/SMS delivery
```

For local payments without gateway keys, set `PAYMENTS_DEV_GATEWAY=true` and `DEV_GATEWAY_SECRET=anything`. This shows a clearly labelled **test checkout** that runs the real signed-webhook and verification path. It is impossible to enable when `NODE_ENV=production`.

Demo accounts (development only, password `Password123`): `customer@demo.test`, `akua@demo.test` (instant booking), `kofi@demo.test`, `esi@demo.test` (approval mode).

## Tests

```bash
npm test               # integration tests against a fresh, uniquely named Postgres database per run
npm run test:e2e       # Playwright, against a running dev server with demo data (npm run dev)
```

The integration suite covers concurrent double-booking (8 parallel attempts → exactly 1 wins), the DB exclusion constraint, idempotent booking creation, hold expiry, approval mode never charging, duplicate and forged webhooks, cross-user access, refunds and ledger reversal, settlement, concurrent withdrawals that can't overdraw, ledger immutability, encrypted payout details, commission precedence and snapshotting, and verified-only reviews.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): domains, booking state machine, payments, ledger, security model
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): hosting, environment variables, Hostinger DNS, gateways, email/SMS, storage, backups, monitoring
