# MAGNETO Incident Response Playbook

## Overview

This playbook provides step-by-step procedures for responding to production incidents.

**Last Updated:** 2026-03-23
**Maintainer:** Engineering Team
**Escalation:** @magneto-oncall → Tech Lead → CTO

---

## Quick Reference

| Symptom                    | Severity | Response                    | Time To Action |
| -------------------------- | -------- | --------------------------- | -------------- |
| High error rate (>5%)      | CRITICAL | Invoke emergency rollback   | Immediate      |
| Slow search results (>2s)  | HIGH     | Check search index health   | 2 min          |
| Assistant unavailable      | HIGH     | Switch to fallback provider | 2 min          |
| Memory leak detected       | HIGH     | Restart services            | 5 min          |
| Database connection issues | CRITICAL | Switch to replica           | Immediate      |
| Monitoring gaps            | MEDIUM   | Check monitoring service    | 5 min          |

---

## Incident Classification

### CRITICAL

- Complete service outage
- Data loss or data corruption
- Security breach
- > 30% of users affected
- Search results returning errors
- **Response Time:** Immediate (0-2 min)
- **Escalate:** Yes, immediately

### HIGH

- Partial service degradation
- 10-30% of users affected
- Performance degradation >50%
- Canary pointing to bad deployment
- **Response Time:** 2-5 minutes
- **Escalate:** If not resolved in 5 min

### MEDIUM

- Minor features unavailable
- <10% of users affected
- API latency elevated but acceptable
- **Response Time:** 5-15 minutes
- **Monitor:** Continue observing

### LOW

- UI/UX issues
- Informational alerts
- Non-customer-impacting warnings
- **Response Time:** Next business day
- **Log:** For future improvement

---

## ON-CALL SETUP

### Before each shift:

1. Pull latest code: `git pull origin main`
2. Verify health gates pass: `npm run release:gate:all`
3. Test emergency rollback locally: `bash scripts/emergency-rollback.sh --dry-run` (if implemented)
4. Ensure PagerDuty is active
5. Join Slack #magneto-incidents channel

### Tools you need:

- GitHub access
- AWS console access (if using AWS for backups)
- Slack account (notifications)
- SSH access to production servers
- `.env` file with admin credentials

---

## Response Playbooks

### 1. HIGH ERROR RATE (>5%)

**Symptoms:**

- Dashboard shows spike in error rates
- User reports service failures
- Health check gates returning errors

**Diagnosis (2 min):**

```bash
# Check which endpoint is failing
curl http://localhost:3000/api/health
curl http://localhost:8000/api/health

# Check recent logs
tail -f /var/log/magneto-node.log
tail -f /var/log/magneto-django.log

# Run diagnostic script
npm run release:gate:all

# Check error rate in analytics
curl http://localhost:3000/api/admin/analytics/current
```

**Response:**

1. **If specific endpoint failing:** → Go to "Service-Specific Issues" below
2. **If widespread:** → Immediate emergency rollback
3. **If recent deployment:** → Check canary traffic; reduce if needed

**Resolution Steps:**

```bash
# Option 1: Reduce canary traffic to previous version
./scripts/canary-manage.sh 0

# Option 2: Emergency rollback if canary won't respond
bash scripts/emergency-rollback.sh "High error rate detected"

# Option 3: Restart affected service
systemctl restart magneto-node    # for Node errors
systemctl restart magneto-django  # for Django errors
```

**Verification:**

```bash
# Wait 2 minutes for services to stabilize
sleep 120

# Run health checks again
npm run release:gate:all

# Monitor error rate for 5 minutes
watch -n 5 'curl -s http://localhost:3000/api/admin/analytics/current | jq .errorRate'
```

**Escalation:** If error rate doesn't drop below 1% in 5 min → Page Tech Lead

---

### 2. SLOW SEARCH RESULTS (>2 sec)

**Symptoms:**

- Search latency high (check /api/health latency field)
- Users report slow searches
- Parity check shows latency degradation

**Diagnosis (2 min):**

