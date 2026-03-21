# Official Migration Plan

## Purpose

This document defines the target architecture, migration rules, temporary legacy locations, and the implementation order for evolving MAGNETO from the current mixed structure into a modular platform.

## Target Zones And Their Roles

### apps/web

- Owns browser UI, page entrypoints, page-specific logic, reusable presentation components, browser-side state, and API client code.
- Must not contain secrets, provider keys, or server-only business rules.
- Temporary legacy location today: `index.html`, `results.html`, `admin.html`, `script.js`, `styles.css`, `config.js` remain active at repository root while code is extracted gradually.
- Move later: root page scripts and shared browser utilities move into `apps/web/pages`, `apps/web/services`, `apps/web/utils`, `apps/web/state`, and `apps/web/components`.

### apps/api-node

- Owns the current Node runtime used as the live compatibility backend and transition layer.
- Must be modularized into config, middleware, routes, controllers, services, repositories, and utils.
- Temporary legacy location today: `server.js` remains the runtime entrypoint.
- Move later: route handlers, auth helpers, admin logic, assistant orchestration, analytics logic, and search proxy/runtime helpers move under `apps/api-node/src/*`.

### apps/api-django

- Owns the strategic backend that should become the primary business-logic backend over time.
- Should be the long-term home for durable search, assistant orchestration, analytics, indexing, persistence, tasks, and admin APIs.
- Temporary legacy location today: `backend-django/core/views.py` still carries multiple endpoint responsibilities in one file.
- Move later: split API views, services, models, repositories, and tasks by domain inside `apps/api-django`.

### domains

- Owns product-domain logic and contracts that should stay conceptually stable even if framework/runtime changes.
- Required domain groups: `search`, `assistant`, `analytics`, `admin`.
- Temporary legacy location today: domain logic is mixed across `server.js`, `script.js`, `backend-django/core/views.py`, and `backend-django/core/services/*`.
- Move later: scoring, query rewrite, crawl/index workflow, provider routing, prompt orchestration, admin monitoring rules, and analytics aggregation become explicit domain modules.

### shared

- Owns shared contracts, schemas, constants, safe cross-runtime configuration, and neutral utilities.
- Should be framework-agnostic whenever possible.
- Temporary legacy location today: response shapes and API assumptions are implicit in frontend and backend code.
- Move later: search, assistant, admin metrics, and error response contracts become explicit schema files under `shared/schemas` and `domains/*/contracts`.

### data

- Owns bootstrap data, fixtures, backups, and temporary runtime file-based persistence.
- Temporary legacy location today: runtime JSON data is already in `data/`, but operational and bootstrap concerns are mixed together.
- Move later: critical runtime data moves to PostgreSQL and Redis; JSON remains only for bootstrap, import/export, fixtures, and controlled fallback.

### scripts

- Owns repeatable operational commands: local dev, health checks, benchmarks, migrations, and maintenance.
- Temporary legacy location today: scripts already exist, but they are not yet grouped by lifecycle purpose.
- Move later: separate `dev`, `health`, `benchmarks`, `migration`, and `maintenance` concerns into clear folders.

### tests

- Owns regression safety: unit, integration, contract, parity, and end-to-end coverage.
- Temporary legacy location today: Django tests are structured, but Node/frontend tests are lighter and contracts are not yet first-class.
- Move later: add shared contract tests, backend parity tests, and browser E2E coverage.

### docs

- Owns architecture, operations, migration runbooks, and product-level technical guidance.
- Temporary legacy location today: knowledge is spread across root README, Django README, and cutover docs.
- Move later: centralize architecture, contracts, migration rules, and operational procedures under `docs/`.

## Migration Rules

1. Keep runtime entrypoints stable until each extracted module is verified.
2. Extract safe helpers first: config, utils, middleware, API client, page bootstraps.
3. Do not rewrite behavior while moving code.
4. Introduce dependency injection where Node route logic still depends on legacy state inside `server.js`.
5. Keep Node as compatibility runtime while Django absorbs strategic ownership.
6. Move durable business rules to Django before deleting their Node equivalents.
7. Define shared contracts before enforcing cutover.
8. Treat JSON persistence as temporary unless the file is explicitly bootstrap or export data.

## What Stays Temporarily In Place

### Root frontend files

- `index.html`, `results.html`, `admin.html`
- `styles.css`
- `script.js`
- `config.js`
- Reason: they remain the active runtime entrypoints while logic is extracted into `apps/web`.

### Root Node entrypoint

- `server.js`
- Reason: it remains the active startup file while routes, middleware, config, and controllers are moved under `apps/api-node/src`.

### Django folder location

- `backend-django/`
- Reason: it is already operational and should be treated as the current `apps/api-django` until a later repository normalization step.

### Runtime JSON data

- `data/analytics.json`
- `data/assistant-memory.json`
- `data/routing-state.json`
- `data/index-sync-state.json`
- `data/search-index.json`
- Reason: they remain active until durable DB-backed replacements are introduced and tested.

## What Must Move Later

### Node to extracted Node modules

- auth middleware and login flow
- health and admin route wiring
- assistant orchestration helpers
- analytics and backup logic
- search proxy/runtime helpers
- routing and index-sync helpers

### Root frontend to apps/web

- shared browser API client
- page bootstraps
- admin token/session state helpers
- common DOM/storage/format helpers
- page-specific home/results/admin logic
- reusable renderers and widgets

### Node strategic ownership to Django

- durable search indexing and ranking ownership
- assistant routing, memory, provider health, and long-running jobs
- analytics persistence and reporting
- admin metrics and operational controls backed by DB/cache

## Professional Implementation Order

### Foundation

1. Freeze target architecture and migration rules.
2. Extract Node config, utils, middleware, and safest public routes.
3. Extract frontend API client, page bootstraps, state helpers, and shared browser utilities.

### Stabilization

1. Define shared contracts and response schemas.
2. Align Node and Django to the same contract shapes.
3. Move strategic business ownership from Node to Django one domain at a time.

### Maturation

1. Move critical JSON-backed data to PostgreSQL and Redis.
2. Add contract tests, parity tests, and browser E2E coverage.
3. Consolidate architecture docs, operational docs, and scripts by lifecycle purpose.
4. Expand observability and maintenance automation.

## Cutover Principle

The final cutover should happen only after:

- shared contracts are stable
- parity tests pass consistently
- durable data is no longer owned by JSON files
- Django owns strategic business logic
- Node is reduced to compatibility or web-serving duties
