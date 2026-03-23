#!/bin/bash

# MAGNETO Canary Deployment Manager
# Gradually shift traffic to new version with rollback capability
#
# Usage:
#   ./scripts/canary-manage.sh 5      # Set to 5% canary traffic
#   ./scripts/canary-manage.sh 100    # Full rollout (100%)
#   ./scripts/canary-manage.sh check  # Check current canary status
#   ./scripts/canary-manage.sh rollback  # Rollback to 0% (previous version)

set -e

CANARY_PERCENT="${1:-check}"
API_BASE="${MAGNETO_API_BASE:-http://127.0.0.1:8000}"
ADMIN_TOKEN="${DEPLOYMENTS_ADMIN_TOKEN:-}"

if [ -z "$ADMIN_TOKEN" ]; then
  echo "ERROR: DEPLOYMENTS_ADMIN_TOKEN not set. Cannot proceed."
  echo "Set via: export DEPLOYMENTS_ADMIN_TOKEN=<your-admin-token>"
  exit 1
fi

# Color output helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[⚠]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

# Check current routing status
check_canary_status() {
  log_info "Checking current canary status..."

  response=$(curl -s -X GET "${API_BASE}/api/admin/routing" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json")

  if [ $? -ne 0 ]; then
    log_error "Failed to fetch routing status. Is API running?"
    exit 1
  fi

  echo "$response" | jq . 2>/dev/null || echo "$response"
}

# Update canary percentage
set_canary_percent() {
  local percent="$1"

  if ! [[ "$percent" =~ ^[0-9]+$ ]] || [ "$percent" -lt 0 ] || [ "$percent" -gt 100 ]; then
    log_error "Invalid percentage: $percent. Must be 0-100."
    exit 1
  fi

  log_info "Setting canary traffic to ${percent}%..."

  local note="Canary deployment: ${percent}% traffic to new version"
  if [ "$percent" -eq 0 ]; then
    note="Rollback: 0% canary (full revert to previous version)"
  elif [ "$percent" -eq 100 ]; then
    note="Full production rollout: 100% traffic to new version"
  fi

  response=$(curl -s -X POST "${API_BASE}/api/admin/routing" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"canaryPercent\": ${percent},
      \"note\": \"${note}\"
    }")

  if [ $? -ne 0 ]; then
    log_error "Failed to update canary percentage."
    exit 1
  fi

  canary=$(echo "$response" | jq -r '.canaryPercent // "unknown"' 2>/dev/null)
  updated_at=$(echo "$response" | jq -r '.updatedAt // "unknown"' 2>/dev/null)

  if [ "$canary" = "$percent" ]; then
    log_success "Canary traffic set to ${percent}% (updated at ${updated_at})"
  else
    log_warning "Response: $response"
    log_warning "Expected canary ${percent}%, got ${canary}"
  fi
}

# Health check after canary update
verify_health_after_canary() {
  local percent="$1"

  log_info "Verifying health after canary update to ${percent}%..."

  # Quick health endpoint check
  node_health=$(curl -s -f -X GET "http://127.0.0.1:3000/api/health" 2>&1 | jq '.ok // false')
  django_health=$(curl -s -f -X GET "http://127.0.0.1:8000/api/health" 2>&1 | jq '.ok // false')

  if [ "$node_health" = "true" ] && [ "$django_health" = "true" ]; then
    log_success "Both services healthy (Node and Django responding)"
  else
    log_warning "Node health: $node_health, Django health: $django_health"
  fi

  # Suggest monitoring steps
  echo ""
  log_info "Next steps:"
  echo "  1. Monitor dashboards:"
  echo "     - Analytics: http://localhost:3000/analytics-dashboard.html"
  echo "     - LTR Monitor: http://localhost:3000/admin-ltr-monitor.html"
  echo ""
  echo "  2. Watch for:"
  echo "     - Error rate (target < 0.1%)"
  echo "     - P95 latency (target < 250ms)"
  echo "     - NDCG@5 (baseline should not drop)"
  echo ""
  if [ "$percent" -lt 100 ]; then
    echo "  3. When ready to increase, run:"
    echo "     ./scripts/canary-manage.sh $((percent + 5))"
  else
    echo "  3. Deployment complete. Monitor for 24 hours."
  fi
  echo ""
}

# Rollback to 0% (previous version)
rollback_canary() {
  log_warning "INITIATING ROLLBACK..."
  log_warning "This will revert to 0% canary (previous version receives 100%)"
  echo ""

  read -p "Type 'CONFIRM' to proceed with rollback: " confirm
  if [ "$confirm" != "CONFIRM" ]; then
    log_info "Rollback cancelled."
    exit 0
  fi

  set_canary_percent 0

  log_warning "Rollback complete. 100% traffic now on previous version."
  log_info "Check dashboards and logs for recovery."
}

# Print usage
print_usage() {
  echo "MAGNETO Canary Deployment Manager"
  echo ""
  echo "Usage: $(basename "$0") <COMMAND>"
  echo ""
  echo "Commands:"
  echo "  check              Show current canary status"
  echo "  5, 10, 25, 50, 100 Set canary traffic to specified percentage"
  echo "  rollback           Revert to 0% canary (go back to previous version)"
  echo ""
  echo "Examples:"
  echo "  ./scripts/canary-manage.sh check      # Show status"
  echo "  ./scripts/canary-manage.sh 5          # Start canary at 5%"
  echo "  ./scripts/canary-manage.sh 50         # Scale to 50%"
  echo "  ./scripts/canary-manage.sh 100        # Full production (100%)"
  echo "  ./scripts/canary-manage.sh rollback   # Rollback to previous version"
  echo ""
  echo "Deployment flow:"
  echo "  5% (1h) → 10% (1h) → 25% (2h) → 50% (2h) → 100% (when ready)"
  echo ""
}

# Main logic
case "$CANARY_PERCENT" in
  check)
    check_canary_status
    ;;
  rollback)
    rollback_canary
    ;;
  5|10|25|50|100)
    set_canary_percent "$CANARY_PERCENT"
    verify_health_after_canary "$CANARY_PERCENT"
    ;;
  -h|--help|help)
    print_usage
    ;;
  *)
    log_error "Invalid command: $CANARY_PERCENT"
    echo ""
    print_usage
    exit 1
    ;;
esac
