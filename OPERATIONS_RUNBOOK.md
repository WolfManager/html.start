# MAGNETO Operations Runbook

**Purpose:** Daily/weekly/monthly operational procedures for maintaining production systems.

---

## Daily Operations

### Morning Standup (Start of Day) — 5 min

```bash
# 1. Check for overnight alerts
./scripts/prod-monitor.sh --alerts

# 2. Review error logs
grep "ERROR\|CRITICAL" /var/log/magneto-*.log | tail -20

# 3. Check service health
curl -s http://localhost:3000/api/health | jq .
curl -s http://localhost:8000/api/health | jq .

# 4. Verify analytics are fresh
curl -s http://localhost:3000/api/admin/analytics/current | jq '.lastUpdate, .requestCount'
```

**If Issues Found:**

- Open [INCIDENT_RESPONSE_PLAYBOOK.md](INCIDENT_RESPONSE_PLAYBOOK.md)
- Find matching symptom in playbook
- Follow resolution steps

---

## Weekly Operations

### Weekly Review (Friday End of Day) — 30 min

#### 1. Review Metrics

```bash
# Get weekly trend data
curl -s "http://localhost:3000/api/admin/analytics?range=7d" \
  | jq '{weekly_requests: .summary.totalSearches, error_rate: .summary.errorRate, top_queries: .topQueries[0:5]}'
```

#### 2. Health Report

```bash
# Generate health summary
npm run health:check:gate:save --label="weekly-review"
```

#### 3. Check Backups

```bash
# Verify recent backups exist
ls -lah data/backups/ | head -10

# Count backups
ls data/backups/ | wc -l
```

#### 4. Database Status

```bash
# Check Django/database health
curl -s http://localhost:8000/api/admin/database-status | jq .
```

#### 5. Disk Usage

```bash
# Check available disk space
df -h /
du -sh data/

# If analytics.json growing too fast:
echo "Consider data migration to PostgreSQL"
```

**Action Items:**

- [ ] No critical alerts since last week
- [ ] Error rate stable (trend not increasing)
- [ ] Backups created regularly
- [ ] Disk space adequate (>10% free)
- [ ] Database accessible
- [ ] Team notified of any issues

---

## Monthly Operations

### Monthly Maintenance (First Friday) — 1 hour

#### 1. Data Archival

```bash
# Archive old analytics if using JSON approach
mkdir -p data/archive/$(date +%Y-%m)
cp data/analytics.json data/archive/$(date +%Y-%m)/analytics-$(date +%Y%m%d).json
```

#### 2. Backup Cleanup

```bash
# Keep only last 30 days of backups
find data/backups/ -mtime +30 -delete
ls data/backups/ | wc -l  # Should be reasonable number
```

#### 3. Log Rotation

```bash
# If logs are stored locally
find /var/log/magneto-* -mtime +30 -delete
du -sh /var/log/
```

#### 4. Performance Analysis

```bash
# Check if search index needs optimization
npm run search-benchmark
npm run search:parity:gate

# Check if database needs vacuum/analyze (if using PostgreSQL)
# Run Django management command if available:
# python manage.py dbshell
```

#### 5. Security Review

```bash
# Check for any suspicious patterns in logs
grep -i "failed\|attack\|unauthorized\|403\|401" /var/log/magneto-*.log | wc -l

# Review admin access logs
echo "Review admin login patterns in analytics"
```

#### 6. Capacity Planning

```bash
# Current disk usage trends
du -sh data/

# Estimated growth
echo "If growing at X GB/month, expect Y months before reaching disk limit"

# If approaching limit, plan:
# - Data migration to PostgreSQL
# - Archive strategy
# - Storage expansion
```

---

## Emergency Procedures

### Service Down

**Immediate Action:**

1. Confirm both services are down
2. Check if port is in use: `lsof -i :3000` and `lsof -i :8000`
3. Attempt restart:
   ```bash
   systemctl restart magneto-node magneto-django
   sleep 10
   ./scripts/post-deploy-verify.sh --quick
   ```

**If Restart Fails:**

- Check `/var/log/magneto-*.log` for errors
- Check disk space: `df -h /`
- Check memory: `free -h`
- Check if dependencies installed: `npm list` and `pip list`

**Escalation:** If not resolved in 5 min → Page on-call engineer

---

### High Error Rate

**Detection:**

```bash
./scripts/prod-monitor.sh --alerts
```

**Investigation:**

```bash
# Check recent logs for error pattern
tail -100 /var/log/magneto-node.log | grep ERROR

# Check if specific endpoint failing
npm run parity:critical:gate --require-admin

# Check database connection
curl -s http://localhost:8000/api/admin/database-status
```

**Resolution:**

- If database issue: Restart Django → `systemctl restart magneto-django`
- If search issue: Rebuild index → `npm run search:rebuild-index`
- If widespread: Reduce canary or rollback

---

### Memory Leak

**Detection:**

```bash
ps aux | grep -E 'node|python' | grep -v grep
# Look for growing RSS column over time
```

**Resolution:**

```bash
# Graceful restart (preferred)
systemctl restart magneto-node magneto-django

# Monitor memory after restart
for i in {1..10}; do
  ps aux | grep -E 'node|python' | grep -v grep
  sleep 60
done
```

---

## On-Call Preparation

### Before Your Shift

1. **Update Knowledge**

   ```bash
   git pull origin main
   npm install  # Ensure dependencies current
   ```

