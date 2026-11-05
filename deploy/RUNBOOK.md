# SWM operations runbook (Phase 3)

## Health

- Liveness/readiness: `GET /api/v1/health/`
  - `200` + `"status":"ok"` — API and database reachable
  - `503` — database check failed (do not route traffic)
- Uptime monitor should hit the public API health URL every 1–5 minutes.

## Required production secrets (`backend/.env.prod`)

| Variable | Notes |
|----------|--------|
| `DJANGO_SECRET_KEY` | Long random string |
| `DJANGO_DEBUG` | Must be `False` |
| `DJANGO_ALLOWED_HOSTS` | Your API hostnames |
| `ENCRYPTION_KEY` | Fernet key (required when debug is off) |
| `DATABASE_URL` / Postgres vars | Managed Postgres preferred |
| `REDIS_URL` / `CELERY_BROKER_URL` | Redis for cache + Celery |
| `FRONTEND_URL` | Exact public web origin |
| `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` | Same origin(s) as frontend |
| `EMAIL_*` or `ANYMAIL_ESP` + provider key | Invites / password reset |
| `SENTRY_DSN` | Optional but recommended |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_PRO` | Paid plans |
| OAuth / Plaid keys | Only for connectors you enable |

Generate encryption key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## Deploy shape

1. Managed Postgres + Redis (or `docker-compose.prod.yml` for a single VM).
2. Processes: `backend` (Daphne/ASGI), `celery` worker, `celery-beat`, `frontend` (Next standalone).
3. TLS terminator in front (Caddy/nginx/Cloudflare). Never expose Postgres publicly.
4. Off-box database backups (provider snapshots or `pg_dump` to object storage). App-level Backups UI is not a substitute for DB backups.

## Staging launch checklist

1. Copy `backend/.env.prod.example` → `backend/.env.prod` and fill secrets.
2. `docker compose -f docker-compose.prod.yml --env-file backend/.env.prod up -d --build`
3. Inside API container (or with env loaded): `python manage.py migrate` then `python manage.py check_launch_ready --strict --require-billing --require-connector google` (select only the connectors you will offer)
4. Point uptime monitor at `https://<api>/api/v1/health/`
5. Register Stripe **test** webhook → `https://<api>/api/v1/auth/billing/webhook/`
6. Create a trial user → `/onboarding` → Billing Checkout (test card `4242…`)
7. Confirm org `plan` becomes `pro` after webhook
8. Cancel via portal → plan returns to `starter` when Stripe reports it canceled; end-of-period cancellation keeps access until then. Google setup returns `402` after downgrade.
9. Optional: connect Google/Microsoft on a trial org and run sync
10. Soak ≥ 48h with Celery worker **and** beat running

## Stripe cutover

1. Test mode: Checkout from Settings → Billing; confirm webhook `checkout.session.completed` upgrades `plan`.
2. Portal cancel → org returns to Starter at effective cancellation; gated APIs return `402`. This release revokes paid access immediately for past-due, unpaid, incomplete, paused, or canceled states. There is no additional app grace period.
3. Local forward (dev): `stripe listen --forward-to localhost:8000/api/v1/auth/billing/webhook/`
4. Live mode: rotate keys, update webhook endpoint to production URL, re-verify one charge.
5. Keep `STRIPE_PRICE_PRO` in sync with the Dashboard Price ID.

