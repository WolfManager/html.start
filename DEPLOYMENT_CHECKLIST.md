# MAGNETO Search Engine - Pre-Deployment Checklist

**Date:** [Fill in]
**Version:** 9.95/10
**Deployer:** [Name]
**Reviewer:** [Name]
**Environment:** [staging/production]

---

## 1. CODE & TEST VALIDATION

### Repository State

- [ ] Latest code on `main` branch
- [ ] All uncommitted changes stashed or committed
- [ ] Git log shows expected commits
- [ ] No emergency hotfixes pending

### Automated Test Suite

- [ ] Unit tests passing: `npm run test` or `pytest`
- [ ] Integration tests passing
- [ ] Contract validation passing: `npm run contract:validate:gate`
- [ ] Search parity passing: `npm run search:parity:gate`
- [ ] Critical parity passing: `npm run parity:critical:gate`
- [ ] Release gate passing: `npm run release:gate:json`
- [ ] Health check gate passing: `npm run health:check:gate:all`

### Manual Validation

- [ ] Homepage loads without errors (browser console clean)
- [ ] Search works end-to-end (test query works)
- [ ] Results page displays correctly
- [ ] Admin dashboard accessible (login required)
- [ ] Analytics dashboard shows recent data
- [ ] Assistant responds to test messages

---

## 2. ENVIRONMENT & SECRETS

### Environment Variables

- [ ] `.env` file exists in root
- [ ] `.env` file exists in `backend-django/`
- [ ] All required vars set (check PRODUCTION_SETUP_RUNBOOK.md section 1)
- [ ] No secrets hardcoded in code
- [ ] Secrets not in git history
- [ ] `DJANGO_SECRET_KEY` is unique and strong (> 50 chars)
- [ ] `ADMIN_TOKEN_SECRET` is unique and strong
- [ ] API keys (OpenAI, Anthropic, etc.) are valid or intentionally empty

### Database & Data Files

- [ ] Database migrations ready: `python manage.py showmigrations`
- [ ] Search index file exists: `data/search-index.json`
- [ ] Analytics backup exists: `data/backups/analytics-*.json`
- [ ] Assistant memory file initialized: `data/assistant-memory.json`
- [ ] Data folder has appropriate permissions (readable by app)

### Static Assets & Config

- [ ] All HTML files present: `index.html`, `results.html`, `admin.html`
- [ ] All CSS files present: `styles.css`
- [ ] All JS files present: `script.js`, `server.js`
- [ ] Config files readable: `config.js`, `robots.txt`, `sitemap.xml`
- [ ] Image assets present if used (background images, etc.)

---

## 3. INFRASTRUCTURE & DEPENDENCIES

### Node.js Backend

- [ ] Node version matches requirements (v18+)
- [ ] `npm install` completes without errors
- [ ] All dependencies listed in `package.json`
- [ ] No audit vulnerabilities blocking deployment: `npm audit`
- [ ] Server starts: `npm start`
- [ ] Health endpoint responds: `curl http://localhost:3000/api/health`

### Django Backend

- [ ] Python version matches requirements (3.11+)
- [ ] `pip install -r requirements.txt` completes
- [ ] All dependencies listed in `requirements.txt`
- [ ] Database migrations apply cleanly: `python manage.py migrate --dry-run`
- [ ] Django app loads: `python manage.py check`
- [ ] Health endpoint responds: `curl http://localhost:8000/api/health`

### Port Availability

- [ ] Port 3000 available (Node.js)
- [ ] Port 8000 available (Django)
- [ ] If using different ports, ENV vars updated
- [ ] Firewall rules allow expected traffic

---

## 4. MONITORING & OBSERVABILITY

### Monitoring Infrastructure

- [ ] Monitoring service account created
- [ ] API keys for monitoring generated and stored
- [ ] Logging backend configured (Sentry/CloudWatch/etc.)
- [ ] Alert channels configured (email/Slack/PagerDuty)
- [ ] Dashboards created and shared with team
- [ ] On-call rotation active
- [ ] Runbook links in on-call tools updated

