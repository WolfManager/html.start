import math
import time
from datetime import datetime, timezone
from threading import Lock
from typing import Any

_runtime_lock = Lock()
_started_at_epoch = time.time()

_api_requests_total = 0
_api_status_counts: dict[str, int] = {}
_api_route_counts: dict[str, int] = {}
_latency_samples_ms: list[float] = []
_request_timestamps: list[float] = []
_MAX_LATENCY_SAMPLES = 1000


def _to_iso_utc(epoch_seconds: float) -> str:
    return datetime.fromtimestamp(epoch_seconds, tz=timezone.utc).isoformat().replace(
        "+00:00", "Z"
    )


def _status_bucket(status_code: int) -> str:
    if status_code < 100:
        return "unknown"
    base = int(status_code / 100)
    if base < 1 or base > 5:
        return "unknown"
    return f"{base}xx"


def record_api_request(*, path: str, status_code: int, duration_ms: float) -> None:
    route = str(path or "unknown").strip() or "unknown"
    status = int(status_code or 0)
    duration = max(0.0, float(duration_ms or 0.0))

    with _runtime_lock:
        global _api_requests_total
        _api_requests_total += 1

        bucket = _status_bucket(status)
        _api_status_counts[bucket] = int(_api_status_counts.get(bucket, 0)) + 1
        _api_route_counts[route] = int(_api_route_counts.get(route, 0)) + 1
        _request_timestamps.append(time.time())

        cutoff = time.time() - 60
        _request_timestamps[:] = [ts for ts in _request_timestamps if ts >= cutoff]

        _latency_samples_ms.append(duration)
        if len(_latency_samples_ms) > _MAX_LATENCY_SAMPLES:
            del _latency_samples_ms[: len(_latency_samples_ms) - _MAX_LATENCY_SAMPLES]


def _percentile(sorted_values: list[float], percentile: int) -> float:
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return float(sorted_values[0])
    rank = math.ceil((percentile / 100) * len(sorted_values)) - 1
    rank = max(0, min(rank, len(sorted_values) - 1))
    return float(sorted_values[rank])


def get_runtime_metrics() -> dict[str, Any]:
    now = time.time()
    with _runtime_lock:
        requests_total = int(_api_requests_total)
        status_counts = {
            "2xx": int(_api_status_counts.get("2xx", 0)),
            "4xx": int(_api_status_counts.get("4xx", 0)),
            "5xx": int(_api_status_counts.get("5xx", 0)),
            "other": int(
                _api_status_counts.get("1xx", 0)
                + _api_status_counts.get("3xx", 0)
                + _api_status_counts.get("unknown", 0)
            ),
        }
        route_counts = dict(_api_route_counts)
        samples = sorted(_latency_samples_ms)
        recent_requests = [ts for ts in _request_timestamps if ts >= (now - 60)]

    p95 = round(_percentile(samples, 95), 2)
    avg = round((sum(samples) / len(samples)), 2) if samples else 0.0

    top_routes = sorted(route_counts.items(), key=lambda item: item[1], reverse=True)[:5]

    requests_last_60s = len(recent_requests)
    req_5xx = int(status_counts.get("5xx", 0))
    req_total = max(1, requests_total)
    error_ratio = req_5xx / req_total

    health_level = "ok"
    health_reasons: list[str] = []
    if p95 >= 1200:
        health_level = "critical"
        health_reasons.append("p95 latency above 1200ms")
    elif p95 >= 700:
        health_level = "warning"
        health_reasons.append("p95 latency above 700ms")

    if error_ratio >= 0.1:
        health_level = "critical"
        health_reasons.append("5xx ratio above 10%")
    elif error_ratio >= 0.03 and health_level != "critical":
        health_level = "warning"
        health_reasons.append("5xx ratio above 3%")

    if requests_last_60s >= 500 and health_level != "critical":
        health_level = "warning"
        health_reasons.append("high traffic burst in last 60s")

    return {
        "startedAt": _to_iso_utc(_started_at_epoch),
        "uptimeSeconds": max(0, int(now - _started_at_epoch)),
        "requests": {
            "apiTotal": requests_total,
            "last60s": requests_last_60s,
            "ratePerMinute": requests_last_60s,
            "status": status_counts,
            "topRoutes": [
                {"path": str(path), "count": int(count)} for path, count in top_routes
            ],
        },
        "latencyMs": {
            "avg": avg,
            "p95": p95,
            "sampleSize": len(samples),
        },
        "health": {
            "level": health_level,
            "reasons": health_reasons,
            "thresholds": {
                "latencyP95WarningMs": 700,
                "latencyP95CriticalMs": 1200,
                "errorRatioWarning": 0.03,
                "errorRatioCritical": 0.1,
            },
        },
    }
