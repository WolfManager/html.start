# Smoke Test Report — Etapa C

**Date:** 2026-03-27
**Release:** v1.0.0-rc-final
**Executed by:** Automated scripted checks + admin gate runner
**Session:** Go-Live Finalization Plan — Etapa C

---

## Summary

| Result | Count |
| ------ | ----- |
| PASS   | 9     |
| WARN   | 1     |
| FAIL   | 0     |

**Overall: PASS with 1 known WARN**

---

## Checklist

### 1. Startup — Application Boot

| Flow                  | Status | HTTP | Notes                     |
| --------------------- | ------ | ---- | ------------------------- |
| Node backend health   | PASS   | 200  | All health fields present |
| Django backend health | PASS   | 200  | All health fields present |

---

### 2. Search End-to-End

| Flow                              | Status | HTTP | Results Returned |
| --------------------------------- | ------ | ---- | ---------------- |
| Search via Node (`/api/search`)   | PASS   | 200  | 20               |
| Search via Django (`/api/search`) | PASS   | 200  | 17               |

Both backends return results. Minor result-count difference is expected (index parity within accepted tolerance).

---

### 3. Ranking

- Covered implicitly by search results returning non-empty, ordered lists.
- Parity gate (`npm run parity:critical:gate`) passed separately — see release gate below.

---

### 4. Admin Access

| Flow                                   | Status | HTTP | Notes             |
| -------------------------------------- | ------ | ---- | ----------------- |
| Admin login (`/api/auth/login`)        | PASS   | 200  | JWT token issued  |
| Admin overview (`/api/admin/overview`) | PASS   | 200  | With Bearer token |
| Unauthorized admin access              | PASS   | 401  | Properly rejected |

---

### 5. Analytics / Metrics

| Flow                                                 | Status | HTTP | Notes                      |
| ---------------------------------------------------- | ------ | ---- | -------------------------- |
| Public analytics (`/api/analytics/popular-searches`) | PASS   | 200  | Returns popular query data |
| Admin analytics via `/api/admin/overview`            | PASS   | 200  | Requires auth — passed     |

> Note: `/api/admin/analytics/current` does not exist as a standalone route.
> Analytics data is served through `/api/admin/overview` (verified PASS).

---

### 6. Gates / Restrictions

| Flow                       | Status | Details                 |
| -------------------------- | ------ | ----------------------- |
| Release gate (admin mode)  | PASS   | GO — 5/5 steps passed   |
| Unauthorized admin blocked | PASS   | Returns 401 as expected |

Release gate script output:

```
goNoGo: GO
stepsTotal: 5
stepsPassed: 5
stepsFailed: 0
```

---

### 7. Assistant — Fallback Mode

| Flow                                   | Status | HTTP | Notes                                |
| -------------------------------------- | ------ | ---- | ------------------------------------ |
| Assistant chat (`/api/assistant/chat`) | PASS   | 200  | `provider: fallback`, HTTP 200       |
| Response non-empty                     | PASS   | —    | Answer returned by rule-based engine |

---

### 8. Assistant — External Providers

| Flow                         | Status | Notes                                                   |
| ---------------------------- | ------ | ------------------------------------------------------- |
| External provider configured | WARN   | `configured: false` for all (openai, anthropic, gemini) |

**WARN — expected.** This is the formal decision from Etapa B: the system runs in local fallback mode. No providers are configured. This is **intentional and documented**.

To upgrade to full AI mode, see `PRODUCTION_OPERATIONS_GUIDE.md` → Section: "Assistant Operating Mode".

---

## Release Gate Reconfirmation

```
npm run release:gate:admin:json

Result: GO
Steps passed: 5/5
  - health:check:gate:all              OK
  - health:check:gate:all:admin        OK
  - parity:critical:gate               OK
  - parity:critical:gate:admin         OK
  - contract:validate:gate:admin       OK
```

---

## Conclusion

All critical functional flows passed smoke testing.
One known WARN (external AI providers not configured) is intentional and formally documented.
No FAILs detected.

**Etapa C: PASS**

---

_Next: Etapa D — Hardening audit (env, secrets, gitignore, sensitive file scan)_
