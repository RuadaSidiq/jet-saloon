# Security

## Reporting a vulnerability
Email the maintainers privately (see Admin → Settings → Support email). Please don't open public issues for security reports.

## How Muv is protected

**Secrets & keys**
- No secrets in the repository; `.env*` files are git-ignored. Secrets live in Vercel environment variables — `ENCRYPTION_KEY` and `CRON_SECRET` are *sensitive* (write-only) in Production/Preview.
- Every server module that touches secrets (`db`, `crypto`, `storage`, payment gateways, notification channels, sessions, 2FA) imports `server-only`, so the build fails if it is ever bundled into browser code. CI also checks the client bundle stays free of them.
- Payout account numbers and 2FA secrets are encrypted at rest (AES-256-GCM); recovery codes and session tokens are stored only as SHA-256 hashes.

**Accounts & sessions**
- bcrypt (cost 12) passwords; constant-time login checks; generic error messages.
- Two-factor authentication (TOTP + one-time recovery codes, replay-protected). **Required for every admin in production** (`ADMIN_MFA_REQUIRED`, default on); optional for providers and customers.
- `__Host-` session cookies (HttpOnly, Secure, SameSite=Lax), 30-day absolute and 14-day idle expiry, sign-out of other devices on password change or 2FA enrolment, and a "sign out other devices" control.
- Admin sign-ins, failed admin sign-ins, 2FA changes, document views, payout account reveals and all sensitive admin actions are written to the append-only audit log.

**Abuse protection**
- Postgres-backed rate limits shared by all serverless instances: sign-in (per IP and per email), registration, password reset, 2FA, bookings, messages, reviews, support tickets, uploads and the availability API. Client IP comes from Vercel's `x-real-ip`.

**Browser hardening**
- Per-request nonce Content-Security-Policy with `strict-dynamic` (no `unsafe-eval` in production), `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`.
- HSTS (preload), X-Frame-Options DENY, nosniff, strict Referrer-Policy, restrictive Permissions-Policy, COOP/CORP same-origin.
- Uploaded files are validated by magic bytes, size-capped, served with a sandboxing CSP; identity documents are private and only served to the owner or staff with the `providers.documents` permission.

**Application**
- Every server action authenticates and authorises inside the action; records are looked up by owner, so other users' data returns "not found".
- Zod validation; Prisma parameterised queries only; React escaping (no raw HTML rendering).
- Payments: server-side gateway verification, signed webhooks, idempotency and an immutable double-entry ledger enforced by database triggers.

**Supply chain**
- `npm audit` (production deps) gates CI; Dependabot opens weekly update PRs; CodeQL scans every push and weekly.

## Operator checklist
- Enable 2FA on your Vercel and GitHub accounts, and on your Muv admin account (enforced).
- Rotate the Vercel token used for deploys periodically; revoke tokens you no longer use.
- Keep a private, offline copy of `ENCRYPTION_KEY` — losing it makes encrypted payout details and 2FA secrets unreadable.
- Turn on GitHub secret scanning and push protection (repo → Settings → Code security).
