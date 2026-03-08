import json
import os
import time
from pathlib import Path
from threading import Lock
from typing import Any

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR.parent / "data"
ASSISTANT_MEMORY_PATH = DATA_DIR / "assistant-memory.json"

ASSISTANT_WINDOW_SECONDS = max(5, min(600, int(os.getenv("ASSISTANT_WINDOW_SECONDS", "60"))))
ASSISTANT_RATE_LIMIT_COUNT = max(10, min(5000, int(os.getenv("ASSISTANT_RATE_LIMIT_COUNT", "240"))))
ASSISTANT_CACHE_TTL_SECONDS = max(30, min(86400, int(os.getenv("ASSISTANT_CACHE_TTL_SECONDS", "900"))))
ASSISTANT_CACHE_MAX_ENTRIES = max(50, min(20000, int(os.getenv("ASSISTANT_CACHE_MAX_ENTRIES", "500"))))
ASSISTANT_MEMORY_MAX_ITEMS = max(100, min(100000, int(os.getenv("ASSISTANT_MEMORY_MAX_ITEMS", "2000"))))

_rate_limit_map: dict[str, list[float]] = {}
_cache_map: dict[str, dict[str, Any]] = {}
_runtime_lock = Lock()

assistant_metrics: dict[str, Any] = {
    "requestsTotal": 0,
    "cacheHits": 0,
    "fallbackResponses": 0,
    "providerCounts": {},
    "lastProviderError": "",
    "lastProviderErrorAt": "",
}


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def normalize_query_key(message: str) -> str:
    return " ".join(str(message or "").strip().lower().split())


def increment_metric_counter(counter_name: str, key: str) -> None:
    with _runtime_lock:
        target = assistant_metrics.setdefault(counter_name, {})
        if not isinstance(target, dict):
            target = {}
            assistant_metrics[counter_name] = target
        target[key] = int(target.get(key, 0)) + 1


def register_request() -> None:
    with _runtime_lock:
        assistant_metrics["requestsTotal"] = int(assistant_metrics.get("requestsTotal", 0)) + 1


def register_cache_hit() -> None:
    with _runtime_lock:
        assistant_metrics["cacheHits"] = int(assistant_metrics.get("cacheHits", 0)) + 1


def register_provider(provider: str) -> None:
    normalized = str(provider or "unknown").strip().lower() or "unknown"
    increment_metric_counter("providerCounts", normalized)
    if normalized == "local-fallback":
        with _runtime_lock:
            assistant_metrics["fallbackResponses"] = int(assistant_metrics.get("fallbackResponses", 0)) + 1


def register_provider_error(error_message: str) -> None:
    msg = str(error_message or "").strip()
    if not msg:
        return
    with _runtime_lock:
        assistant_metrics["lastProviderError"] = msg
        assistant_metrics["lastProviderErrorAt"] = _now_iso()


def check_rate_limit(ip: str) -> tuple[bool, int]:
    now = time.time()
    window_start = now - ASSISTANT_WINDOW_SECONDS
    key = str(ip or "unknown")

    with _runtime_lock:
        timestamps = [ts for ts in _rate_limit_map.get(key, []) if ts >= window_start]
        if len(timestamps) >= ASSISTANT_RATE_LIMIT_COUNT:
            retry_after = max(1, int(ASSISTANT_WINDOW_SECONDS - (now - timestamps[0])))
            _rate_limit_map[key] = timestamps
            return False, retry_after

        timestamps.append(now)
        _rate_limit_map[key] = timestamps

    return True, 0


def _prune_cache(now: float) -> None:
    expired_keys = [key for key, value in _cache_map.items() if float(value.get("expiresAt", 0)) <= now]
    for key in expired_keys:
        _cache_map.pop(key, None)

    if len(_cache_map) <= ASSISTANT_CACHE_MAX_ENTRIES:
        return

    # Remove oldest entries first when over capacity.
    ordered = sorted(_cache_map.items(), key=lambda item: float(item[1].get("savedAt", 0)))
    overflow = len(_cache_map) - ASSISTANT_CACHE_MAX_ENTRIES
    for key, _ in ordered[:overflow]:
        _cache_map.pop(key, None)


