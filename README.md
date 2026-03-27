# MAGNETO Search

MAGNETO now runs as a custom search engine with:

- a controlled search API (`/api/search`)
- English interface
- admin authentication and analytics dashboard
- traffic + search logging with percentage breakdown

## Features

- Homepage with local weather widget and suggestion assistant
- Homepage keyboard shortcuts (`/` and `Ctrl+K`) for instant search focus
- Optional MAGNETO Assistant AI mode via backend API (with secure server-side key)
- MAGNETO Core search endpoint (server-side ranking over your own index)
- Results page that reads from your backend, not direct engine redirects
- Admin dashboard (`admin.html`) protected with username/password
- Analytics overview:
  - total searches
  - total page views
  - unique queries
  - period-over-period KPI comparison for filtered ranges
  - top queries by percentage (`%`)
  - traffic by page
  - latest searches timeline
  - charts for top queries and traffic share
  - time filters (`all`, `24h`, `7d`, `30d`)
  - CSV export for filtered analytics
  - daily trend (last 14 days) and weekly trend (last 8 weeks)
- Security hardening:
  - login rate-limit
  - temporary lockout after repeated failed logins
  - admin API request throttling
  - response tracing headers (`X-Request-ID`, `X-Response-Time-Ms`) and baseline browser security headers
- Automatic backup for `data/analytics.json`:
  - periodic scheduled backups
  - write-triggered backups with retention
  - manual backup + restore from admin dashboard
  - backup reason filter and direct JSON backup download

## Project Structure

- `server.js` - backend API, auth, search ranking, analytics
- `data/search-index.json` - editable search index used by MAGNETO Core
- `data/analytics.json` - persisted tracking data
- `data/backups/*.json` - automatic analytics backups
- `index.html` - homepage
- `results.html` - search results
- `admin.html` - admin login and analytics dashboard
- `script.js` - frontend logic for search, tracking, and admin
- `styles.css` - global styles and responsive layout
- `.env.example` - environment template

## Local Run

1. Install dependencies:
   - `npm install`
2. Create env file:
   - copy `.env.example` to `.env`
3. Set secure admin credentials in `.env`:
   - `ADMIN_USER=your-user`
   - `ADMIN_PASSWORD=your-strong-password`
   - `JWT_SECRET=your-strong-random-secret`

- `DJANGO_SECRET_KEY=your-strong-random-secret` in `backend-django/.env`
- never keep placeholder values like `admin`, `change-this-password`, or `change-this-secret`
- `.env` files are intentionally git-ignored; keep secrets only in local or deployment environment configuration

4. Optional tuning in `.env`:
   - login/lockout: `LOGIN_WINDOW_MINUTES`, `LOGIN_RATE_LIMIT_COUNT`, `LOCKOUT_THRESHOLD`, `LOCKOUT_MINUTES`
   - admin throttling: `ADMIN_WINDOW_SECONDS`, `ADMIN_RATE_LIMIT_COUNT`
   - backup behavior: `BACKUP_MIN_INTERVAL_MINUTES`, `BACKUP_SCHEDULE_MINUTES`, `MAX_BACKUP_FILES`
   - trend windows: `TREND_DAILY_POINTS`, `TREND_WEEKLY_POINTS`
   - assistant AI:
     - `OPENAI_API_KEY` (required for AI mode)
     - `OPENAI_MODEL` (default: `gpt-4o-mini`)
     - `ASSISTANT_WINDOW_SECONDS`, `ASSISTANT_RATE_LIMIT_COUNT`, `ASSISTANT_MAX_CHARS`
5. Start server:
   - `npm start`
6. Open:
   - `http://localhost:3000`

## Quick Health Check (Node + Django parity)

After services are running, execute:

- `npm.cmd run health:check`
- `npm.cmd run health:check:json` (machine-readable output for CI/canary)
- `npm.cmd run health:check:gate` (strict go/no-go gate)
- `npm.cmd run health:check:gate:save` (strict gate + save JSON report to `data/backups/health-check/`)
- `npm.cmd run health:check:gate:daily` (strict gate + overwrite `data/backups/health-check/latest-gate.json`)
- `node scripts/assistant-benchmark.js` or `npm run assistant:benchmark` (assistant latency/provider smoke benchmark)
- `node scripts/search-benchmark.js` or `npm run search:benchmark` (English search ranking quality validation)
- `node scripts/search-benchmark-romanian.js` or `npm run search:benchmark:romanian` (Romanian language search quality validation)
- `npm run search:parity:gate` (strict semantic Node vs Django parity gate)
- `npm run search:parity:compat` (relaxed parity profile for local debugging)

