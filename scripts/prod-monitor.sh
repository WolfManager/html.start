#!/bin/bash

# MAGNETO Production Monitoring Dashboard
# Real-time health metrics and early warning indicators
# Usage: ./scripts/prod-monitor.sh [--dashboard | --alerts | --baseline]

set -e

CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-dashboard}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_h1() { echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"; echo -e "${BLUE}║ $1${NC}"; echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"; }
log_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[⚠]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

threshold_status() {
  local value=$1
  local caution=$2
  local alert=$3
  local critical=$4

  if (( $(echo "$value > $critical" | bc -l 2>/dev/null || echo "0") )); then
    echo -e "${RED}CRITICAL${NC} ($value)"
  elif (( $(echo "$value > $alert" | bc -l 2>/dev/null || echo "0") )); then
    echo -e "${YELLOW}ALERT${NC} ($value)"
  elif (( $(echo "$value > $caution" | bc -l 2>/dev/null || echo "0") )); then
    echo -e "${YELLOW}CAUTION${NC} ($value)"
  else
    echo -e "${GREEN}OK${NC} ($value)"
  fi
}

fetch_metrics() {
  # Fetch Node metrics
  local node_health=$(curl -s --connect-timeout 2 http://127.0.0.1:3000/api/health 2>/dev/null || echo '{"ok":false}')
  local node_ok=$(echo "$node_health" | jq '.ok // false' 2>/dev/null || echo "false")
  local node_latency=$(echo "$node_health" | jq '.latency_ms // 0' 2>/dev/null || echo "0")

  # Fetch Django metrics
  local django_health=$(curl -s --connect-timeout 2 http://127.0.0.1:8000/api/health 2>/dev/null || echo '{"ok":false}')
  local django_ok=$(echo "$django_health" | jq '.ok // false' 2>/dev/null || echo "false")
  local django_latency=$(echo "$django_health" | jq '.latency_ms // 0' 2>/dev/null || echo "0")

  # Fetch analytics (current request metrics)
  local analytics=$(curl -s --connect-timeout 2 http://127.0.0.1:3000/api/admin/analytics/current 2>/dev/null || echo '{}')
  local error_rate=$(echo "$analytics" | jq '.errorRate // 0' 2>/dev/null || echo "0")
  local success_rate=$(echo "$analytics" | jq '.successRate // 100' 2>/dev/null || echo "100")
  local p95_latency=$(echo "$analytics" | jq '.p95Latency // 0' 2>/dev/null || echo "0")
  local request_count=$(echo "$analytics" | jq '.requestCount // 0' 2>/dev/null || echo "0")

  # System metrics
  local memory_free=$(free | awk '/^Mem:/{print int($7/1024)}')
  local memory_total=$(free | awk '/^Mem:/{print int($2/1024)}')
  local memory_used=$((memory_total - memory_free))
  local memory_percent=$((memory_used * 100 / memory_total))

  local disk_usage=$(df / | awk 'NR==2{print int($5)}')
  local cpu_usage=$(top -bn1 | awk '/^%Cpu/{print $2}' | cut -d'.' -f1 || echo "0")

  echo "node_ok=$node_ok"
  echo "node_latency=$node_latency"
  echo "django_ok=$django_ok"
  echo "django_latency=$django_latency"
  echo "error_rate=$error_rate"
  echo "success_rate=$success_rate"
  echo "p95_latency=$p95_latency"
  echo "request_count=$request_count"
  echo "memory_percent=$memory_percent"
  echo "memory_used=$memory_used"
  echo "memory_total=$memory_total"
  echo "disk_usage=$disk_usage"
  echo "cpu_usage=$cpu_usage"
}

show_dashboard() {
  clear
  log_h1 "MAGNETO PRODUCTION MONITORING"

  # Fetch all metrics
  local metrics=$(fetch_metrics)
  eval "$metrics"

  # Service Status
  echo -e "${CYAN}═══ SERVICE STATUS ═══${NC}"
  if [ "$node_ok" = "true" ]; then
    log_success "Node.js Service (port 3000)"
  else
    log_error "Node.js Service (port 3000)"
  fi

  if [ "$django_ok" = "true" ]; then
    log_success "Django Service (port 8000)"
  else
    log_error "Django Service (port 8000)"
  fi

  echo ""
  echo -e "${CYAN}═══ RESPONSE METRICS ═══${NC}"

  # Error Rate
  echo -n "Error Rate: "
  threshold_status "$error_rate" "0.5" "2" "5"

  # Success Rate
  echo -n "Success Rate: "
  threshold_status "$(echo "100 - $success_rate" | bc -l 2>/dev/null || echo $((100 - success_rate)))" "2" "5" "10"

  # Latency P95
  echo -n "Latency P95: "
  threshold_status "$p95_latency" "1500" "2000" "3000"
  echo "  (${p95_latency}ms)"

  # Request Volume
  echo "Request Count (last 5min): $request_count"

  echo ""
  echo -e "${CYAN}═══ SYSTEM RESOURCES ═══${NC}"

  # Memory
  echo -n "Memory Usage: "
  threshold_status "$memory_percent" "70" "80" "90"
  echo "  (${memory_used}/${memory_total} MB)"

  # Disk
  echo -n "Disk Usage: "
  threshold_status "$disk_usage" "70" "80" "90"
  echo "  (${disk_usage}%)"

  # CPU
  echo -n "CPU Usage: "
  threshold_status "$cpu_usage" "70" "80" "95"
  echo "  (${cpu_usage}%)"

  echo ""
  echo -e "${CYAN}═══ SERVICE LATENCY ═══${NC}"
  echo "Node Health Check: ${node_latency}ms"
  echo "Django Health Check: ${django_latency}ms"

  echo ""
  echo -e "${CYAN}═══ THRESHOLDS ═══${NC}"
  echo "Error Rate:     CAUTION >0.5%  ALERT >2%  CRITICAL >5%"
  echo "Success Rate:   CAUTION <98%   ALERT <95% CRITICAL <90%"
  echo "Latency P95:    CAUTION >1500ms ALERT >2000ms CRITICAL >3000ms"
  echo "Memory:         CAUTION >70%   ALERT >80% CRITICAL >90%"
  echo "Disk:           CAUTION >70%   ALERT >80% CRITICAL >90%"

  echo ""
  echo -e "${CYAN}═══ NEXT STEPS ═══${NC}"
  echo "Press Ctrl+C to stop monitoring"
  echo "View incident playbook: INCIDENT_RESPONSE_PLAYBOOK.md"
  echo "Emergency rollback: bash scripts/emergency-rollback.sh"
  echo ""
  echo "Last updated: $(date '+%Y-%m-%d %H:%M:%S') UTC"
}

show_alerts() {
  log_h1 "MAGNETO PRODUCTION ALERTS"

  # Fetch all metrics
  local metrics=$(fetch_metrics)
  eval "$metrics"

  local alerts=0

  # Check service availability
  if [ "$node_ok" != "true" ]; then
    log_error "CRITICAL: Node.js service unavailable"
    alerts=$((alerts + 1))
  fi

  if [ "$django_ok" != "true" ]; then
    log_error "CRITICAL: Django service unavailable"
    alerts=$((alerts + 1))
  fi

  # Check error rate
  if (( $(echo "$error_rate > 5" | bc -l 2>/dev/null || echo "0") )); then
    log_error "CRITICAL: Error rate ${error_rate}% (threshold: 5%)"
    alerts=$((alerts + 1))
  elif (( $(echo "$error_rate > 2" | bc -l 2>/dev/null || echo "0") )); then
    log_warning "ALERT: Error rate ${error_rate}% (threshold: 2%)"
    alerts=$((alerts + 1))
  fi

  # Check latency
  if (( $(echo "$p95_latency > 3000" | bc -l 2>/dev/null || echo "0") )); then
    log_error "CRITICAL: Latency P95 ${p95_latency}ms (threshold: 3000ms)"
    alerts=$((alerts + 1))
  elif (( $(echo "$p95_latency > 2000" | bc -l 2>/dev/null || echo "0") )); then
    log_warning "ALERT: Latency P95 ${p95_latency}ms (threshold: 2000ms)"
    alerts=$((alerts + 1))
  fi

  # Check memory
  if (( memory_percent > 90 )); then
    log_error "CRITICAL: Memory usage ${memory_percent}% (threshold: 90%)"
    alerts=$((alerts + 1))
  elif (( memory_percent > 80 )); then
    log_warning "ALERT: Memory usage ${memory_percent}% (threshold: 80%)"
    alerts=$((alerts + 1))
  fi

  # Check disk
  if (( disk_usage > 90 )); then
    log_error "CRITICAL: Disk usage ${disk_usage}% (threshold: 90%)"
    alerts=$((alerts + 1))
  elif (( disk_usage > 80 )); then
    log_warning "ALERT: Disk usage ${disk_usage}% (threshold: 80%)"
    alerts=$((alerts + 1))
  fi

  if [ $alerts -eq 0 ]; then
    log_success "No active alerts - system healthy"
  else
    echo ""
    log_error "Found $alerts alert(s) - review INCIDENT_RESPONSE_PLAYBOOK.md for resolution"
  fi
}

save_baseline() {
  log_h1 "MAGNETO PRODUCTION BASELINE SNAPSHOT"

  local metrics=$(fetch_metrics)
  eval "$metrics"

  local baseline_file="$CURRENT_DIR/data/baseline-metrics-$(date +%Y%m%d-%H%M%S).json"

  cat > "$baseline_file" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "production",
  "services": {
    "node": {
      "healthy": $node_ok,
      "latency_ms": $node_latency
    },
    "django": {
      "healthy": $django_ok,
      "latency_ms": $django_latency
    }
  },
  "metrics": {
    "error_rate": $error_rate,
    "success_rate": $success_rate,
    "p95_latency_ms": $p95_latency,
    "request_count_5min": $request_count
  },
  "resources": {
    "memory_percent": $memory_percent,
    "memory_mb": {
      "used": $memory_used,
      "total": $memory_total
    },
    "disk_percent": $disk_usage,
    "cpu_percent": $cpu_usage
  }
}
EOF

  log_success "Baseline saved to: $baseline_file"
  cat "$baseline_file" | jq .
}

# Main execution
case "$MODE" in
  --dashboard)
    while true; do
      show_dashboard
      sleep 10
    done
    ;;
  --alerts)
    show_alerts
    ;;
  --baseline)
    save_baseline
    ;;
  *)
    echo "Usage: $0 [--dashboard | --alerts | --baseline]"
    echo ""
    echo "Modes:"
    echo "  --dashboard   Show live dashboard with 10-second refresh (default)"
    echo "  --alerts      Show current alerts and issues"
    echo "  --baseline    Capture and save current metrics as baseline"
    echo ""
    echo "Examples:"
    echo "  ./scripts/prod-monitor.sh              # Start live dashboard"
    echo "  ./scripts/prod-monitor.sh --alerts     # Check for alerts"
    echo "  ./scripts/prod-monitor.sh --baseline   # Save baseline metrics"
    exit 1
    ;;
esac
