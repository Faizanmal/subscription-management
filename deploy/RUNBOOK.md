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
3. Inside API container (or with env loaded): `python manage.py migrate` then `python manage.py check_launch_ready`
4. Point uptime monitor at `https://<api>/api/v1/health/`
5. Register Stripe **test** webhook → `https://<api>/api/v1/auth/billing/webhook/`
6. Create a trial user → `/onboarding` → Billing Checkout (test card `4242…`)
7. Confirm org `plan` becomes `pro` after webhook
8. Cancel via portal → plan returns to `starter`; Google setup returns `402`
9. Optional: connect Google/Microsoft on a trial org and run sync
10. Soak ≥ 48h with Celery worker **and** beat running

## Stripe cutover

1. Test mode: Checkout from Settings → Billing; confirm webhook `checkout.session.completed` upgrades `plan`.
2. Portal cancel → org returns to Starter; gated APIs return `402`.
3. Local forward (dev): `stripe listen --forward-to localhost:8000/api/v1/auth/billing/webhook/`
4. Live mode: rotate keys, update webhook endpoint to production URL, re-verify one charge.
5. Keep `STRIPE_PRICE_PRO` in sync with the Dashboard Price ID.

## Incident basics

| Symptom | First checks |
|---------|----------------|
| 5xx on API | `/api/v1/health/`, backend logs, DB connectivity |
| Syncs stuck | Celery worker + beat running; Redis reachable |
| Login / invite email missing | `EMAIL_BACKEND` / Anymail keys; not console in prod |
| Checkout fails | Stripe keys + price IDs; webhook secret |

Rollback: redeploy previous image tags; avoid reverse migrations. Prefer forward-fix migrations.

## Support channel

- Product: support@subscriptionwastemanager.com
- Security: security@subscriptionwastemanager.com