2. **Verify Tools Work**

   ```bash
   ./scripts/prod-monitor.sh --alerts      # Test monitoring
   npm run health:check:gate:all           # Test health gates
   ./scripts/post-deploy-verify.sh --quick # Test verification
   ```

3. **Review Playbooks**
   - Read [INCIDENT_RESPONSE_PLAYBOOK.md](INCIDENT_RESPONSE_PLAYBOOK.md)
   - Understand escalation contacts
   - Know Slack channel: #magneto-incidents

4. **Check Current State**

   ```bash
   ./scripts/prod-monitor.sh --alerts
   tail -50 /var/log/magneto-*.log
   ```

5. **Ensure Access**
   - [ ] SSH access to production
   - [ ] Admin credentials in .env
   - [ ] Dashboard access
   - [ ] Slack notifications enabled
   - [ ] PagerDuty push notifications enabled

### During Your Shift

**Every 2 Hours:**

```bash
./scripts/prod-monitor.sh --alerts
# Verify no CRITICAL or ALERT status
```

**Before Handing Off:**

- [ ] Current state stable
- [ ] No pending investigations
- [ ] Document handoff notes
- [ ] Verify next on-call person available
- [ ] Update status in Slack

---

## Monitoring Dashboard

### Real-Time Metrics

```bash
# Start live dashboard (runs continuously)
./scripts/prod-monitor.sh --dashboard
```

**Watch for:**

- Red "CRITICAL" indicators
- Yellow "ALERT" indicators
- Trending alerts (not just spikes)

### Alert Thresholds

| Metric       | CAUTION | ALERT  | CRITICAL |
| ------------ | ------- | ------ | -------- |
| Error Rate   | 0.5%    | 2%     | >5%      |
| Success Rate | <98%    | <95%   | <90%     |
| Latency P95  | 1500ms  | 2000ms | >3000ms  |
| Memory       | >70%    | >80%   | >90%     |
| Disk         | >70%    | >80%   | >90%     |
| Service Down | N/A     | N/A    | Critical |

---

## Useful Commands

### Health Checks

```bash
# Quick check
curl http://localhost:3000/api/health

# Detailed check with flags
npm run health:check:gate \
  --require-admin \
  --max-latency-ms=2000 \
  --save-report \
  --label="manual-check"
```

### Analytics Access

```bash
# Last 24 hours
curl "http://localhost:3000/api/admin/analytics?range=24h"

# Last 7 days
curl "http://localhost:3000/api/admin/analytics?range=7d"

# Specific date range
curl "http://localhost:3000/api/admin/analytics?range=custom&from=2026-03-01&to=2026-03-23"
```

### Troubleshooting

```bash
# Check service status or version
curl http://localhost:3000/api/health | jq .

# Get runtime metrics
curl "http://localhost:3000/api/admin/runtime-metrics"

# Check assistant provider status
curl "http://localhost:8000/api/admin/assistant-status" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"

# List recent errors
grep "ERROR\|error:" /var/log/magneto-*.log | tail -20
```

### Database Operations (if using PostgreSQL)

```bash
# Connect to database
export DATABASE_URL="postgresql://user:pass@host:5432/db"

# Quick health check
npm run db:health

# Run migrations
python manage.py migrate

# Backup database
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Restore database
psql $DATABASE_URL < backup-2026-03-23-120000.sql
```

---

## Knowledge Base

### Common Issues

**Issue: Search returning stale results**

- Solution: Rebuild index → `npm run search:rebuild-index`

**Issue: Assistant timeout**

- Solution: Check provider → `curl http://localhost:8000/api/admin/assistant-status`
- If provider down → Use fallback provider or disable assistant

**Issue: Admin access locked**

- Solution: `grep "LOCKOUT" /var/log/magneto-*.log`
- Reset: Wait for lockout window or restart service

**Issue: Disk getting full**

- Solution: Archive old analytics or delete old backups
- Plan: Migrate to PostgreSQL for better storage efficiency

---

## Shift Handoff Template

When handing off to next on-call person:

```
On-Call Handoff - [Date] [Time]

Outgoing: [Your Name]
Incoming: [Next Person Name]

Current Status:
- Services: UP / DOWN
- Error Rate: X%
- Latency: Xms
- Last Alert: [Time and description]

Active Issues:
- [Issue 1 - Status]
- [Issue 2 - Status]
- None currently

Recent Changes:
- [Change 1]
- [Change 2]

Pending:
- [Task 1 - if any ongoing investigation]

Key Contacts:
- Slack: @magneto-oncall
- PagerDuty: [link if needed]
- Tech Lead: [name]

Notes for Next Shift:
- [Any observations or warnings]

Dashboard URLs:
- Health: http://localhost:3000/api/health
- Analytics: http://localhost:3000/analytics-dashboard.html
- Monitoring: ./scripts/prod-monitor.sh --dashboard
```

---

## Further Reading

- [INCIDENT_RESPONSE_PLAYBOOK.md](INCIDENT_RESPONSE_PLAYBOOK.md) - Detailed incident procedures
- [PRODUCTION_OPERATIONS_GUIDE.md](PRODUCTION_OPERATIONS_GUIDE.md) - Deployment and monitoring
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Pre-deployment checklist
- [PRODUCTION_SETUP_RUNBOOK.md](PRODUCTION_SETUP_RUNBOOK.md) - Initial production setup

---

**Questions?** Reach out in `#magneto-incidents` or contact on-call tech lead.
