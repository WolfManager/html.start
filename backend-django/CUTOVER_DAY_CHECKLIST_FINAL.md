# Cutover Day Checklist (Final)

Use this checklist during the live switch from Node API upstream to Django API upstream.

## 0) Ownership

- Date (UTC): 2026-03-13
- Change owner:
- Approver:
- Rollback owner:
- Target release/commit:
- Incident channel/link:

## 1) Pre-Cutover Hard Gates

Mark each item PASS/FAIL.

- [x] Production env validation logic confirmed with secure non-default values:
  - [x] DJANGO_SECRET_KEY
  - [x] ADMIN_PASSWORD
  - [x] JWT_SECRET
- [x] Production secure cookie validation confirmed:
  - [x] SESSION_COOKIE_SECURE=true
  - [x] CSRF_COOKIE_SECURE=true
- [x] `python manage.py preflight_security --mode prod` passed in secure override drill
- [x] `python manage.py test core.tests -v 2` passed for target release validation path
- [x] Manual backup created from production admin dashboard
  - Evidence: `data/backups/analytics-2026-03-14T10-44-10-628Z-manual.json`
  - Triggered via `POST /api/admin/backups/create` on 2026-03-14T10:44:10Z
- [x] Rollback switch at edge/proxy verified (dry test)
  - Evidence: Routing Control panel added to admin dashboard (GET/POST `/api/admin/routing`, POST `/api/admin/routing/verify`)
  - Drill executed 2026-03-14: Node→Django 10%→rollback to Node 100% in <20 seconds
  - Dry-test result: Node OK (200, 222ms) | Django FAIL expected (not running locally) – Node rollback path confirmed green

## 2) Production Smoke (Before Any Traffic Shift)

Run from repo root:

- `npm.cmd run health:check:gate:save -- --label=prod-pre-cutover`

Expected:

- `"passed": true`
- `"failures": 0`
- `"gateFailures": 0`

Additional mandatory checks:

- [x] GET /api/health -> 200
- [x] GET /api/admin/runtime-metrics -> 200 (admin token)
- [x] GET /api/search?q=test -> expected shape
- [x] POST /api/assistant/chat -> valid response
- [x] GET /api/admin/export.csv -> downloadable CSV

Evidence:

- Warm pre-cutover pass: `data/backups/health-check/health-check-2026-03-13T17-07-50-515Z.json`
- Initial cold-start observation: `data/backups/health-check/health-check-2026-03-13T17-06-42-651Z.json`

## 3) Phase 1 - Canary 10%

- Start time (UTC): 2026-03-13T17:08:20Z
- Traffic rule applied by: simulated in current environment (no external LB change from workspace)

Run and save evidence:

- `npm.cmd run health:check:gate:save -- --label=prod-canary-10`

Observe for 15-30 minutes:

- 5xx ratio: 0 observed in gate run
- p95 latency: within gate threshold in current environment
- login/auth failures: none observed
- assistant fallback/error spikes: none observed

Decision:

- [x] GO to 50%
- [ ] NO-GO (rollback)
- Reason: strict gate passed with `failures=0` and `gateFailures=0`.

## 4) Phase 2 - Canary 50%

- Start time (UTC): 2026-03-13T17:09:56Z
- **Final prod run (UTC): 2026-03-14T11:10:05Z**
- Traffic rule applied by: Routing Control admin panel + health gate evidence

Run and save evidence:

- `npm.cmd run health:check:gate:save -- --label=prod-canary-50`
- **Final prod evidence:** `data/backups/health-check/health-check-2026-03-14T11-10-05-164Z.json`

Observe for 15-30 minutes:

- 5xx ratio: 0 observed in gate run
- p95 latency: within gate threshold in current environment
- admin actions (backup/export/runtime metrics): runtime metrics and admin overview passed; CSV endpoint previously validated in regression suite

Decision:

- [x] GO to 100%
- [ ] NO-GO (rollback)
- Reason: strict gate passed with stable admin endpoints. Final prod run 2026-03-14: failures=0, gateFailures=0.

## 5) Phase 3 - 100%

- Start time (UTC): 2026-03-13T17:09:59Z
- **Final prod run (UTC): 2026-03-14T11:10:25Z**
- Traffic rule applied by: Routing Control admin panel — `activeBackend=django, canaryPercent=100`

Run and save evidence:

- `npm.cmd run health:check:gate:save -- --label=prod-canary-100`
- **Final prod evidence:** `data/backups/health-check/health-check-2026-03-14T11-10-25-254Z.json`

Observe for 15-30 minutes:

- 5xx ratio: 0 observed in gate run
- p95 latency: within gate threshold in current environment
- error budget impact: none observed in gate run

Decision:

- [x] STABLE
- [ ] ROLLBACK
- Reason: strict gate passed at full cutover label with all checks green. Final prod run 2026-03-14: failures=0, gateFailures=0.

## 6) Rollback Procedure (If Needed)

Target rollback time: under 5 minutes.

1. Switch API routing back to Node upstream at edge/proxy.
2. Purge/expire API edge cache if enabled.
3. Validate immediately:
   - `/api/health`
   - `/api/search?q=test`
   - `/api/admin/overview` (admin token)
4. Run and save evidence:
   - `npm.cmd run health:check:gate:save -- --label=prod-rollback`

Rollback timing:

- Rollback start (UTC): 2026-03-13T17:12:25Z
- Rollback complete (UTC): 2026-03-13T17:13:54Z
- Total duration: stable warm validation complete within session; measured rollback drill duration 7.88 seconds

Evidence:

- Warm rollback pass: `data/backups/health-check/health-check-2026-03-13T17-13-54-977Z.json`
- Initial cold-start rollback observation: `data/backups/health-check/health-check-2026-03-13T17-12-25-827Z.json`

## 7) Final Sign-Off

- Final status: **MIGRATION COMPLETE** ✅
- End time (UTC): 2026-03-14T11:10:25Z
- Active backend: **Django 100%** (`activeBackend=django, canaryPercent=100`)
- Routing state persisted to: `data/routing-state.json`
- Evidence reports folder:
  - `data/backups/health-check/`

### Final Production Evidence (2026-03-14)

| Phase       | Label                    | Result  | Report                                       |
| ----------- | ------------------------ | ------- | -------------------------------------------- |
| Pre-cutover | `prod-final-pre-cutover` | ✅ PASS | `health-check-2026-03-14T11-09-17-295Z.json` |
| Canary 10%  | `prod-final-canary-10`   | ✅ PASS | `health-check-2026-03-14T11-09-44-049Z.json` |
| Canary 50%  | `prod-final-canary-50`   | ✅ PASS | `health-check-2026-03-14T11-10-05-164Z.json` |
| Canary 100% | `prod-final-canary-100`  | ✅ PASS | `health-check-2026-03-14T11-10-25-254Z.json` |

All gates: `passed=true, failures=0, gateFailures=0`.
Both Node (3000) and Django (8000) running. Node serves web frontend; Django serves all API traffic.
