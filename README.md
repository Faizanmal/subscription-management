# Subscription Waste Manager

SaaS app for discovering, tracking, and cutting wasted software subscriptions. Django REST API plus a Next.js dashboard.

## Stack

- **API:** Django 6, DRF, JWT, Celery, Channels
- **UI:** Next.js (App Router) on port 3000
- **Data:** PostgreSQL in Docker / production, SQLite for local tests
- **Queue/cache:** Redis

## Quick start with Docker

```bash
python deploy/bootstrap_env.py
docker compose up --build
```

The bootstrap creates gitignored local environment files and the root `.env`
needed for Compose's `ENCRYPTION_KEY` interpolation. It preserves existing keys,
database passwords, and provider credentials. Run it with Python before your
first Compose start; do not regenerate keys for data already encrypted.
`backend/.env` is loaded by local Django commands; it does not supply Compose's
root-level interpolation variables. The generated `.env.prod` is for local smoke
checks only and must be configured for HTTPS before a public deployment.

Then open [http://localhost:3000](http://localhost:3000). API: [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/). Health: [http://localhost:8000/api/v1/health/](http://localhost:8000/api/v1/health/).

Copy `backend/.env.example` to `backend/.env` if you want OAuth, Stripe, or Plaid keys. Compose already sets database and Redis URLs.

## Local development (no Docker)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # macOS/Linux: source venv/bin/activate
pip install --require-hashes -r requirements.lock
copy .env.example .env         # macOS/Linux: cp .env.example .env
python manage.py migrate
python manage.py runserver
```

Optional worker (needs Redis):

```bash
celery -A backend worker -l info
```

Tests use SQLite and in-memory cache automatically:

```bash
python manage.py test
```

For deterministic tests without local provider credentials and with a faster,
test-only password hasher (also used in CI):

```bash
python manage.py test --settings=backend.test_settings
```

The authentication suite includes a separate smoke test with the production
PBKDF2 password hasher. Test-only settings must never be used to run the service.

`backend/requirements.txt` contains dependency constraints; the hashed
`backend/requirements.lock` is used by local setup, Docker, and CI. Regenerate it
after intentional dependency changes with:

```bash
uv pip compile backend/requirements.txt --python-version 3.12 --universal --generate-hashes --output-file backend/requirements.lock
```

### Frontend

Use Node.js 24 LTS (also used by Docker and CI; see `frontend/.nvmrc`).

```bash
cd frontend
copy .env.example .env.local   # macOS/Linux: cp .env.example .env.local
npm install
npm run dev
```

`NEXT_PUBLIC_API_URL` must be `http://localhost:8000/api/v1` (the `/api/v1` prefix is required). Pointing it at port 3000 will break login.

```bash
npm run type-check
npm run lint
```

## Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | frontend `.env.local` | `http://localhost:8000/api/v1` |
| `DATABASE_URL` | backend | Postgres URL (SQLite if unset) |
| `REDIS_URL` / `CELERY_BROKER_URL` | backend | Cache, Channels, Celery |
| `FRONTEND_URL` | backend | Invite, reset, and OAuth redirect origin |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | backend | Google Workspace + login |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | backend | Microsoft 365 + login |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | backend | Bank feeds |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_PRO` | backend | Billing |

OAuth redirect URIs to register with Google/Microsoft:

- `http://localhost:3000/integrations/google/callback`
- `http://localhost:3000/integrations/microsoft/callback`

Stripe webhook: `http://localhost:8000/api/v1/auth/billing/webhook/`

## What works today

- Auth, invites, MFA, org/notification settings
- Subscription CRUD, dashboard, recommendations, workflows
- Google Workspace, Microsoft 365, Plaid, email scan
- Slack incoming webhooks, Okta, Azure AD
- Stripe Checkout for Pro (when price IDs are set)

Still coming later: Microsoft Teams notifications, QuickBooks, Xero, and other accounting/HR connectors.

## Release validation

See `deploy/RUNBOOK.md` for proxy setup, database migrations, backups, and release
checks. Public frontend builds also need `NEXT_PUBLIC_APP_URL` and
`NEXT_PUBLIC_INDEXABLE=true`; keep indexing disabled on staging.
Paid Checkout uses card payments and requires complete Stripe key, webhook, and
Pro price configuration. MFA accounts sign in with email, password, and a current
authenticator code; social sign-in cannot bypass this requirement.

## License

MIT