Register these snapshot webhook events: `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
`customer.subscription.created`, `customer.subscription.updated`, and
`customer.subscription.deleted`. Only a current active subscription with a paid
invoice, or a current trialing subscription, can grant the configured plan.
Checkout completion/metadata alone never grants access. A stale Checkout
payment-status snapshot cannot override the current confirmed invoice state.
Unknown prices fail closed. Signed events are reconciled with current Stripe state
under an organization lock and recorded by event ID; failed lookups return 503 for retry.
Checkout is restricted to cards in this release and repeated clicks reuse an open session.

Before deploying this change, apply `users.0003_billing_webhook_event`. It adds a
receipt table and a checkout session field; it does not rewrite existing customer data.
Existing sessions without the new password-revocation/MFA claims must sign in
again after deployment. If an earlier build was publicly accessible, review saved
role assignments; closing the old profile-update gap does not reverse historical
role changes automatically.

## TLS and container startup

Set `APP_HOST`, `API_HOST`, `FRONTEND_URL`, exact allowed hosts and CORS/CSRF origins,
and `NEXT_PUBLIC_APP_URL` to your real hostnames. Enable `DJANGO_TRUST_PROXY=True`
only behind the provided Caddy proxy (or an equivalent proxy that overwrites
forwarded headers and prevents direct upstream access). For Caddy:

```bash
docker compose -f docker-compose.prod.yml --env-file backend/.env.prod --profile edge up -d --build
```

API/frontend host ports bind to loopback. PostgreSQL and Redis have no production
host ports. The API applies migrations once at startup; workers/beat/frontend wait
for API health. The health URL is exempt from HTTPS redirects for internal probes;
all other HTTP application routes still require HTTPS. WebSocket origins follow
the frontend CORS allowlist, independently of the API's hostnames.

Rebuild frontend images after changing public URLs or `NEXT_PUBLIC_INDEXABLE`.
Staging defaults to no indexing and an empty sitemap. Enable indexing only on
production. Check the sharing image at `/opengraph-image` and public links on mobile.

## Required evidence before launch

- Run `python manage.py check --deploy` inside the production API container.
- Run strict launch checks there, requiring billing/connectors actually offered.
  Missing optional providers are skipped; partial configuration fails.
- Test email delivery to a real inbox, OAuth/token refresh/disconnect, and a worker/beat sync.
- Test Stripe checkout, duplicate delivery, cancellation timing, and failure/recovery.
- Restore an off-host DB backup into a separate environment and measure recovery.
- Verify error/uptime notifications arrive and complete a 48-hour worker/beat soak.
- Record immutable image tags and rehearse rollback using a separate environment.

Do not reset an existing Postgres volume to resolve credential errors. Align the
configured credentials with the existing database using authorized administrative access.
Do not rotate Fernet keys without a data re-encryption plan. Review older distributed
images for secrets; new image builds exclude env files and local data.

Implementation references: [Stripe webhook delivery](https://docs.stripe.com/webhooks),
[Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment), and
[Django trusted proxy settings](https://docs.djangoproject.com/en/6.0/ref/settings/#secure-proxy-ssl-header).

Frontend images and CI use Node.js 24 LTS; Node.js 20 is end-of-life. Check the
[official runtime lifecycle](https://nodejs.org/en/about/previous-releases) before
future base-image updates.

## Incident basics

| Symptom | First checks |
|---------|----------------|
| 5xx on API | `/api/v1/health/`, backend logs, DB connectivity |
| Syncs stuck | Celery worker + beat running; Redis reachable |
| Login / invite email missing | `EMAIL_BACKEND` / Anymail keys; not console in prod |
| Checkout fails | Stripe keys + price IDs; webhook secret |

Rollback: redeploy previous image tags; avoid reverse migrations. Prefer forward-fix migrations.

### Beat reports a missing database column

If Beat reports `django_celery_beat_crontabschedule.timezone does not exist`,
stop background processes and apply migrations using the rebuilt backend image.
For the default development Compose file:

```sh
docker compose stop celery celery-beat
docker compose build backend celery celery-beat
docker compose run --rm backend python manage.py migrate --noinput
docker compose run --rm backend python manage.py showmigrations django_celery_beat
docker compose up -d backend celery celery-beat
docker compose logs --tail=80 backend celery-beat
```

For production, add `-f docker-compose.prod.yml --env-file backend/.env.prod`
to each `docker compose` command. The development stack now waits for backend
health before starting background processes; the backend migrates before serving
health checks. Celery also rejects startup when migrations remain pending.
If migrations are all marked applied and the column is still missing, migration
history and schema disagree. Inspect that database before attempting a repair;
do not fake migrations or delete database volumes.

## Support channel

- Product: support@subscriptionwastemanager.com
- Security: security@subscriptionwastemanager.com


## UI and policy release checks (November 4, 2026)

Apply `python manage.py migrate` before serving the updated frontend. New user migrations `0004_policy_acceptance` and `0005_social_login_code` store versioned agreements and short-lived social sign-in handoffs. Existing users without the current agreement record are redirected to `/agreements`; private API and WebSocket access remain blocked until acceptance. Keep `TERMS_VERSION` and `PRIVACY_VERSION` synchronized with the published text and frontend policy date. Never disable enforcement to bypass launch checks.

New organizations start a 14-day application trial without Checkout. Paid upgrades are explicit actions in Billing. Verify a test-mode upgrade, webhook confirmation, cancellation, invoice access, and trial expiry before enabling live payments.

Provide verified `NEXT_PUBLIC_LEGAL_BUSINESS_NAME`, `NEXT_PUBLIC_BUSINESS_COUNTRY`, and `NEXT_PUBLIC_SUPPORT_EMAIL` at frontend build time. These business decisions are currently pending. Policy previews show a draft notice while identity fields are absent; supplying them does not replace legal review. Finalize operator identity/address, applicable law, retention/deletion periods, subprocessor disclosures, and any necessary processing/transfer terms before publication. Verify all advertised mailboxes.

Social provider redirect URIs are `/social/complete/google-oauth2/` and `/social/complete/microsoft-graph/` on the API origin. The configured sign-in flow returns through `/social/finish/`, then exchanges a browser-bound one-use code at `/api/v1/auth/social/exchange/`. Do not put access/refresh tokens in redirect URLs. Existing password accounts are not automatically linked by matching email. MFA accounts use password plus authenticator sign-in. New social accounts review agreements and create a workspace explicitly; domain names never grant organization membership.

The Inter variable font is bundled with its OFL license so production builds do not fetch Google Fonts. Keep staging `NEXT_PUBLIC_INDEXABLE=false`; public indexing requires a deliberate production rebuild. Private/auth routes remain noindex.


## Development gap closure: email, owners, photos, and workspace data actions

Apply `users.0006_user_email_verified_at_emailverification` and `backups.0004_backup_restore_error_backup_restore_status` before this release. Mailbox ownership now uses `email_verified_at`; the old `is_verified` flag alone is not proof. Existing accounts without the timestamp must verify once. New password signups receive a 24-hour, single-use link after transaction commit. The UI at `/verify-email` provides resend (one-minute cooldown), status refresh, signout and support recovery. Protected API/WebSocket access is blocked until verified. An invitation accepted using its email token and a Google account with an explicit verified-email claim record mailbox proof directly. Microsoft Graph mail attributes do not establish mailbox ownership; these new accounts use the email-verification flow. Live email delivery is still an operator release check.

Owner choices use `/api/v1/auth/organizations/member-options/`, which exposes only active member IDs/names from the current organization and works for non-admin members. Full team-management APIs remain admin-only.

Profile photos use multipart uploads and server-validated PNG/JPEG/WebP images under 2 MB, stored under random filenames. The Compose blueprint persists shared media for API/workers and gives Caddy read-only access only to the `/media/avatars/` route. Other media, import files, exports, and snapshots are not publicly served. Alternate hosting must provide equivalent avatar delivery and persistent storage. Unsupported compact-layout/header-cost switches were removed; the theme selector uses the shared persisted theme.

Workspace backups are local data snapshots, not off-site infrastructure backups. They include data exports but do not restore login credentials, connector secrets, attachments, or remove newer records. Supported restore merges departments, teams, roles, subscriptions, and recommendations, verifies archive checksum and organization, and commits atomically. Status is durable (`restore_status`/`restore_error`) and the UI requires explicit confirmation. Snapshot/export/media volumes are shared by the API and worker in Compose; configure and prove off-site database backups separately.

Subscription imports accept CSV/JSON up to 5 MB and 5000 rows. Use `name,monthly_cost,total_licenses,currency,billing_cycle` columns. Duplicate names are skipped; invalid rows are reported; plan limits and organization boundaries apply. Other import types are intentionally rejected until a safe processor exists. Exports retain their own authenticated download route and expiry. Run the worker and Beat in staging; eager local QA is not evidence of production job delivery. Backup schedules run in UTC (default 02:00); the scheduler checks due jobs each minute.

Development validation: stop `next dev` before running the production build in the same checkout; both generate route types. If interrupted runs leave inconsistent `.next/dev` artifacts, stop the preview and clear only that generated cache before rebuilding. The final tested release build passes serially.
