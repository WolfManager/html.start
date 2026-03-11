# Magneto Django Backend (Gradual Migration)

This backend runs in parallel with the existing Node.js service.

## Why this folder exists

- Keep current product stable while introducing Python gradually.
- Start with compatible endpoints while preserving existing frontend behavior.
- Move AI logic endpoint-by-endpoint, not all at once.

## Included stack

- Django
- Django REST Framework (DRF)
- django-cors-headers
- PostgreSQL (optional production DB)
- Redis (optional cache + broker)
- Celery (background workers)

## Implemented API parity (phase 1)

- `POST /api/auth/login`
- `GET /api/health`
- `GET /api/search?q=...`
- `POST /api/events/page-view`
- `POST /api/assistant/chat`
- `GET /api/admin/overview?range=all|24h|7d|30d`
- `GET /api/admin/assistant-status`
- `GET /api/admin/runtime-metrics`
- `GET /api/admin/backups?reason=all|manual|scheduled|...`
- `GET /api/admin/backups/download?fileName=...`
- `POST /api/admin/backups/create`
- `POST /api/admin/backups/restore`
- `GET /api/admin/export.csv?range=all|24h|7d|30d`

Assistant chat supports provider routing by environment variables:

- `AI_PRIMARY_PROVIDER`
- `AI_FALLBACK_PROVIDER`
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`

If no providers are configured or providers fail, it falls back to local response mode.

## AI hardening included

- Assistant rate limiting (`ASSISTANT_WINDOW_SECONDS`, `ASSISTANT_RATE_LIMIT_COUNT`)
- Response cache with TTL and max entries
- Persistent assistant memory in `data/assistant-memory.json`
- Runtime metrics and provider/error snapshot from `GET /api/admin/assistant-status`

## Request observability

- Every response includes `X-Request-ID` and `X-Response-Time-Ms` headers.
- Incoming `X-Request-ID` is propagated when provided; otherwise it is generated server-side.
- API calls (`/api/*`) are logged with method, path, status, duration, and request id.

Admin endpoints protection:

- `POST /api/auth/login` returns a Bearer token
- `GET /api/admin/overview` and `GET /api/admin/assistant-status` require `Authorization: Bearer <token>`
- Admin request throttling is enabled (`ADMIN_WINDOW_SECONDS`, `ADMIN_RATE_LIMIT_COUNT`)

Production fail-fast security checks:

- When `DJANGO_DEBUG=false`, the app will refuse to start if:
  - `DJANGO_SECRET_KEY` is missing/default/too short
  - `ADMIN_PASSWORD` is missing/default/too short
  - `JWT_SECRET` is missing/default/too short
  - `SESSION_COOKIE_SECURE` or `CSRF_COOKIE_SECURE` is explicitly set to `false`

## Run locally

1. Create virtual environment:
   - `python -m venv .venv`
2. Activate:
   - Windows PowerShell: `.\.venv\Scripts\Activate.ps1`
3. Install deps:
   - `pip install -r requirements.txt`
4. Configure env:
   - copy `.env.example` to `.env`
5. Run migrations:
   - `python manage.py migrate`
6. Start server:
   - `python manage.py runserver 8000`

## Run tests

- API regression tests (health + auth + search + location + events + admin + assistant + backup + export endpoints): `python manage.py test core.tests.test_api -v 2`
- Full Django backend tests (API + security config): `python manage.py test core.tests -v 2`

## Security preflight

- Validate production-grade secrets/cookie settings without starting the server:
  - `python manage.py preflight_security`
- Modes:
  - `--mode prod` (default): enforce production checks even if `DJANGO_DEBUG=true`
  - `--mode current`: enforce checks only when `DJANGO_DEBUG=false`

## CI automation

- GitHub Actions workflow: `.github/workflows/django-ci.yml`
- On push/PR it runs:
  - `python manage.py preflight_security --mode prod`
  - `python manage.py test core.tests -v 2`

## Cutover runbook

- Node -> Django migration runbook: `backend-django/CUTOVER_PLAN.md`
- Cutover day decision template: `backend-django/CUTOVER_GO_NO_GO_TEMPLATE.md`

## Production-oriented local stack (PostgreSQL + Redis)

1. Start infra:
   - `docker compose up -d`
2. Set `.env` values:
   - `DB_ENGINE=postgres`
   - `DB_HOST=127.0.0.1`
   - `DB_PORT=5432`
   - `DB_NAME=magneto`
   - `DB_USER=magneto`
   - `DB_PASSWORD=magneto`
   - `REDIS_URL=redis://127.0.0.1:6379/0`
3. Run migrations:
   - `python manage.py migrate`
4. Start Django API:
   - `python manage.py runserver 8000`
5. Start Celery worker:
   - Windows: `celery -A magneto_backend worker --loglevel=info --pool=solo`
   - Linux/macOS: `celery -A magneto_backend worker --loglevel=info`

Tip:

- Keep `CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP=true` for resilient worker startup.

Health check:

- `http://127.0.0.1:8000/api/health`

## Recommended long-term additions

- Structured observability (OpenTelemetry traces + metrics)
- JWT auth for admin/API security
- Prompt/version registry for model changes

## Suggested migration order

1. `GET /api/health`
2. `GET /api/search` and `POST /api/events/page-view`
3. `POST /api/assistant/chat` hardening (rate-limit, memory, caching, observability)
4. Admin analytics endpoints parity
5. Tracing, metrics, alerting, and cost dashboards

Keep Node as primary until endpoint parity is validated.

## Frontend API base switch (no HTML edits)

The frontend now reads API base URL from `config.js` at project root.

Priority order:

- `?apiBase=http://host:port` query parameter
- `localStorage.MAGNETO_API_BASE_URL`
- default value in `config.js` (currently `http://127.0.0.1:8000`)

Examples:

- Temporary override for one session/tab test:
  - `http://localhost:3000/index.html?apiBase=http://127.0.0.1:8000`
- Persistent override from browser console:
  - `localStorage.setItem("MAGNETO_API_BASE_URL", "http://127.0.0.1:8000")`

This keeps cutover simple because switching API upstream can be done by config/proxy,
without editing `index.html`, `results.html`, or `admin.html`.

## One-command local startup (Node + Django)

From repository root (`d:\Visual Studio Code`):

- Start both services in one terminal:
  - `npm.cmd run dev:full`
- Start both services with Django auto-reload disabled:
  - `npm.cmd run dev:full:stable`
- Dry-run command preview:
  - `npm.cmd run dev:full:dry`
- Start only Node frontend/backend:
  - `npm.cmd run dev:node`
- Start only Django API:
  - `npm.cmd run dev:django`
- Start only Django API without auto-reload:
  - `npm.cmd run dev:django:stable`

Notes:

- Default Python command is `python`.
- Override if needed: `set MAGNETO_PYTHON=py -3` (or your venv Python path) before running `dev:full`.
- Default ports: Node `3000`, Django `8000`.
- Override ports if occupied:
  - `set MAGNETO_NODE_PORT=3100`
  - `set MAGNETO_DJANGO_PORT=8100`
  - then run `npm.cmd run dev:full:stable`
- Quick alternate-port preset:
  - `npm.cmd run dev:full:alt-ports`

## Automated parity health-check

From repository root run:

- `npm.cmd run health:check`
- `npm.cmd run health:check:json` (machine-readable output for CI/canary)
- `npm.cmd run health:check:gate` (strict go/no-go gate)
- `npm.cmd run health:check:gate:save` (strict gate + timestamped JSON report)
- `npm.cmd run health:check:gate:daily` (strict gate + overwrite latest report file)

Gate flags:

- `--require-admin` fails if admin credentials are missing
- `--max-latency-ms=<N>` fails if any check exceeds `N` milliseconds
- `--save-report` writes JSON output to timestamped file
- `--out=<path>` writes JSON output to a specific file path
- `--label=<text>` adds a label to report metadata

Defaults:

- Web base: `http://localhost:<MAGNETO_NODE_PORT>` (default port `3000`)
- API base: `http://127.0.0.1:<MAGNETO_DJANGO_PORT>` (default port `8000`)

Direct URL overrides (optional):

- `MAGNETO_WEB_BASE`
- `MAGNETO_API_BASE`

Optional admin endpoint checks are enabled when both env vars are set:

- `MAGNETO_ADMIN_USER`
- `MAGNETO_ADMIN_PASSWORD`

Fallback variables (also supported):

- `ADMIN_USER`
- `ADMIN_PASSWORD`