### Logging Configuration

- [ ] Log level set to INFO (not DEBUG in production)
- [ ] Log output is structured (JSON format preferred)
- [ ] Sensitive data not logged (passwords, tokens)
- [ ] Log retention policy defined
- [ ] Log aggregation running

### Metrics & KPIs

- [ ] Baseline metrics captured (pre-deployment)
- [ ] NDCG@5 baseline: **\_**
- [ ] P95 latency baseline: **\_** ms
- [ ] Error rate baseline: **\_**%
- [ ] Success rate baseline: **\_**%
- [ ] Uptime target: **\_**

---

## 5. BACKUP & ROLLBACK

### Backup Procedures

- [ ] Full database backup created and tested
- [ ] Backup location: ****\*\*\*\*****\_****\*\*\*\*****
- [ ] Backup integrity verified: `pg_restore --list <backup.sql>`
- [ ] Data files backed up: `search-index.json`, `analytics.json`
- [ ] Previous version code tagged: `git tag v-pre-<date>`
- [ ] Rollback script exists and tested: `scripts/rollback.sh`

### Rollback Steps Validated

- [ ] Rollback to previous code version: tested
- [ ] Rollback to previous database state: tested
- [ ] Rollback health checks: tested
- [ ] Estimated rollback time: **\_** minutes
- [ ] Rollback decision criteria defined

---

## 6. TEAM & COMMUNICATION

### Team Readiness

- [ ] On-call engineer notified
- [ ] All team members briefed on changes
- [ ] Communication channels ready (Slack, email, PagerDuty)
- [ ] Incident response plan reviewed
- [ ] Escalation contacts confirmed: see PRODUCTION_SETUP_RUNBOOK.md section "Contact & Escalation"

### Stakeholder Notification

- [ ] Product team notified of deployment window
- [ ] Support team briefed
- [ ] Status page prepared with update message
- [ ] Post-deployment communication plan ready

### Documentation

- [ ] Release notes prepared
- [ ] Deployment notes in this checklist
- [ ] Known issues documented
- [ ] Post-deployment QA steps documented

---

## 7. EXECUTION

### Pre-Deployment (30 min before)

- [ ] Notify team in Slack: "Deployment starting in 30 minutes"
- [ ] Do final health check: `npm run release:gate:json`
- [ ] Verify all checklist items complete
- [ ] Clear all terminals, ensure clean state

### Deployment (Execute in Order)

#### 1. Code Deployment

- [ ] Pull latest code: `git fetch origin && git pull`
- [ ] Install dependencies: `npm install && pip install -r requirements.txt`
- [ ] Run migrations: `python manage.py migrate`
- [ ] Collect static files: `python manage.py collectstatic --no-input`
- [ ] Start service: `npm start` (Node) + `python manage.py runserver` (Django)

#### 2. Immediate Health Checks

```bash
# Node health
curl -f http://localhost:3000/api/health

# Django health
curl -f http://localhost:8000/api/health

# Parity check
npm run parity:critical:gate
```

If any fail, STOP and rollback immediately.

- [ ] Node health: ✅ / ❌
- [ ] Django health: ✅ / ❌
- [ ] Parity check: ✅ / ❌

#### 3. Canary Traffic (5%)

- [ ] Update routing to 5% canary: `scripts/canary-5.sh`
- [ ] Monitor metrics for 1 hour (see Monitoring section)
- [ ] No critical errors during canary

#### 4. Gradual Rollout

- [ ] 10% after 1h (if healthy): `scripts/canary-10.sh`
- [ ] 25% after 2h (if healthy): `scripts/canary-25.sh`
- [ ] 50% after 3h (if healthy): `scripts/canary-50.sh`
- [ ] 100% when ready: `scripts/canary-100.sh`

#### 5. Final Validation

- [ ] 100% production traffic confirms stable
- [ ] No error rate spike
- [ ] Latency within expected range
- [ ] NDCG maintained or improved

