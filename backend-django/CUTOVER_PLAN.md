# Django Cutover Plan (Node -> Django)

This runbook defines a low-risk migration from the current Node runtime to Django for API traffic.

## Goals

- Move production API traffic to Django without breaking frontend behavior.
- Keep rollback under 5 minutes.
- Use objective health gates before each phase.

Related document:

- Cutover day decision template: `backend-django/CUTOVER_GO_NO_GO_TEMPLATE.md`

## Current state

- Frontend pages currently call API via `window.MAGNETO_API_BASE_URL`.
- Django API parity is in place for: auth, health, search, location, events, assistant, admin overview/status/runtime, backups, export.
- CI runs:
  - `python manage.py preflight_security --mode prod`
  - `python manage.py test core.tests -v 2`

## Pre-cutover checklist

1. Infrastructure

- Django service deployed with HTTPS and stable domain.
- Node service remains live as rollback target.
- CORS configured for production frontend origin.

2. Security

- `DJANGO_DEBUG=false` in production.
- Strong non-default values set:
  - `DJANGO_SECRET_KEY`
  - `ADMIN_PASSWORD`
  - `JWT_SECRET`
- `SESSION_COOKIE_SECURE=true`, `CSRF_COOKIE_SECURE=true`.

3. Data and backups

- Confirm latest backup from `/api/admin/backups`.
- Create manual backup before cutover from admin dashboard.

4. Release gates

- CI green on target commit.
- Run preflight in production mode on deploy artifact:
  - `python manage.py preflight_security --mode prod`

## Health gates (must pass)

- `GET /api/health` responds `200` and stable latency.
- `GET /api/admin/runtime-metrics` accessible with admin token.
- Admin dashboard loads all blocks:
  - analytics overview
  - runtime metrics
  - assistant status
  - backups list
- Search end-to-end returns expected results.
- Assistant chat returns valid response (provider or fallback).
- CSV export works.

## Cutover strategy

### Phase 1: Canary (10%)

- Route 10% of API traffic to Django (proxy/load balancer rule).
- Monitor 15-30 minutes:
  - 5xx ratio
  - p95 latency
  - auth/login failures
  - backup endpoint behavior

Promote only if all SLOs are stable.

### Phase 2: 50%

- Increase traffic split to 50%.
- Repeat monitoring window.
- Validate admin actions and restore flow once.

### Phase 3: 100%

- Route all API traffic to Django.
- Keep Node hot standby for rollback window (at least 24h).

## Rollback plan (target <5 min)

1. Switch API routing back to Node at proxy/load balancer.
2. Purge/expire edge cache for API routes if present.
3. Verify with smoke checks:

- `/api/health`
- `/api/search?q=test`
- `/api/admin/overview` (auth)

4. Keep Django running for investigation; do not destroy evidence.

## Post-cutover verification

- Compare 24h metrics Node vs Django baseline:
  - request volume
  - 4xx/5xx rates
  - p95 latency
- Review assistant provider errors from admin status.
- Confirm backup schedule still runs and retention works.

## Operational notes

- Prefer one config switch for API upstream at edge/proxy, not frontend code edits.
- Do not rotate multiple variables during the same cutover window.
- Keep incident log with UTC timestamps and decision points.