def get_cache_entry(query_key: str) -> dict[str, Any] | None:
    now = time.time()
    key = str(query_key or "").strip()
    if not key:
        return None

    with _runtime_lock:
        _prune_cache(now)
        entry = _cache_map.get(key)
        if not entry:
            return None
        return dict(entry.get("payload") or {})


def set_cache_entry(query_key: str, payload: dict[str, Any]) -> None:
    key = str(query_key or "").strip()
    if not key:
        return

    now = time.time()
    with _runtime_lock:
        _prune_cache(now)
        _cache_map[key] = {
            "savedAt": now,
            "expiresAt": now + ASSISTANT_CACHE_TTL_SECONDS,
            "payload": dict(payload or {}),
        }


def _ensure_memory_file() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not ASSISTANT_MEMORY_PATH.exists():
        ASSISTANT_MEMORY_PATH.write_text(json.dumps({"chats": []}, indent=2), encoding="utf-8")


def store_memory(*, ip: str, message: str, reply: str, provider: str, model: str, helper: str) -> None:
    _ensure_memory_file()

    try:
        payload = json.loads(ASSISTANT_MEMORY_PATH.read_text(encoding="utf-8"))
    except Exception:
        payload = {"chats": []}

    chats = payload.get("chats")
    if not isinstance(chats, list):
        chats = []

    chats.append(
        {
            "id": f"a-{int(time.time() * 1000)}",
            "at": _now_iso(),
            "ip": str(ip or "unknown"),
            "message": str(message or "").strip(),
            "reply": str(reply or "").strip(),
            "provider": str(provider or "unknown"),
            "model": str(model or "unknown"),
            "helper": str(helper or "general"),
        }
    )

    if len(chats) > ASSISTANT_MEMORY_MAX_ITEMS:
        chats = chats[-ASSISTANT_MEMORY_MAX_ITEMS:]

    payload["chats"] = chats
    ASSISTANT_MEMORY_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def build_status_snapshot() -> dict[str, Any]:
    with _runtime_lock:
        metrics = {
            "requestsTotal": int(assistant_metrics.get("requestsTotal", 0)),
            "cacheHits": int(assistant_metrics.get("cacheHits", 0)),
            "fallbackResponses": int(assistant_metrics.get("fallbackResponses", 0)),
            "providerCounts": dict(assistant_metrics.get("providerCounts") or {}),
            "lastProviderError": str(assistant_metrics.get("lastProviderError") or ""),
            "lastProviderErrorAt": str(assistant_metrics.get("lastProviderErrorAt") or ""),
        }

    return {
        "updatedAt": _now_iso(),
        "providers": {
            "primary": str(os.getenv("AI_PRIMARY_PROVIDER", "openai")).strip().lower() or "openai",
            "fallback": str(os.getenv("AI_FALLBACK_PROVIDER", "anthropic")).strip().lower() or "anthropic",
            "openaiConfigured": bool(str(os.getenv("OPENAI_API_KEY", "")).strip()),
            "anthropicConfigured": bool(str(os.getenv("ANTHROPIC_API_KEY", "")).strip()),
            "geminiConfigured": bool(str(os.getenv("GEMINI_API_KEY", "")).strip()),
        },
        "limits": {
            "assistantWindowSeconds": ASSISTANT_WINDOW_SECONDS,
            "assistantRateLimitCount": ASSISTANT_RATE_LIMIT_COUNT,
            "assistantCacheTtlSeconds": ASSISTANT_CACHE_TTL_SECONDS,
            "assistantCacheMaxEntries": ASSISTANT_CACHE_MAX_ENTRIES,
            "assistantMemoryMaxItems": ASSISTANT_MEMORY_MAX_ITEMS,
        },
        "metrics": metrics,
    }