Windows note:

- use `npm.cmd` in PowerShell if script execution policy blocks `npm`
- `scripts/prod-monitor.sh` is supported from Git Bash and produces the same alert/baseline output used by operations docs

Gate flags:

- `--require-admin` fails if admin credentials are missing
- `--max-latency-ms=<N>` fails if any check exceeds `N` milliseconds
- `--save-report` writes JSON output to timestamped file
- `--out=<path>` writes JSON output to a specific file path
- `--label=<text>` adds a label to report metadata (example: `daily`, `canary-10`)

What it checks by default:

- `GET /index.html` on Node web server (`http://localhost:3000`)
- `GET /api/health`
- `GET /api/search?q=test`
- `POST /api/events/page-view`
- `POST /api/assistant/chat`

Optional admin checks (enabled only when credentials are set):

- `POST /api/auth/login`
- `GET /api/admin/overview?range=24h`
- `GET /api/admin/runtime-metrics`

Environment overrides:

- `MAGNETO_WEB_BASE` (default: `http://localhost:3000`)
- `MAGNETO_API_BASE` (default: `http://127.0.0.1:8000`)
- `MAGNETO_NODE_PORT` (default: `3000`, used when `MAGNETO_WEB_BASE` is not set)
- `MAGNETO_DJANGO_PORT` (default: `8000`, used when `MAGNETO_API_BASE` is not set)
- `MAGNETO_ADMIN_USER`, `MAGNETO_ADMIN_PASSWORD` (optional, takes precedence)
- `ADMIN_USER`, `ADMIN_PASSWORD` (optional fallback)

## Python and Django Track (Gradual Migration)

For long-term AI evolution, this repository now includes a parallel Django backend in `backend-django/`.

- Purpose: migrate endpoint-by-endpoint without breaking the current Node production flow
- First compatible endpoint: `GET /api/health`
- Full setup and migration notes: `backend-django/README.md`

Recommended next components for enterprise growth:

- `PostgreSQL` for relational data
- `Redis` for cache and queue workloads
- `Celery` for background AI tasks

## Admin Access

- URL: `http://localhost:3000/admin.html`
- Sign in with `ADMIN_USER` and `ADMIN_PASSWORD`
- Admin token is stored in browser localStorage for current session flow
- Rotate admin credentials and `JWT_SECRET` before any shared or production environment use
- Use range filters and `Export CSV` directly from dashboard controls
- Backup section supports:
  - `Create Backup` for manual snapshots
  - `Filter` backups by reason (`all`, `manual`, `scheduled`, `write`, etc.)
  - `Download` any backup JSON file
  - `Restore` to recover `analytics.json` from any backup file

## Monitoring Endpoint

- Health URL: `GET /api/health`
- Returns service status plus safe runtime configuration snapshot (rate limits, backup intervals, trend window sizes).
- Does not expose credentials or secrets.

## MAGNETO Assistant AI

- Endpoint: `POST /api/assistant/chat`
- Admin status endpoint: `GET /api/admin/assistant-status` (requires admin auth)
- Frontend assistant uses this endpoint automatically.

### Operating Mode

**Current operating mode: Local Fallback (no external AI providers configured)**

The assistant runs entirely on local rule-based logic (`provider: fallback`, `model: rule-based`).
No calls are made to external AI APIs. The system is fully operational in this mode.

**Limitations in fallback mode:**

- Responses are rule-based and do not use a language model.
- Complex open-ended or conversational queries receive simplified answers.
- No cost incurred from AI provider APIs.

**To enable full AI mode:**

1. Add provider key(s) to `.env` (see variables below).
2. Set `AI_PRIMARY_PROVIDER` to the desired provider name.
3. Restart the Node backend.
4. Verify via `GET /api/admin/assistant-status` that `configured: true`.

This decision was finalized as part of the Go-Live plan Etapa B (2026-03-27).
The project is production-ready with fallback mode active.

### Provider Architecture

- Assistant supports multi-provider routing (OpenAI + Anthropic + Gemini) with primary/fallback selection.
- Routing can be automatic (`smart`) so the assistant picks the best available provider based on helper type and recent provider health.
- Models can auto-rotate using candidate lists when a model is deprecated or unavailable.
- If providers are unavailable or unconfigured, assistant falls back to local rule-based suggestions.
- Keep API keys in `.env` only. Never expose them in frontend code.
- Hybrid cost-safe mode is enabled by default:
  - cache-first responses for repeated prompts
  - simple queries answered locally (`provider: local-hybrid`)
  - complex queries sent to AI provider when available
  - helper routing (`general`, `writing`, `weather-live`)
  - persistent assistant memory stored in `data/assistant-memory.json`

