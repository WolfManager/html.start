# Go/No-Go Checklist (Pre-Filled) - 2026-03-13

## Change metadata

- Date (UTC): 2026-03-13
- Change owner: pending
- Approver: pending
- Target release/commit: pending
- Rollback owner: pending

## Scope

- Change: API upstream routing Node -> Django
- Planned rollout: 10% -> 50% -> 100%
- Rollback target: Node upstream

## Preflight gate

- [x] CI green for target commit (local validation path covered)
- [x] `python manage.py preflight_security --mode prod` passed with secure production-grade values
- [x] `python manage.py test core.tests -v 2` passed (27/27)
- [ ] Latest manual backup created from production admin dashboard
- [ ] Rollback switch verified at production proxy/load balancer

## Production smoke checks (before shifting traffic)

- [x] `npm.cmd run health:check:gate` strict gate passed after warm-up
- [x] `GET /api/health` -> 200
- [x] `GET /api/admin/runtime-metrics` -> 200 with admin token
- [x] `GET /api/search?q=test` -> expected result shape
- [x] `POST /api/assistant/chat` -> valid response
- [x] `GET /api/admin/export.csv` -> downloadable CSV

Evidence:

- Warm pre-cutover report:
  - `data/backups/health-check/health-check-2026-03-13T17-07-50-515Z.json`

## Phase 1: 10% canary

- Status: GO (current-environment execution evidence)
- Evidence report:
  - `data/backups/health-check/health-check-2026-03-13T17-08-20-590Z.json`

## Phase 2: 50%

- Status: GO (current-environment execution evidence)
- Evidence report:
  - `data/backups/health-check/health-check-2026-03-13T17-09-56-104Z.json`

## Phase 3: 100%

- Status: GO (current-environment execution evidence)
- Evidence report:
  - `data/backups/health-check/health-check-2026-03-13T17-09-59-426Z.json`

## Rollback validation

- [x] Rollback drill duration measured under 5 minutes
- Measured value: 7.88 seconds
- Final passing rollback evidence:
  - `data/backups/health-check/health-check-2026-03-13T17-13-54-977Z.json`

## Decision

- Current-environment recommendation: GO
- Production recommendation: CONDITIONAL GO

Conditions to switch to full production GO:

1. Execute one manual backup from production admin dashboard.
2. Verify live rollback switch at production edge/proxy.
3. Run one production strict gate report and archive it.
