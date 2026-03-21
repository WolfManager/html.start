# Consolidation Roadmap

## Foundation

- Freeze migration rules and target ownership per area.
- Keep root entrypoints active while extracting safe modules.
- Modularize Node first through config, middleware, routes, controllers, services, and utils.
- Modularize frontend through shared browser services, state helpers, and page bootstraps.

## Stabilization

- Add contract tests for search, assistant, admin metrics, and error responses.
- Add Node vs Django parity checks for public API behavior.
- Move strategic search and assistant ownership to Django while Node remains compatibility runtime.
- Keep JSON runtime storage only where no durable replacement exists yet.

## Maturation

- Move analytics, assistant memory, routing state, and index sync metadata to PostgreSQL or Redis where appropriate.
- Add browser E2E coverage for homepage, results, assistant, and admin login/dashboard flows.
- Group scripts by lifecycle purpose: `dev`, `health`, `benchmarks`, `migration`, `maintenance`.
- Expand architecture docs, operational runbooks, and observability guidance.

## Strategic Ownership Shift To Django

### Search

- search result generation
- search source registry
- crawl runs and indexing
- ranking config persistence
- query rewrite persistence and governance

### Assistant

- provider routing policy
- provider health tracking
- durable assistant memory
- prompt registry and orchestration
- asynchronous assistant jobs

### Admin Metrics

- runtime metrics aggregation that needs durable persistence
- analytics overview backed by DB/cache
- backup metadata and restore audit records
- routing/cutover audit trail

## Recommended Test Layers

- unit tests for pure search and assistant helpers
- integration tests for Node and Django endpoints
- contract tests against shared schemas
- parity tests across Node and Django responses
- browser E2E for primary user journeys

## Recommended Data Migration Order

1. analytics events and aggregates
2. assistant memory and provider runtime state
3. routing and sync metadata
4. search index and ranking configuration

## Recommended Script Groups

- `scripts/dev`: local startup and developer quality-of-life commands
- `scripts/health`: readiness, smoke, and gate checks
- `scripts/benchmarks`: search and assistant benchmarks
- `scripts/migration`: cutover, import/export, sync, data backfill
- `scripts/maintenance`: backup cleanup, reindex, repair, and scheduled jobs