```bash
# Check search index status
curl http://localhost:3000/api/admin/search-index/status

# Test search latency
time curl "http://localhost:3000/api/search?q=test"

# Check if index is loaded in memory
curl http://localhost:3000/api/admin/search-index/stats

# Review search memory usage
npm run search-benchmark
```

**Root Causes:**

- **Search index not loaded** → Rebuild index from disk
- **High query complexity** → Check for unusual search terms
- **Memory pressure** → Restart Node service
- **Database slow** → Check Django/PostgreSQL connection

**Resolution:**

```bash
# Option 1: Rebuild index (if corrupted or not loaded)
npm run search:rebuild-index

# Option 2: Restart Node service
systemctl restart magneto-node
sleep 30

# Option 3: Check database connection
curl http://localhost:8000/api/admin/database-status

# Option 4: Run full parity check
npm run parity:critical:gate
```

**Verification:**

```bash
# Test search latency is back to normal
npm run search-benchmark

# Confirm parity gate passes
npm run parity:critical:gate
```

**Escalation:** If latency still >2s → Contact DevOps for infrastructure issues

---

### 3. ASSISTANT UNAVAILABLE

**Symptoms:**

- Chat responses failing with 500
- Provider health check failing
- "Service unavailable" in logs

**Diagnosis (1 min):**

```bash
# Check assistant status
curl http://localhost:8000/api/admin/assistant-status

# Check provider health
curl http://localhost:8000/api/admin/providers-health

# Check recent assistant logs
tail -20 /var/log/magneto-django.log | grep -i assistant
```

**Root Causes:**

- **Provider API down** → Switch to fallback provider
- **Auth credentials stale** → Refresh API key
- **Memory limit reached** → Clear cache
- **Network issue** → Check connectivity

**Resolution:**

```bash
# Option 1: Switch to fallback provider (if configured)
curl -X POST http://localhost:8000/api/admin/provider-switch \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{"provider": "fallback"}'

# Option 2: Clear assistant cache
npm run admin:clear-cache

# Option 3: Restart Django service
systemctl restart magneto-django
sleep 30

# Option 4: Check and refresh credentials
# Edit .env with fresh API key, then:
systemctl restart magneto-django
```

**Verification:**

```bash
# Test assistant endpoint
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'

# Verify provider health
curl http://localhost:8000/api/admin/providers-health
```

**Fallback:** If provider down → Display "Chat temporarily unavailable" message to users

---

### 4. MEMORY LEAK / HIGH MEMORY USAGE

**Symptoms:**

- Process consuming >80% system RAM
- Services becoming unresponsive
- Out-of-memory (OOM) errors in logs

**Diagnosis (2 min):**

```bash
# Check process memory
ps aux | grep -E 'node|python|django'

# Monitor memory in real-time
watch -n 1 'ps aux | grep -E "node|django" | grep -v grep'

# Check system RAM
free -h

# Review for memory leaks in logs
grep -i "memory\|leak\|oom" /var/log/magneto-*.log
```

**Resolution:**

```bash
# Option 1: Graceful restart (preferred)
systemctl restart magneto-node
systemctl restart magneto-django
sleep 30

# Option 2: Kill specific process if unresponsive
pkill -9 -f "node server.js"
pkill -9 -f "python manage.py"

# Option 3: Clear application caches
npm run admin:clear-cache
curl -X POST http://localhost:8000/api/admin/cache-clear \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"

# Monitor memory after restart
sleep 120
watch -n 5 'ps aux | grep -E "node|django" | grep -v grep'
```

**Root Cause Investigation:**

```bash
# Check for known memory leak patterns
grep -r "setInterval\|setTimeout" src/ | grep -v clearInterval | head -20

# Check for unresolved promises
npm run test:memory-leak
```

**Escalation:** If memory leak persists after restart → Page DevOps/Backend Engineer

---

### 5. DATABASE CONNECTION ISSUES

**Symptoms:**

- "Connection refused" errors
- Analytics not updating
- Admin endpoints returning 500

**Diagnosis (1 min):**

