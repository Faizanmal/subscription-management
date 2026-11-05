# Launch readiness review — November 3, 2026

Verdict: not ready for public self-service or paid launch. A controlled demonstration needs working local services and corrections to the public homepage first.

Remediation update: the findings below record the initial review. Repository fixes
have since been implemented for setup/CI, dependency locking, security boundaries,
authentication, billing, deployment configuration, and public presentation. Track
current completion and remaining hosted release gates in `../.cache-dev.md`.
This update does not certify a public deployment.

This review covers the local repository and available configuration. No public deployment URL was supplied. It is not a certification of a deployed system or a legal review.

## Blockers

1. **Production configuration is still local staging configuration.** The existing `backend/.env.prod` enables debug, uses localhost frontend/API/WebSocket URLs, and has incomplete Stripe, email, OAuth, Plaid, and AI configuration. Keep secret values private. Set public HTTPS/WSS origins, disable debug, configure real credentials for advertised services, and rebuild the frontend because its public URLs are build-time settings.
2. **The active launch check fails.** `python manage.py check_launch_ready --strict` reported debug enabled and rejected PostgreSQL credentials. This command used the active local environment; it did not validate a running production container. Migration drift inspection found no changes, but could not verify database migration history because authentication failed.
3. **Homepage links are broken.** `/demo`, `/about`, `/blog`, and `/careers` have links but no matching app routes. Replace them with implemented destinations or create the pages. Both demo calls to action need a real destination.
4. **Marketing needs substantiation.** The homepage presents customer names, testimonials, and average savings/utilization figures without evidence in this repository. Confirm these are authorized and supported, or remove them. It advertises Teams and accounting connectors while the README identifies those as future work. Align public promises with enabled, verified features.
5. **HTTPS proxy handling needs verification.** Production settings enable `SECURE_SSL_REDIRECT`, but no trusted proxy SSL setting is present and Daphne is started without explicit proxy-header handling. With TLS terminated at a reverse proxy and HTTP forwarded to Django, this can produce redirect loops. Configure the actual trusted proxy boundary and test HTTPS requests, authentication, and WebSockets through it.
6. **The default Compose/CI path is incomplete.** `docker compose config --quiet` fails without a root-level `ENCRYPTION_KEY`. The Compose CI job does not provide it, and the README's quick start omits that prerequisite. Supply a generated ephemeral key in CI and document local setup. Production Compose syntax validation with its env file passed.

## Fix made in this review

Updated `backend/.dockerignore` to exclude `.env.*`, SQLite databases and sidecars, exports, and media while retaining environment examples. Previously `COPY . .` could embed `.env.prod` and local data in backend images. This protects future builds; existing images were not inspected or rebuilt. If any previous images were distributed, check their contents and rotate exposed secrets as appropriate.

## Verification

- Backend: 58 tests passed with an in-process, test-only MD5 password hasher for speed. Production password settings were not changed. This does not validate production password hashing or real provider connectivity.
- Frontend lint and standalone TypeScript check passed.
- Frontend production build passed after rerunning with process access outside the sandbox. The initial sandboxed build compiled but could not spawn its TypeScript worker.
- Frontend guard tests: 7 passed using Node's `--test-isolation=none`; the normal isolated runner encountered sandbox `spawn EPERM`.
- Frontend production dependency audit: zero reported vulnerabilities at review time. Backend dependency vulnerabilities were not audited.
- Migration drift: no changes detected, with a database authentication warning.
- Production Compose configuration parsed successfully.
- `git diff --check` passed for the packaging change.
- No HTTP service was reachable at localhost ports 3000 or 8000 during probes. Browser layout, mobile behavior, and complete user journeys were not verified.

## Release acceptance

Before public launch, deploy a staging instance with the intended production topology. Pass the strict launch check and Django deployment checks inside the configured backend container. Demonstrate signup, login, password reset email delivery, subscription creation and editing, and organization isolation with two organizations. Exercise actual enabled connectors and a sync through Celery and beat.

For a paid launch, complete Stripe test Checkout, signed webhook upgrade, customer portal cancellation, and feature downgrade. Verify duplicate/out-of-order billing event behavior and delayed-payment handling. The current webhook applies the plan on `checkout.session.completed` without checking payment status, so delayed payment methods require attention before enabling them.

Verify backup restoration, monitoring alerts, HTTPS redirects, and support mailbox delivery. Complete the existing runbook's 48-hour worker/beat soak. Correct the homepage claims and links, then inspect desktop and mobile views and social-sharing metadata on the deployed site.
