#!/bin/bash

# MAGNETO Emergency Rollback Script
# Immediately reverts to previous stable version
# Use when deployment has critical issues
#
# Usage:
#   ./scripts/emergency-rollback.sh [reason]

set -e

REASON="${1:-User initiated emergency rollback}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[⚠]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          MAGNETO EMERGENCY ROLLBACK INITIATED              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

log_warning "EMERGENCY ROLLBACK - This will revert to previous version"
log_warning "Reason: $REASON"
echo ""

# Require confirmation
read -p "Type 'ROLLBACK NOW' to confirm emergency rollback: " confirm
if [ "$confirm" != "ROLLBACK NOW" ]; then
  log_info "Rollback cancelled by user."
  exit 0
fi

echo ""
log_warning "INITIATING ROLLBACK SEQUENCE..."
echo ""

# Step 1: Set canary to 0% via API
log_info "Step 1: Setting canary traffic to 0% (reverting to previous version)..."
if [ -n "$DEPLOYMENTS_ADMIN_TOKEN" ]; then
  curl -s -X POST "http://127.0.0.1:8000/api/admin/routing" \
    -H "Authorization: Bearer ${DEPLOYMENTS_ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"canaryPercent\": 0,
      \"note\": \"EMERGENCY ROLLBACK: $REASON\"
    }" > /dev/null 2>&1 && log_success "Canary set to 0%" || log_warning "Could not update canary via API"
else
  log_warning "DEPLOYMENTS_ADMIN_TOKEN not set - skipping API routing update"
fi

# Step 2: Revert code
log_info "Step 2: Reverting code to previous commit..."
git_prev=$(git rev-parse HEAD~1)
git reset --hard "$git_prev"
log_success "Code reverted to: $git_prev"

# Step 3: Restart services
log_info "Step 3: Restarting services..."

if command -v systemctl &> /dev/null; then
  sudo systemctl restart magneto-node magneto-django 2>/dev/null && log_success "Services restarted" || log_warning "Could not restart via systemctl"
elif [ -f "$CURRENT_DIR/server.js" ]; then
  log_info "Manual restart required - no systemctl. Killing Node/Django processes..."
  pkill -f "node server.js" || true
  pkill -f "python manage.py" || true
  sleep 2
  log_info "Services stopped. Start them manually with:"
  echo "  npm start          # in $CURRENT_DIR"
  echo "  python manage.py runserver 8000  # in $CURRENT_DIR/backend-django"
fi

# Step 4: Verify health
log_info "Step 4: Verifying service health..."
sleep 3

node_health=$(curl -s http://127.0.0.1:3000/api/health 2>/dev/null | jq '.ok // false' 2>/dev/null)
django_health=$(curl -s http://127.0.0.1:8000/api/health 2>/dev/null | jq '.ok // false' 2>/dev/null)

if [ "$node_health" = "true" ] && [ "$django_health" = "true" ]; then
  log_success "Both services healthy"
else
  log_warning "Health check inconclusive - verify manually"
fi

# Step 5: Log the incident
log_info "Step 5: Logging rollback event..."
{
  echo "EMERGENCY ROLLBACK"
  echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Reason: $REASON"
  echo "Reverted to: $git_prev"
  echo "User: $(whoami)"
  echo ""
} >> "$CURRENT_DIR/ROLLBACK_LOG.txt"
log_success "Logged to ROLLBACK_LOG.txt"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║            ROLLBACK COMPLETE - VERIFY STATUS               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
log_success "Emergency rollback completed successfully"
echo ""
log_info "NEXT STEPS:"
echo "  1. Verify services are responding:"
echo "     curl http://localhost:3000/api/health"
echo "     curl http://localhost:8000/api/health"
echo ""
echo "  2. Check dashboards for anomalies:"
echo "     http://localhost:3000/analytics-dashboard.html"
echo ""
echo "  3. Review logs for root cause:"
echo "     tail -f /var/log/magneto-*.log"
echo ""
echo "  4. Notify team in Slack: #magneto-incidents"
echo ""
echo "  5. Schedule post-mortem review"
echo ""