### Post-Deployment (After Rollout Complete)

- [ ] [ ] Document deployment completion time
- [ ] [ ] Update deployment log
- [ ] [ ] Notify team of successful deployment
- [ ] [ ] Schedule post-deployment review (24h)
- [ ] [ ] Monitor metrics for 24 hours before declaring success

---

## 8. NOTES & OBSERVATIONS

### Pre-Deployment Notes

```
[Space for any relevant notes, concerns, or special considerations]
```

### Issues Encountered

```
[Document any issues, how they were resolved, duration of resolution]
```

### Post-Deployment Observations

```
[Document actual performance vs baseline, user feedback, etc.]
```

---

## 9. SIGN-OFF

**Deployed By:** ******\_****** Date: \_**\_/\_\_**/\_\_\_\_

**Reviewed By:** ******\_****** Date: \_**\_/\_\_**/\_\_\_\_

**Approved By:** ******\_****** Date: \_**\_/\_\_**/\_\_\_\_

**Rollback Authorized By:** ******\_****** Date: \_**\_/\_\_**/\_\_\_\_ (if needed)

---

## 10. EMERGENCY PROCEDURES & SUPPORT

### Incident During Deployment

If you encounter issues during deployment:

1. **Check Incident Response Playbook:** [INCIDENT_RESPONSE_PLAYBOOK.md](INCIDENT_RESPONSE_PLAYBOOK.md)
   - High error rate: See "High Error Rate (>5%)" section
   - Slow performance: See "Slow Search Results (>2 sec)" section
   - Service unavailable: See corresponding section in playbook

2. **Emergency Rollback (Immediate):**

   ```bash
   # This immediately reverts to previous version
   bash scripts/emergency-rollback.sh "Reason for rollback"
   ```

3. **Gradual Traffic Reduction (Safer):**

   ```bash
   # Reduce canary traffic gradually
   ./scripts/canary-manage.sh 5     # Go back to 5%
   ./scripts/canary-manage.sh 0     # Revert to previous version
   ```

4. **Escalation Contacts:**
   - On-Call Engineer: Start here (Slack: @magneto-oncall)
   - Tech Lead: If not resolved in 5 minutes
   - CTO: If not resolved in 15 minutes

### Important Files & Tools

- **Emergency Rollback:** [scripts/emergency-rollback.sh](scripts/emergency-rollback.sh)
- **Canary Traffic Control:** [scripts/canary-manage.sh](scripts/canary-manage.sh)
- **Incident Response:** [INCIDENT_RESPONSE_PLAYBOOK.md](INCIDENT_RESPONSE_PLAYBOOK.md)
- **Production Setup:** [PRODUCTION_SETUP_RUNBOOK.md](PRODUCTION_SETUP_RUNBOOK.md)
- **Search Parity:** [scripts/critical-parity-check.js](scripts/critical-parity-check.js)

### Health Monitoring During Deployment

Monitor these metrics in real-time:

```bash
# Watch Node health
watch -n 5 'curl -s http://localhost:3000/api/health | jq .'

# Watch Django health
watch -n 5 'curl -s http://localhost:8000/api/health | jq .'

# Watch current analytics (errors, latency, success rate)
watch -n 10 'curl -s http://localhost:3000/api/admin/analytics/current | jq "{errorRate, p95Latency, successRate}"'
```

### Key Thresholds Before Escalation

| Metric       | CAUTION (Monitor) | ALERT (Investigate) | CRITICAL (Rollback) |
| ------------ | ----------------- | ------------------- | ------------------- |
| Error Rate   | 0.5%              | 2%                  | >5%                 |
| P95 Latency  | 1.5s              | 2.0s                | >3s                 |
| Success Rate | 98%               | 95%                 | <90%                |
| Memory Usage | 70%               | 80%                 | 90%+                |
| CPU Usage    | 70%               | 80%                 | 90%+                |

---

_Last Updated: 2026-03-23 | Next Review: [After first production deployment]_
