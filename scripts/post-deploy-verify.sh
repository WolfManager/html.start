#!/bin/bash

# MAGNETO Post-Deployment Verification Script
# Validates deployment success and system health
# Run this after deployment completes to ensure everything is working
#
# Usage: ./scripts/post-deploy-verify.sh [--quick | --full | --cleanup]

set -e

CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-full}"
VERIFICATION_DELAY=30  # Wait 30 seconds before starting checks

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_h1() { echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"; echo -e "${BLUE}║ $1${NC}"; echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"; }
log_section() { echo -e "\n${CYAN}──── $1 ────${NC}\n"; }
log_info() { echo -e "${BLUE}[i]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[⚠]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

record_pass() {
  log_success "$1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

record_fail() {
  log_error "$1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

record_warn() {
  log_warning "$1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

verify_services() {
  log_section "Service Availability"

  log_info "Waiting $VERIFICATION_DELAY seconds for services to stabilize..."
  sleep "$VERIFICATION_DELAY"

  # Check Node service
  echo -n "Checking Node.js (3000)... "
  if curl -sf --connect-timeout 3 http://127.0.0.1:3000/api/health > /dev/null 2>&1; then
    record_pass "Node.js service responding"
  else
    record_fail "Node.js service not responding on port 3000"
  fi

  # Check Django service
  echo -n "Checking Django (8000)... "
  if curl -sf --connect-timeout 3 http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
    record_pass "Django service responding"
  else
    record_fail "Django service not responding on port 8000"
  fi

  # Check search functionality
  echo -n "Checking search endpoint... "
  search_response=$(curl -s --connect-timeout 3 "http://127.0.0.1:3000/api/search?q=test" 2>/dev/null || echo '{}')
  if [ "$(echo "$search_response" | jq '.success // false' 2>/dev/null)" = "true" ]; then
    record_pass "Search endpoint working"
  else
    record_warn "Search endpoint not responding properly"
  fi
}

verify_health_metrics() {
  log_section "Health Metrics"

  local node_health=$(curl -s http://127.0.0.1:3000/api/health 2>/dev/null || echo '{}')
  local django_health=$(curl -s http://127.0.0.1:8000/api/health 2>/dev/null || echo '{}')

  # Check Node health details
  local node_ok=$(echo "$node_health" | jq '.ok // false' 2>/dev/null)
  local node_version=$(echo "$node_health" | jq -r '.version // "unknown"' 2>/dev/null)

  if [ "$node_ok" = "true" ]; then
    record_pass "Node health check passed (v$node_version)"
  else
    record_fail "Node health check failed"
  fi

  # Check Django health details
  local django_ok=$(echo "$django_health" | jq '.ok // false' 2>/dev/null)
  local django_migrations=$(echo "$django_health" | jq '.migrations // 0' 2>/dev/null)

  if [ "$django_ok" = "true" ]; then
    record_pass "Django health check passed (migrations: $django_migrations)"
  else
    record_fail "Django health check failed"
  fi
}

verify_analytics() {
  log_section "Analytics & Monitoring"

  echo -n "Checking analytics data... "
  local analytics=$(curl -s http://127.0.0.1:3000/api/admin/analytics/current 2>/dev/null || echo '{}')

  if [ -n "$(echo "$analytics" | jq '.requestCount // empty' 2>/dev/null)" ]; then
    local req_count=$(echo "$analytics" | jq '.requestCount' 2>/dev/null)
    local error_rate=$(echo "$analytics" | jq '.errorRate' 2>/dev/null)
    record_pass "Analytics collecting data (requests: $req_count, errors: ${error_rate}%)"
  else
    record_warn "Analytics data not yet available"
  fi
}

verify_database() {
  log_section "Database Connectivity"

  echo -n "Checking database connection... "
  local db_status=$(curl -s http://127.0.0.1:8000/api/admin/database-status 2>/dev/null || echo '{}')

  if [ "$(echo "$db_status" | jq '.connected // false' 2>/dev/null)" = "true" ]; then
    record_pass "Database connected successfully"
  else
    record_warn "Database connection status unclear"
  fi
}

verify_parity() {
  log_section "Search Parity & Contract Validation"

  echo -n "Running parity checks... "
  if cd "$CURRENT_DIR" && npm run parity:critical:gate > /tmp/parity-check.log 2>&1; then
    record_pass "Parity check PASSED"
  else
    record_fail "Parity check FAILED - see /tmp/parity-check.log"
  fi

  echo -n "Running contract validation... "
  if cd "$CURRENT_DIR" && npm run contract:validate:gate > /tmp/contract-check.log 2>&1; then
    record_pass "Contract validation PASSED"
  else
    record_fail "Contract validation FAILED - see /tmp/contract-check.log"
  fi
}

verify_canary_status() {
  log_section "Canary Deployment Status"

  echo -n "Checking routing configuration... "
  local routing=$(curl -s -H "Authorization: Bearer ${DEPLOYMENTS_ADMIN_TOKEN}" \
    http://127.0.0.1:8000/api/admin/routing 2>/dev/null || echo '{}')

  local canary_pct=$(echo "$routing" | jq '.canaryPercent // -1' 2>/dev/null)

  if [ "$canary_pct" -ge 0 ]; then
    record_pass "Canary traffic at ${canary_pct}%"

    if [ "$canary_pct" -eq 0 ]; then
      record_warn "Canary at 0% - no new version running"
    elif [ "$canary_pct" -lt 100 ]; then
      record_pass "Canary gradual rollout in progress"
    else
      record_pass "Canary at 100% - new version fully deployed"
    fi
  else
    record_warn "Could not determine canary status"
  fi
}

verify_performance() {
  log_section "Performance Baseline"

  echo -n "Testing search latency... "
  start=$(date +%s%N)
  curl -s "http://127.0.0.1:3000/api/search?q=performance+test" > /dev/null 2>&1
  end=$(date +%s%N)
  latency=$(( (end - start) / 1000000 ))  # Convert to milliseconds

  if [ "$latency" -lt 2000 ]; then
    record_pass "Search latency acceptable (${latency}ms < 2000ms)"
  elif [ "$latency" -lt 3000 ]; then
    record_warn "Search latency elevated (${latency}ms, target <2000ms)"
  else
    record_fail "Search latency critical (${latency}ms, target <2000ms)"
  fi

  echo -n "Testing API latency... "
  start=$(date +%s%N)
  curl -s http://127.0.0.1:3000/api/health > /dev/null 2>&1
  end=$(date +%s%N)
  latency=$(( (end - start) / 1000000 ))

  if [ "$latency" -lt 500 ]; then
    record_pass "API latency excellent (${latency}ms)"
  else
    record_warn "API latency elevated (${latency}ms, target <500ms)"
  fi
}

verify_logs() {
  log_section "Error Logs Analysis"

  # Check for critical errors in recent logs
  local error_count=$(grep -c "ERROR\|CRITICAL" /var/log/magneto-*.log 2>/dev/null | awk -F: '{sum+=$NF} END {print sum}' || echo "0")

  if [ "$error_count" -eq 0 ]; then
    record_pass "No critical errors in logs"
  elif [ "$error_count" -lt 5 ]; then
    record_warn "Found $error_count errors in logs - review recommended"
  else
    record_fail "Found $error_count errors in logs - investigate"
  fi
}

run_full_verification() {
  log_h1 "MAGNETO POST-DEPLOYMENT VERIFICATION"

  verify_services
  verify_health_metrics
  verify_analytics
  verify_database
  verify_parity
  verify_canary_status
  verify_performance
  verify_logs
}

run_quick_verification() {
  log_h1 "MAGNETO QUICK VERIFICATION (Core Services Only)"

  verify_services
  verify_health_metrics
  verify_canary_status
}

show_summary() {
  echo ""
  log_h1 "VERIFICATION SUMMARY"

  log_info "Passed: $PASS_COUNT"
  log_warning "Warnings: $WARN_COUNT"
  log_error "Failed: $FAIL_COUNT"

  echo ""

  if [ "$FAIL_COUNT" -eq 0 ] && [ "$WARN_COUNT" -eq 0 ]; then
    log_success "✓ DEPLOYMENT VERIFIED SUCCESSFULLY"
    echo ""
    echo "All systems operational. Monitor dashboards for next 24 hours:"
    echo "  - http://localhost:3000/analytics-dashboard.html"
    echo "  - Review: INCIDENT_RESPONSE_PLAYBOOK.md"
    echo ""
    return 0
  elif [ "$FAIL_COUNT" -eq 0 ]; then
    log_warning "✓ DEPLOYMENT MOSTLY SUCCESSFUL (with warnings)"
    echo ""
    echo "Review warnings above and monitor dashboards."
    echo "Contact on-call if issues persist."
    echo ""
    return 0
  else
    log_error "✗ DEPLOYMENT HAS CRITICAL ISSUES"
    echo ""
    echo "Issues found:"
    if [ -f /tmp/parity-check.log ]; then
      echo "  See: /tmp/parity-check.log (parity issues)"
    fi
    if [ -f /tmp/contract-check.log ]; then
      echo "  See: /tmp/contract-check.log (contract issues)"
    fi
    echo ""
    echo "RECOMMENDED ACTIONS:"
    echo "  1. Review issue details above"
    echo "  2. Check: INCIDENT_RESPONSE_PLAYBOOK.md"
    echo "  3. Consider: bash scripts/emergency-rollback.sh"
    echo ""
    return 1
  fi
}

cleanup_temp_files() {
  log_section "Cleanup"

  rm -f /tmp/parity-check.log /tmp/contract-check.log
  log_success "Temporary files cleaned up"
}

# Main execution
case "$MODE" in
  --quick)
    run_quick_verification
    show_summary
    ;;
  --full)
    run_full_verification
    show_summary
    ;;
  --cleanup)
    cleanup_temp_files
    ;;
  *)
    echo "Usage: $0 [--quick | --full | --cleanup]"
    echo ""
    echo "Modes:"
    echo "  --quick    Verify core services and health only (default)"
    echo "  --full     Run comprehensive verification suite"
    echo "  --cleanup  Remove temporary verification files"
    echo ""
    echo "Examples:"
    echo "  ./scripts/post-deploy-verify.sh           # Run quick checks"
    echo "  ./scripts/post-deploy-verify.sh --full    # Run all checks"
    exit 1
    ;;
esac
