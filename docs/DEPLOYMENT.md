# Deployment

## 1. What you need

| Component | Recommended | Notes |
|---|---|---|
| App server | Any Node 22 host: a VPS (e.g. Hostinger VPS, DigitalOcean), Render, Railway, Fly.io | Must also run the **worker** process (`npm run worker`), or call `/api/cron` every minute |
| Database | Managed PostgreSQL 16 (Neon, Supabase, RDS, DigitalOcean) | Needs `btree_gist` and `pg_trgm` extensions (migrations create them; most managed providers allow both) |
| File storage | Persistent disk (`STORAGE_DIR`) | On serverless hosts, implement the S3/R2 driver in `src/server/storage.ts` (same 3 functions) |
| Email | Resend | Verify your domain in Resend |
| SMS | Hubtel (Ghana) | Register a sender ID |
| Payments | Paystack (Ghana: GHS, Mobile Money + cards) | Flutterwave adapter included for other markets |

Hostinger **shared/web hosting cannot run Node.js apps with a worker**. Use a Hostinger VPS or another Node host, and keep the domain at Hostinger (DNS steps below).

## 2. Environment variables

Copy `.env.example`. The required values are `DATABASE_URL`, `APP_URL`, `ENCRYPTION_KEY` (`openssl rand -hex 32`), `CRON_SECRET`, `STORAGE_DIR`, `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, and the Hubtel SMS credentials.
Store secrets in your host's secret manager, never in git. **Back up `ENCRYPTION_KEY` securely:** losing it makes stored payout account numbers unreadable.

## 3. First deploy

```bash
npm ci
npm run db:migrate                                   # prisma migrate deploy — safe, non-destructive
SEED_ADMIN_EMAIL=you@yourdomain.com SEED_ADMIN_PASSWORD='a-long-password' npm run db:seed
npm run build
npm start                                            # web (PORT=3000)
npm run worker                                       # separate long-running process
```
Run behind HTTPS (Caddy or Nginx with Let's Encrypt on a VPS; automatic on PaaS hosts). Health check: `GET /api/health`.

**VPS example (pm2 + Caddy):**
```bash
npm i -g pm2
pm2 start "npm start" --name web && pm2 start "npm run worker" --name worker && pm2 save && pm2 startup
# /etc/caddy/Caddyfile
# www.your-domain.com, your-domain.com {
#   reverse_proxy localhost:3000
# }
```

**HTTP cron alternative** (instead of the worker): `POST https://your-domain.com/api/cron` every minute with `Authorization: Bearer $CRON_SECRET`.

On every release: `npm ci && npm run db:migrate && npm run build`, then restart both processes.

## 4. Connect your Hostinger domain

In hPanel → **Domains → DNS / Nameservers → Manage DNS records**:

| Type | Name | Points to | When |
|---|---|---|---|
| A | `@` | your server's IPv4 address | VPS |
| A | `www` (or CNAME `www` → `your-domain.com`) | same IP | VPS |
| CNAME | `www` | the hostname your PaaS gives you | Render / Railway / Fly |
| A / ALIAS | `@` | the apex IP or ALIAS target from your PaaS docs | PaaS |

Delete conflicting default `A`/`CNAME` records for `@` and `www` (Hostinger's parking records). Add the domain in your host's dashboard so it issues the TLS certificate. DNS can take up to 24 hours to propagate. Then set `APP_URL=https://www.your-domain.com`.

For email deliverability, add the SPF, DKIM and DMARC records Resend shows you as TXT/CNAME records in the same Hostinger DNS screen.

## 5. Paystack

1. Complete business verification in Paystack (it's required for live keys and settlements).
2. Put `PAYSTACK_SECRET_KEY` in the environment (start with `sk_test_…` in staging).
3. Set the **Webhook URL** to `https://your-domain.com/api/payments/webhook/paystack`.
4. The callback URL is sent per transaction (`/payments/return`), so nothing needs configuring there.
5. Test in sandbox: a successful card or Mobile Money payment, a failed payment, and a refund. Then switch to live keys.
6. Under **Admin → Countries**, make sure Ghana's gateways list contains `paystack`.

Flutterwave: set `FLUTTERWAVE_SECRET_KEY`, choose a secret hash in its dashboard and put it in `FLUTTERWAVE_WEBHOOK_HASH`, and set the webhook to `/api/payments/webhook/flutterwave`.

**Payouts** are currently processed by finance staff. They approve the request, send the transfer from the gateway or bank dashboard, then record the transfer reference in Admin → Payouts. Automating this with Paystack Transfers is a natural next step (`src/server/modules/payouts.ts`).

## 6. Backups and monitoring

- **Database:** enable your provider's automated daily backups with point-in-time recovery (7–30 days). Test a restore quarterly. For a VPS-hosted database, use a nightly `pg_dump -Fc` to off-site storage.
- **Files:** back up `STORAGE_DIR` nightly (e.g. `rclone` to object storage). Identity documents live in `STORAGE_DIR/private`, so encrypt that backup.
- **Uptime:** monitor `GET /api/health` (UptimeRobot, Better Stack).
- **Errors:** add Sentry (`@sentry/nextjs`) and set its DSN as an environment variable. Server errors are already logged to stdout.
- **Watch in Admin:** Payments & ledger (webhooks needing attention, failed refunds) and Payouts.

## 7. Go-live checklist

- [ ] `NODE_ENV=production`, `PAYMENTS_DEV_GATEWAY` unset
- [ ] Live Paystack key + webhook configured and tested
- [ ] Resend domain verified; Hubtel sender ID approved
- [ ] Super admin created; `SEED_ADMIN_*` removed from env
- [ ] Legal documents filled in Admin → Settings → Legal
- [ ] Commission rate confirmed in Admin → Commissions
- [ ] Worker or cron running (check that reminders and settlements happen)
- [ ] Backups enabled and a restore tested
