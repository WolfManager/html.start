# Stable Baseline — 2026-03-28

Status: Official reference baseline for project closure work
Baseline commit: `c8ef790`
Scope: MAGNETO web search + AI chatbot, validated in local full-stack mode

## Purpose

This document freezes the current stable version of MAGNETO so all further work can be measured against a single known-good reference.

Use this baseline before any change to:

- search ranking behavior
- assistant fallback behavior
- UX/runtime messaging
- release gates or contract validation
- configuration precedence

## Frozen Stable Components

### 1. Architecture

- Dual-backend architecture is active and validated:
  - Node web/backend on port `3000`
  - Django backend on port `8000`
- Frontend remains static-first with backend-driven APIs.
- Current key runtime surfaces:
  - homepage: `index.html`
  - results page: `results.html`
  - admin dashboard: `admin.html`
- Search, assistant, analytics, health, and admin flows are operational in the current layout.

### 2. Search Pipeline

- Search endpoint is stable on both backends.
- Tier 4 ranking work is part of the current baseline.
- Long-tail zero-result refinement is included.
- Node and Django parity gates currently pass in the validated local full-stack setup.

Current stable search properties:

- non-empty ranked results on critical benchmark flows
- accepted Node/Django parity behavior
- benchmark and gate scripts available for regression comparison

### 3. Assistant Runtime

- Official assistant mode: local fallback
- External providers remain optional extensions, not required for current stable operation.
- Fallback replies were recently improved for:
  - Romanian small talk
  - more natural conversational phrasing
  - predictable non-empty responses
- Assistant runtime transparency is now part of baseline UX:
  - visible assistant runtime state on homepage
  - API base source surfaced in UI
  - fallback/live/ready state surfaced consistently

### 4. Configuration Precedence

Validated frontend API base precedence:

1. `?apiBase=...`
2. `localStorage.MAGNETO_API_BASE_URL`
3. safe default

Validated safety behavior:

- explicit URL override persists for reload stability
- stale localhost override is cleared on non-local hosts
- runtime helpers exist:
  - `window.setMagnetoApiBase(...)`
  - `window.resetMagnetoApiBase()`

### 5. Validated Gates

The following are part of the frozen stable baseline and are expected to remain green:

- `npm.cmd run health:check:gate:all`
- `npm.cmd run release:gate:json`
- `npm.cmd run release:gate:admin:json`
- `npm.cmd run contract:validate:gate`
- `npm.cmd run contract:validate:gate:admin`
- `npm.cmd run smoke:local:regression`
- `npm run parity:critical:gate`
- `npm run parity:critical:gate:admin`

## Latest Validated Outcome

As of this baseline:

- full-stack local health gate: GO
- public release gate: GO
- admin release gate: GO
- local regression smoke: PASS
- assistant fallback mode: operational and documented

## Reference Evidence

- [GO_NO_GO_REPORT.md](GO_NO_GO_REPORT.md)
- [SMOKE_TEST_REPORT.md](SMOKE_TEST_REPORT.md)
- [PRODUCTION_OPERATIONS_GUIDE.md](PRODUCTION_OPERATIONS_GUIDE.md)
- [README.md](README.md)

## Change Control Rules From This Point

Any optimization after this baseline should be evaluated against the following questions:

1. Does it preserve current gate status?
2. Does it improve measurable search or assistant behavior?
3. Does it avoid reintroducing configuration ambiguity?
4. Does it preserve current fallback stability?
5. Does it keep Node + Django behavior within accepted parity bounds?

If the answer is unclear, compare against this baseline before merging.

## Baseline Commands

Use these commands as the minimum comparison set:

```powershell
npm.cmd run smoke:local:regression
npm.cmd run health:check:gate:all
npm.cmd run release:gate:json
npm.cmd run release:gate:admin:json
```

## Baseline Scope Boundary

This baseline does not claim:

- final perfection of search relevance
- final chatbot product behavior
- fully closed UX polish
- final documentation completeness

It establishes the stable version that future work must not regress.
