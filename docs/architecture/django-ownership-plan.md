# Django Ownership Plan

## Node Responsibilities That Remain Transitional

- static file serving for current root pages
- compatibility API runtime during migration
- proxy/fallback behavior while Django parity is being validated
- temporary JSON-backed operational helpers

## Responsibilities Django Should Own Long-Term

### Search domain

- canonical search documents
- canonical source registry
- crawl and indexing jobs
- ranking configuration persistence
- query rewrite management
- primary search result generation contract

### Assistant domain

- canonical assistant orchestration
- provider routing policy and health state
- durable conversation and memory persistence
- prompt versioning and agent evolution path
- async AI tasks and retries

### Admin and analytics domain

- durable analytics storage
- admin overview aggregation
- restore and backup metadata audit trail
- operational metrics beyond process-local Node memory

## Cutover Readiness Conditions

- shared contracts are stable
- Node and Django parity checks pass consistently
- critical runtime data is no longer owned only by JSON files
- browser flows work against Django-backed APIs without compatibility patches
- operational scripts and docs cover rollback and recovery
