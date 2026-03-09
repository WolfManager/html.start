# Go/No-Go Template (Cutover Day)

Use this checklist during the live Node -> Django traffic switch.

## Change metadata

- Date (UTC):
- Change owner:
- Approver:
- Target release/commit:
- Rollback owner:

## Scope

- Change: API upstream routing Node -> Django
- Planned rollout: 10% -> 50% -> 100%
- Rollback target: Node upstream

## Preflight gate

Mark each as `PASS` or `FAIL`.

- [ ] CI green for target commit
- [ ] `python manage.py preflight_security --mode prod` passed on deployed artifact
- [ ] `python manage.py test core.tests -v 2` passed on target branch
- [ ] Latest manual backup created from admin dashboard
- [ ] Rollback switch verified at proxy/load balancer

## Production smoke checks (before shifting traffic)

- [ ] `GET /api/health` -> 200
- [ ] `GET /api/admin/runtime-metrics` -> 200 with admin token
- [ ] `GET /api/search?q=test` -> expected result shape
- [ ] `POST /api/assistant/chat` -> valid response (provider or fallback)
- [ ] `GET /api/admin/export.csv` -> downloadable CSV

## Phase decisions

### Phase 1: 10% canary

Start time (UTC):

Observed metrics window (15-30 min):

- 5xx ratio:
- p95 latency:
- login/auth failures:
- assistant failures:

Decision:

- [ ] GO to 50%
- [ ] NO-GO (rollback)

Reason:

### Phase 2: 50%

Start time (UTC):

Observed metrics window:

- 5xx ratio:
- p95 latency:
- backup/admin actions check:

Decision:

- [ ] GO to 100%
- [ ] NO-GO (rollback)

Reason:

### Phase 3: 100%

Start time (UTC):

Observed metrics window:

- 5xx ratio:
- p95 latency:
- error budget impact:

Decision:

- [ ] STABLE
- [ ] ROLLBACK

Reason:

## Rollback checklist (if NO-GO)

- [ ] Switch upstream routing to Node
- [ ] Purge/expire edge API cache (if configured)
- [ ] Re-run smoke checks on Node routes
- [ ] Post incident note started with UTC timeline

## Final sign-off

- Final status: `GO` / `NO-GO`
- End time (UTC):
- Incident/record link:
- Follow-up actions:
