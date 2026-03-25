# MAGNETO Production Deployment & Operations Infrastructure

**Version:** 2.0
**Status:** Production Ready
**Last Updated:** 2026-03-23

## Overview

This document describes the complete production deployment and operations infrastructure for MAGNETO search engine. It provides a systematic approach to deploying code changes, monitoring system health, and responding to incidents.

---

## Deployment Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                     CODE CHANGES READY                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Pre-Deployment Validation (MUST PASS ALL)            │
│  • npm run release:gate:json                                 │
│  • npm run health:check:gate:all                             │
│  • npm run parity:critical:gate                              │
│  • npm run contract:validate:gate:admin                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                  All tests pass?
                   /          \
                 YES            NO
                  │              │
                  │         Fix issues & retry
                  │
                  ▼
┌──────────────────────────────────────────────────┐
│    Complete DEPLOYMENT_CHECKLIST.md              │
│  • Code validation (DONE)                        │
│  • Environment/secrets checklist                 │
│  • Infrastructure readiness                      │
│  • Monitoring/alerting ready                     │
│  • Backup/rollback tested                        │
│  • Team notification ready                       │
│  • Get team sign-off                             │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│      Start Canary Deployment (5%)                 │
│  • ./scripts/canary-manage.sh 5                  │
│  • New version: 5% traffic, Previous: 95%        │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
     ┌─────────────────────────────┐
     │   Monitor for 1 hour @5%     │
     │  ./scripts/prod-monitor.sh   │
     │    Error Rate: <0.5%         │
     │    Latency: <2000ms          │
     │    Success: >99%             │
     └────────────┬────────────────┘
                  │
            Healthy?
           /       \
          NO        YES
          │          │
     Rollback    Continue to
     & Investigate  next stage
          │
          ▼
    ./scripts/emergency-rollback.sh
          │
          └──→ [Incident Response Playbook]

                        ▼
                [Repeat at each stage]
                10% (1h) → 25% (2h)
                → 50% (2h) → 100%

                        ▼
            ┌──────────────────────────┐
            │  100% Production Traffic   │
            │   (New Version Active)     │
            │ ./scripts/post-deploy-verify.sh
            │  --full                   │
            └────────────┬──────────────┘
                         │
                    Success?
                   /          \
                 YES            NO → Emergency Rollback
                  │
                  ▼
          ┌─────────────────────┐
          │  Monitor 24+ hours   │
          │  continuously        │
          │  Watch for:          │
          │  • Error spikes      │
          │  • Latency drift     │
          │  • Memory leaks      │
          └────────────┬────────┘
                       │
                       ▼
          ┌─────────────────────┐
          │ Declare Successful   │
          │ Update documentation │
          │ Schedule post-mortem │
          └─────────────────────┘
```

---

## Tools Reference

### 1. Pre-Deployment Validation

**Command:** `npm run release:gate:json` and related gates

**Tests:**

- ✅ Code compiles without errors
- ✅ Unit/integration tests pass
- ✅ API contracts valid (contract validation)
- ✅ Search parity between Node/Django confirmed
- ✅ Critical functionality tests passing
- ✅ Health checks passing on both services

**What to do if failing:**

- Fix code issues identified
- Ensure `.env` files properly configured
- Run gates individually to identify specific failure
- Resolve issues and retry

---

### 2. Deployment Checklist

**Location:** [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)

**Sections:**

1. Code & Test Validation
2. Environment & Secrets
3. Infrastructure & Dependencies
4. Monitoring & Observability
5. Backup & Rollback
6. Team & Communication
7. Execution Steps
8. Notes & Observations
9. Sign-off & Approval

**How to use:**

1. Print this checklist (or open in editor)
2. Fill in each section as you prepare
3. Get team sign-offs before proceeding
4. Keep as deployment record
5. Archive for post-mortem review

---

### 3. Canary Traffic Management

**Location:** [scripts/canary-manage.sh](scripts/canary-manage.sh)

**Commands:**

```bash
# Check current canary status
./scripts/canary-manage.sh check

# Set canary to X% (example: 5%)
./scripts/canary-manage.sh 5

# Rollback to previous version (0%)
./scripts/canary-manage.sh 0
```

**Recommended Progression:**

- **5%** for 1 hour → Watch error rate, latency, success
- **10%** for 1 hour → Increase confidence level
- **25%** for 2 hours → Broader user sample
- **50%** for 2 hours → Significant traffic volume
- **100%** when ready → Full production traffic

**At Each Stage:**

- Monitor with `./scripts/prod-monitor.sh`
- Check alerts with `./scripts/prod-monitor.sh --alerts`
- If issues: `./scripts/canary-manage.sh 0` to rollback
- If severe: `bash scripts/emergency-rollback.sh`

---

### 4. Continuous Monitoring

**Location:** [scripts/prod-monitor.sh](scripts/prod-monitor.sh)

**Modes:**

```bash
# Live dashboard (10-second refresh)
./scripts/prod-monitor.sh --dashboard

# Show active alerts
./scripts/prod-monitor.sh --alerts

# Capture baseline metrics
./scripts/prod-monitor.sh --baseline
```

Windows operator note:

- Run the monitor script from Git Bash.
- Run Node/NPM commands from PowerShell with `npm.cmd` when `npm` is blocked by execution policy.
- Keep `.env` and `backend-django/.env` local only; they are excluded from git and should never be committed.

**Key Metrics Monitored:**

- Service availability (Node, Django)
- Error rate (target: <1%)
- Success rate (target: >99%)
- Latency P95 (target: <2000ms)
- Memory usage (caution >70%, alert >80%, critical >90%)
- Disk usage (caution >70%, alert >80%, critical >90%)
- CPU usage (caution >70%, alert >80%, critical >95%)

**Alert Thresholds:**

| Metric       | Caution | Alert  | Critical | Action               |
| ------------ | ------- | ------ | -------- | -------------------- |
| Error Rate   | 0.5%    | 2%     | >5%      | Investigate/Rollback |
| Latency P95  | 1500ms  | 2000ms | >3000ms  | Investigate/Rollback |
| Success Rate | <98%    | <95%   | <90%     | Investigate/Rollback |
| Memory       | >70%    | >80%   | >90%     | Restart services     |
| Disk         | >70%    | >80%   | >90%     | Cleanup/Add storage  |

---

### 5. Post-Deployment Verification

**Location:** [scripts/post-deploy-verify.sh](scripts/post-deploy-verify.sh)

**Usage:**

```bash
# Quick verification (core services)
./scripts/post-deploy-verify.sh --quick

# Full comprehensive verification
./scripts/post-deploy-verify.sh --full

# Cleanup temporary files
./scripts/post-deploy-verify.sh --cleanup
```

**What It Checks:**

- Both services responding (Node, Django)
- Health metrics passing
- Analytics collecting data
- Database connectivity
- Search parity confirmed
- Contract validation passed
- Canary status shown
- Performance baseline established
- Error logs reviewed

**Output:**

- Summary of pass/fail/warn states
- Specific error details
- Actionable next steps
- Links to incident playbook if issues found

---

### 6. Incident Response

**Location:** [INCIDENT_RESPONSE_PLAYBOOK.md](INCIDENT_RESPONSE_PLAYBOOK.md)

**Quick Reference for Common Issues:**

| Issue                 | Command                              | Playbook Section        |
| --------------------- | ------------------------------------ | ----------------------- |
| High Error Rate (>5%) | `bash scripts/emergency-rollback.sh` | "High Error Rate"       |
| Slow Search (>2s)     | Review search index status           | "Slow Search Results"   |
| Assistant Unavailable | Switch provider or restart           | "Assistant Unavailable" |
| Memory Leak           | Restart services                     | "Memory Leak"           |
| Database Issues       | Check connection pool                | "Database Connection"   |

**Escalation Contacts:**

- Level 1: On-Call Engineer (fix via playbook)
- Level 2: Tech Lead (if >5 min unresolved)
- Level 3: CTO (if >15 min unresolved)
- Level 4: CEO (if >30 min outage)

---

### 7. Emergency Rollback

**Location:** [scripts/emergency-rollback.sh](scripts/emergency-rollback.sh)

**DANGER: Use only for critical issues**

```bash
# Immediate revert to previous version
bash scripts/emergency-rollback.sh "Reason for rollback"
```

**What It Does:**

1. Confirms you want to rollback (requires: "ROLLBACK NOW")
2. Sets canary traffic to 0% (traffic reverts to previous)
3. Reverts code to previous commit
4. Restarts services
5. Verifies health checks pass
6. Logs the incident for review

**When to Use:**

- ✅ Error rate >5% for >2 minutes
- ✅ Service completely unavailable
- ✅ Data corruption detected
- ✅ Critical security issue
- ❌ Minor issues (use canary reduction first)

**After Rollback:**

1. Wait 2 minutes for stability
2. Monitor dashboard for 10 minutes
3. Document issue in ROLLBACK_LOG.txt
4. Notify team in Slack #magneto-incidents
5. Schedule immediate post-mortem

---

## Complete Deployment Checklist Summary

Before you deploy, ensure:

- [ ] **Pass all gates:**
  - `npm run release:gate:json`
  - `npm run health:check:gate:all`
  - `npm run parity:critical:gate`
  - `npm run contract:validate:gate:admin`

- [ ] **Complete DEPLOYMENT_CHECKLIST.md sections 1-6:**
  - Code & Tests
  - Environment & Secrets
  - Infrastructure
  - Monitoring
  - Backup & Rollback
  - Team Communication

- [ ] **Rotate secrets before shared deployment:**
  - `ADMIN_USER`
  - `ADMIN_PASSWORD`
  - `JWT_SECRET`
  - `DJANGO_SECRET_KEY`

- [ ] **Get approvals:** Ensure sign-offs from tech lead and on-call

- [ ] **Notify team:** Post in Slack 30 minutes before

- [ ] **Execute deployment:**
  - Pull latest code
  - Install dependencies
  - Run migrations
  - Start services
  - Begin canary at 5%

- [ ] **Monitor:** Use prod-monitor.sh at each canary stage

- [ ] **Verify:** Run post-deploy-verify.sh --full after 100%

- [ ] **Document:** Record completion, duration, issues, outcomes

- [ ] **Monitor 24h:** Continue monitoring dashboards for 1 day

---

## System Thresholds & Defaults

### Error Rate

- **Healthy:** <0.5%
- **Caution:** 0.5-2%
- **Alert:** 2-5%
- **Critical (Rollback):** >5%

### Response Latency (P95)

- **Healthy:** <1000ms
- **Caution:** 1000-1500ms
- **Alert:** 1500-2000ms
- **Critical (Rollback):** >3000ms

### Success Rate

- **Healthy:** >99%
- **Caution:** 98-99%
- **Alert:** 95-98%
- **Critical:** <90%

### Service Availability

- **Healthy:** 100%
- **Acceptable:** 99.5%
- **Alert:** 99-99.5%
- **Critical:** <99%

---

## Operational procedures

### Daily Checks (Start of Day)

1. Review overnight alerts: `./scripts/prod-monitor.sh --alerts`
2. Check error logs for issues
3. Verify all services healthy
4. Note any anomalies in team standup

### During Deployment (Active Monitoring)

1. Have prod-monitor.sh running in separate terminal
2. Check alert status every 5-10 minutes
3. Have incident playbook open
4. Stay in Slack #magneto-incidents channel

### After Deployment (24-hour Period)

1. Monitor dashboard continuously for first 4 hours
2. Check periodically (every 1-2 hours) for 24 hours
3. Watch for delayed issues (memory leaks, etc.)
4. Document any new behaviors observed

### Post-Deployment Review (24-72 hours)

1. Archive deployment checklist
2. Review logs for errors/warnings
3. Analyze metrics: any trends?
4. Schedule 15-minute post-mortem
5. Discuss improvements for next deployment

---

## Files Reference

```
Root/
├── DEPLOYMENT_CHECKLIST.md           ← Use this DURING deployment
├── INCIDENT_RESPONSE_PLAYBOOK.md     ← Use this for issues
├── PRODUCTION_OPERATIONS_GUIDE.md    ← You are here
│
└── scripts/
    ├── canary-manage.sh              ← Control traffic %
    ├── post-deploy-verify.sh         ← Verify after deploy
    ├── prod-monitor.sh               ← Monitor real-time
    ├── emergency-rollback.sh          ← EMERGENCY ONLY
    ├── critical-parity-check.js       ← Pre-deploy validation
    ├── contract-validation.js         ← API contract checks
    └── health-check.js                ← Service health