```bash
# Test Django/PostgreSQL connection
curl http://localhost:8000/api/admin/database-status

# Check database logs (if available)
tail -50 /var/log/postgresql/postgresql.log 2>/dev/null || echo "PostgreSQL logs not accessible"

# Verify network connection to database
curl -v telnet://postgres-host:5432

# Check connection pooling
curl http://localhost:8000/api/admin/db-pool-status
```

**Resolution:**

```bash
# Option 1: Restart Django to reset connection pool
systemctl restart magneto-django
sleep 30

# Option 2: Check database server status
systemctl status postgresql  # or your database service

# Option 3: Verify .env has correct DATABASE_URL
echo $DATABASE_URL  # should show valid connection string

# Option 4: Increase connection pool timeout
# Edit .env: DATABASE_POOL_TIMEOUT=30000
# Then restart Django
```

**Verification:**

```bash
# Test database connection
curl http://localhost:8000/api/admin/database-status

# Verify analytics are updating
curl http://localhost:3000/api/admin/analytics/current | jq '.lastUpdate'
```

**Escalation:** If database server is down → Contact DBA / Infrastructure Team

---

## Post-Incident Procedures

### Immediately After Resolution:

1. **Verify Stability:** Monitor dashboards for 15 minutes, ensure metrics stable
2. **Document:** Note incident time, duration, impact, root cause, resolution
3. **Notify:** Update Slack #magneto-incidents with resolution status
4. **Check Rollbacks:** If emergency rollback used, verify no data loss

### Within 24 Hours:

1. **Review Logs:** Understand full incident timeline
2. **Identify Gaps:** What monitoring/alerting was missing?
3. **Schedule Review:** Arrange post-mortem with team
4. **Update Runbook:** Document new findings here

### Post-Mortem (48-72 hours):

1. **5 Whys:** Root cause analysis
2. **Action Items:** What prevents this next time?
3. **Timeline:** When do we implement fixes?
4. **Ownership:** Who is accountable for prevention?
5. **Share:** communicate learnings to team

---

## Monitoring & Alerting Setup

### Key Metrics to Monitor:

```
Health Check Endpoints:
  - Node health: http://localhost:3000/api/health
  - Django health: http://localhost:8000/api/health

Error Rates:
  - 5,1min × get error_rate (SLO: <1%)

Latency (p95):
  - search: <1 sec
  - assistant: <3 sec
  - admin endpoints: <500ms

Uptime:
  - Both services should be up 99.9% of time
```

### Alerting Thresholds:

```
CRITICAL:
  - Error rate >5% for 1+ minutes
  - Service unavailable (health returns false)
  - Response latency >5 sec for 2+ minutes

HIGH:
  - Error rate >2% for 5+ minutes
  - Memory usage >80% for 5+ minutes
  - Database connections saturated

MEDIUM:
  - Error rate >1% for 10+ minutes
  - Canary drift detected (mismatch between versions)
```

---

## Escalation Order

1. **Level 1 (On-Call Engineer):** Triage, apply standard playbooks, document
2. **Level 2 (Tech Lead):** If not resolved in 5 minutes, page Tech Lead
3. **Level 3 (CTO):** If not resolved in 15 minutes, notify CTO
4. **Level 4 (CEO):** If customer-facing outage >30 minutes, notify CEO

---

## Prevention Checklist

- [ ] Run health gates before every deployment
- [ ] Use canary deployment (don't go to 100% immediately)
- [ ] Monitor for 1 hour at each traffic level
- [ ] Keep emergency rollback script tested and working
- [ ] Have backup provider configured for assistant
- [ ] Keep database backups fresh (daily minimum)
- [ ] Monitor error rates continuously
- [ ] Have on-call person in Slack and responsive
- [ ] Test incident response monthly

---

## Related Documents

- [DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md) - Pre-deployment validation
- [scripts/emergency-rollback.sh](../scripts/emergency-rollback.sh) - Automated rollback tool
- [scripts/canary-manage.sh](../scripts/canary-manage.sh) - Traffic management
- Architecture docs in `docs/architecture/`

---

## Questions?

- Slack: @magneto-oncall or #magneto-incidents
- Email: engineering@magneto.io
- Escalation: Page on-call via PagerDuty