Assistant tuning variables:

- `AI_PRIMARY_PROVIDER` (`openai`, `anthropic`, or `gemini`)
- `AI_FALLBACK_PROVIDER` (`openai`, `anthropic`, or `gemini`)
- `AI_ROUTING_MODE` (`smart`, `priority`, or `random`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_MODEL_CANDIDATES` (comma-separated fallback list)
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `ANTHROPIC_MODEL_CANDIDATES` (comma-separated fallback list)
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_MODEL_CANDIDATES` (comma-separated fallback list)
- `ASSISTANT_CACHE_TTL_SECONDS`
- `ASSISTANT_CACHE_MAX_ENTRIES`
- `ASSISTANT_MEMORY_MAX_ITEMS`
- `ASSISTANT_SIMPLE_QUERY_WORDS`

Assistant billing observability:

- Check runtime/AI status from `GET /api/admin/assistant-status`
- This includes provider config, routing mode, provider health, helper/provider metrics, cache hits, and last provider error (for quota/billing diagnostics)
- It also includes active model per provider and model candidate lists used for automatic model rollover.

Model note:

- You can set newer OpenAI models (for example `gpt-5-mini` or `gpt-5`) in `OPENAI_MODEL` if your API account has access.

## Production Deployment & Operations

For detailed production deployment procedures, incident response, and operational guides:

### 📋 Complete Deployment Flow

- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Step-by-step pre-deployment validation (9 sections, comprehensive)
- **[PRODUCTION_OPERATIONS_GUIDE.md](PRODUCTION_OPERATIONS_GUIDE.md)** - Full operational procedures, traffic management, and monitoring

### 🚨 Incident Response

- **[INCIDENT_RESPONSE_PLAYBOOK.md](INCIDENT_RESPONSE_PLAYBOOK.md)** - Procedures for common production issues (high error rate, slow search, service unavailable, etc.)

### 🛠️ Essential Scripts

**Canary Traffic Management:**

```bash
./scripts/canary-manage.sh 5    # Set to 5% traffic
./scripts/canary-manage.sh 50   # Set to 50% traffic
./scripts/canary-manage.sh 0    # Rollback to previous version
./scripts/canary-manage.sh check # Check current status
```

**Monitoring & Health:**

```bash
./scripts/prod-monitor.sh --dashboard  # Live metrics dashboard
./scripts/prod-monitor.sh --alerts     # Check active alerts
./scripts/post-deploy-verify.sh --full # Full verification suite
```

**Emergency Operations:**

```bash
# Only use when critical issues detected
bash scripts/emergency-rollback.sh "Brief reason"
```

### Pre-Deployment Checklist

Before deploying to production:

```bash
# 1. Pass all validation gates
npm run release:gate:json
npm run health:check:gate:all
npm run parity:critical:gate
npm run contract:validate:gate:admin

# 2. Complete DEPLOYMENT_CHECKLIST.md (9 sections)

# 3. Get team approvals and sign deployment checklist

# 4. Follow canary rollout: 5% (1h) → 10% → 25% → 50% → 100%

# 5. Monitor dashboards continuously

# 6. Run post-deployment verification
./scripts/post-deploy-verify.sh --full

# 7. Continue monitoring for 24+ hours
```

### Status Summary

- **Version:** 9.95/10 - Production Ready
- **Release Gates:** ✅ All passing (health, parity, contracts)
- **Dual Backend:** Node.js (port 3000) + Django (port 8000)
- **Monitoring:** Real-time dashboards + alert thresholds configured

## Deploy Notes

This project is no longer static-only because it needs a running Node server.

- Deploy to a platform that supports Node.js runtime (for example: Render, Railway, Fly.io, Azure App Service, VPS).
- Configure environment variables in your deployment target.
- Keep `admin.html` unindexed (already in `robots.txt`).
- Use HTTPS in production.
- For production deployments, follow [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) and use canary rollout with [scripts/canary-manage.sh](scripts/canary-manage.sh).

## SEO Files

- `robots.txt`
- `sitemap.xml`

Update URLs when domain or routes change.

## Legal and Compliance

- `LICENSE` - project source code license (MIT)
- `THIRD_PARTY_NOTICES.md` - third-party package notices and license pointers
- `PRIVACY.md` - privacy policy template for deployment
- `TERMS.md` - terms of use template for deployment

Before public launch:

- add your legal contact information in `PRIVACY.md` and `TERMS.md`
- validate dependency licenses and keep notices up to date
- keep API keys and secrets in `.env` only (never in frontend files)