```

---

## Key Contacts & Escalation

| Level | Role             | Method                | Response Time |
| ----- | ---------------- | --------------------- | ------------- |
| 1     | On-Call Engineer | Slack @magneto-oncall | Immediate     |
| 2     | Tech Lead        | Page PagerDuty        | <5 min        |
| 3     | CTO              | Page PagerDuty        | <15 min       |
| 4     | CEO              | Phone Call            | <30 min       |

---

## Success Criteria

A deployment is considered **successful** when:

1. ✅ All health gates pass before deployment
2. ✅ All canary stages complete without issues
3. ✅ Error rate remains <1% at 100% traffic
4. ✅ Latency P95 remains <2000ms
5. ✅ No database corruption detected
6. ✅ No memory leaks from cold boot
7. ✅ Analytics continue collecting data
8. ✅ Admin endpoints accessible
9. ✅ Search results accurate
10. ✅ No security alerts triggered

---

## What Can Go Wrong & How to Handle

| Scenario          | Symptoms            | Response                                 | Reference    |
| ----------------- | ------------------- | ---------------------------------------- | ------------ |
| Bad code deployed | Errors at 5% canary | Reduce to 0% with canary-manage.sh       | Canary Mgmt  |
| Critical issue    | Errors >5%          | Run emergency-rollback.sh                | Emergency RB |
| Performance issue | Latency spikes      | Check latency playbook or reduce traffic | Playbook     |
| Database down     | Connection errors   | Switch to replica or restart Django      | Playbook     |
| Memory leak       | Growing memory use  | Restart services, investigate code       | Playbook     |

---

## Future Improvements

- [ ] Automated canary management (AI-driven traffic shifts)
- [ ] Automated rollback on error threshold breach
- [ ] Cross-region failover capability
- [ ] Blue-green deployment support
- [ ] Feature flag integration
- [ ] A/B testing framework
- [ ] Progressive rollout with custom metrics
- [ ] Self-healing capabilities

---

## Related Documentation

- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Before you deploy
- [INCIDENT_RESPONSE_PLAYBOOK.md](INCIDENT_RESPONSE_PLAYBOOK.md) - During issues
- [PRODUCTION_SETUP_RUNBOOK.md](PRODUCTION_SETUP_RUNBOOK.md) - Initial setup
- [Architecture Documentation](docs/architecture/) - System design

---

**Questions?** Reach out in `#magneto-incidents` Slack channel.
