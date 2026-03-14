import json
import os
import threading
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from django.http import FileResponse, HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .services.admin_auth_service import (
    check_admin_rate_limit,
    get_client_ip,
    process_login_attempt,
    validate_admin_token,
)
from .services.admin_backup_service import (
    build_export_csv,
    create_backup,
    is_allowed_backup_reason,
    list_backups,
    resolve_backup_file_path,
    restore_backup,
    sanitize_backup_file_name,
)
from .services.admin_overview_service import build_admin_overview
from .services.analytics_service import log_page_view, log_search
from .services.assistant_runtime_service import (
    build_status_snapshot,
    check_rate_limit,
    get_runtime_counts,
    get_cache_entry,
    normalize_query_key,
    register_cache_hit,
    register_provider,
    register_provider_error,
    register_request,
    set_cache_entry,
    store_memory,
)
from .services.assistant_service import generate_assistant_response, probe_providers_health
from .services.location_service import resolve_approx_location
from .services.runtime_metrics_service import get_runtime_metrics
from .services.search_service import run_search


def _admin_auth_error(request):
    is_allowed, retry_after = check_admin_rate_limit(get_client_ip(request.META))
    if not is_allowed:
        response = Response(
            {"error": f"Too many admin requests. Retry in {retry_after} seconds."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
        response["Retry-After"] = str(retry_after)
        return response

    ok, message = validate_admin_token(str(request.META.get("HTTP_AUTHORIZATION") or ""))
    if not ok:
        return Response({"error": message}, status=status.HTTP_401_UNAUTHORIZED)

    return None


@api_view(["GET"])
def health(_request):
    """Compatibility health endpoint for gradual migration from Node backend."""
    return Response(
        {
            "status": "ok",
            "service": "magneto-django",
            "runtime": {
                "python": "enabled",
                "django": "enabled",
                "openaiConfigured": bool(str(os.getenv("OPENAI_API_KEY", "")).strip()),
                "anthropicConfigured": bool(str(os.getenv("ANTHROPIC_API_KEY", "")).strip()),
                "geminiConfigured": bool(str(os.getenv("GEMINI_API_KEY", "")).strip()),
            },
            "message": "Django API is running in parallel with the Node service.",
        }
    )


@api_view(["GET"])
def search(request):
    query = str(request.query_params.get("q") or "").strip()
    if not query:
        return Response(
            {"error": "Query is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    results = run_search(query)
    log_search(
        query=query,
        result_count=len(results),
        ip=get_client_ip(request.META),
    )

    return Response(
        {
            "engine": "MAGNETO Core",
            "query": query,
            "total": len(results),
            "results": results,
        }
    )


@api_view(["POST"])
def page_view(request):
    page = str((request.data or {}).get("page") or "unknown")
    log_page_view(
        page=page,
        ip=get_client_ip(request.META),
        user_agent=str(request.META.get("HTTP_USER_AGENT") or "unknown"),
    )
    return Response({"ok": True})


@api_view(["POST"])
def auth_login(request):
    username = str((request.data or {}).get("username") or "").strip()
    password = str((request.data or {}).get("password") or "")
    ip = get_client_ip(request.META)

    status_code, payload, headers = process_login_attempt(
        ip=ip,
        username=username,
        password=password,
    )
    response = Response(payload, status=status_code)
    for key, value in headers.items():
        response[key] = value
    return response


@api_view(["POST"])
def assistant_chat(request):
    message = str((request.data or {}).get("message") or "").strip()
    ip = get_client_ip(request.META)

    register_request()

    allowed, retry_after = check_rate_limit(ip)
    if not allowed:
        return Response(
            {
                "error": "Too many assistant requests. Please try again soon.",
                "retryAfterSeconds": retry_after,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    cache_key = normalize_query_key(message)
    cached = get_cache_entry(cache_key)
    if cached:
        register_cache_hit()
        provider = str(cached.get("provider") or "unknown")
        register_provider(provider)
        return Response(cached)

    try:
        payload = generate_assistant_response(message)
        provider = str(payload.get("provider") or "unknown")
        model = str(payload.get("model") or "unknown")
        helper = str(payload.get("helper") or "general")

        register_provider(provider)
        if provider == "local-fallback" and payload.get("reason"):
            register_provider_error(str(payload.get("reason") or ""))
        set_cache_entry(cache_key, payload)
        store_memory(
            ip=ip,
            message=message,
            reply=str(payload.get("reply") or ""),
            provider=provider,
            model=model,
            helper=helper,
        )

        return Response(payload)
    except ValueError as exc:
        return Response(
            {"error": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["GET"])
def admin_assistant_status(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    snapshot = build_status_snapshot()
    providers = snapshot.get("providers") or {}
    limits = snapshot.get("limits") or {}
    metrics_raw = snapshot.get("metrics") or {}
    provider_counts = metrics_raw.get("providerCounts") or {}
    runtime_counts = get_runtime_counts()

    configured = bool(
        providers.get("openaiConfigured")
        or providers.get("anthropicConfigured")
        or providers.get("geminiConfigured")
    )
    primary = str(providers.get("primary") or "openai")
    provider_health = probe_providers_health()

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "assistant": {
            "configured": configured,
            "model": f"{primary}:default",
            "providers": {
                "primary": providers.get("primary") or "openai",
                "fallback": providers.get("fallback") or "anthropic",
            },
            "providerHealth": provider_health,
            "limits": {
                "windowSeconds": int(limits.get("assistantWindowSeconds") or 0),
                "rateLimitCount": int(limits.get("assistantRateLimitCount") or 0),
                "maxChars": int(os.getenv("ASSISTANT_MAX_CHARS", "4000")),
                "simpleQueryWords": int(os.getenv("ASSISTANT_SIMPLE_QUERY_WORDS", "5")),
            },
            "cache": {
                "ttlSeconds": int(limits.get("assistantCacheTtlSeconds") or 0),
                "maxEntries": int(limits.get("assistantCacheMaxEntries") or 0),
                "currentEntries": int(runtime_counts.get("cacheEntries") or 0),
            },
            "memory": {
                "path": "data/assistant-memory.json",
                "totalItems": int(runtime_counts.get("memoryItems") or 0),
                "maxItems": int(limits.get("assistantMemoryMaxItems") or 0),
            },
            "metrics": {
                "requestsTotal": int(metrics_raw.get("requestsTotal") or 0),
                "cacheHits": int(metrics_raw.get("cacheHits") or 0),
                "openaiResponses": int(provider_counts.get("openai") or 0),
                "anthropicResponses": int(provider_counts.get("anthropic") or 0),
                "geminiResponses": int(provider_counts.get("gemini") or 0),
                "localHybridResponses": int(provider_counts.get("local-hybrid") or 0),
                "fallbackResponses": int(metrics_raw.get("fallbackResponses") or 0),
                "lastProviderError": str(metrics_raw.get("lastProviderError") or ""),
                "lastProviderErrorAt": str(metrics_raw.get("lastProviderErrorAt") or ""),
            },
            "billing": {
                "openai": {
                    "overviewUrl": "https://platform.openai.com/settings/organization/billing/overview",
                    "usageUrl": "https://platform.openai.com/usage",
                },
                "anthropic": {
                    "overviewUrl": "https://console.anthropic.com/settings/plans",
                    "usageUrl": "https://console.anthropic.com/settings/usage",
                },
                "gemini": {
                    "overviewUrl": "https://aistudio.google.com/",
                    "usageUrl": "https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas",
                },
            },
        },
    }

    return Response(payload)


@api_view(["GET"])
def admin_runtime_metrics(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    return Response(
        {
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "runtime": get_runtime_metrics(),
        }
    )


@api_view(["GET"])
def location_auto(_request):
    try:
        location = resolve_approx_location()
        return Response(location)
    except RuntimeError:
        return Response(
            {"error": "Location service unavailable."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


@api_view(["GET"])
def admin_overview(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    range_value = str(request.query_params.get("range") or "all")
    payload = build_admin_overview(range_value)
    return Response(payload)


@api_view(["GET"])
def admin_backups(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    requested_reason = str(request.query_params.get("reason") or "all").strip()
    reason_filter = requested_reason if requested_reason else "all"
    if reason_filter != "all" and not is_allowed_backup_reason(reason_filter):
        return Response(
            {"error": "Invalid backup reason filter."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "reason": reason_filter,
            "backups": list_backups(reason_filter),
        }
    )


@api_view(["GET"])
def admin_backups_download(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    file_name = sanitize_backup_file_name(str(request.query_params.get("fileName") or ""))
    if not file_name:
        return Response(
            {"error": "Invalid backup file name."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    source = resolve_backup_file_path(file_name)
    if source is None:
        return Response(
            {"error": "Backup file not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    response = FileResponse(open(source, "rb"), content_type="application/json; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{source.name}"'
    return response


@api_view(["POST"])
def admin_backups_create(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    create_backup("manual", force=True)
    return Response(
        {
            "ok": True,
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "backups": list_backups("all"),
        }
    )


@api_view(["POST"])
def admin_backups_restore(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    file_name = sanitize_backup_file_name(str((request.data or {}).get("fileName") or ""))
    if not file_name:
        return Response(
            {"error": "Invalid backup file name."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        payload = restore_backup(file_name)
        return Response(payload)
    except FileNotFoundError:
        return Response(
            {"error": "Backup file not found."},
            status=status.HTTP_404_NOT_FOUND,
        )


@api_view(["GET"])
def admin_export_csv(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    range_value = str(request.query_params.get("range") or "all")
    csv_text = build_export_csv(range_value)

    response = HttpResponse(csv_text, content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = 'attachment; filename="magneto-analytics.csv"'
    return response


# ─── Traffic routing state ────────────────────────────────────────────────────
_VALID_ROUTING_BACKENDS = {"node", "django"}
_VALID_CANARY_PERCENTAGES = {0, 10, 50, 100}

_ROUTING_STATE_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "routing-state.json"

_routing_lock = threading.Lock()

def _load_routing_state() -> dict:
    defaults: dict = {
        "activeBackend": "node",
        "canaryPercent": 100,
        "djangoUrl": str(os.getenv("DJANGO_API_URL", "http://127.0.0.1:8000")),
        "note": "Initial state – Node backend at 100%.",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    try:
        raw = _ROUTING_STATE_PATH.read_text(encoding="utf-8")
        saved = json.loads(raw)
        if (
            saved.get("activeBackend") in _VALID_ROUTING_BACKENDS
            and saved.get("canaryPercent") in _VALID_CANARY_PERCENTAGES
        ):
            saved["djangoUrl"] = str(os.getenv("DJANGO_API_URL", "http://127.0.0.1:8000"))
            return {**defaults, **saved}
    except Exception:
        pass
    return defaults

def _persist_routing_state() -> None:
    try:
        _ROUTING_STATE_PATH.write_text(
            json.dumps(_routing_state, indent=2), encoding="utf-8"
        )
    except Exception:
        pass

_routing_state: dict = _load_routing_state()


def _get_routing_state() -> dict:
    with _routing_lock:
        return dict(_routing_state)


def _update_routing_state(**kwargs) -> dict:
    with _routing_lock:
        for key, value in kwargs.items():
            _routing_state[key] = value
        _routing_state["updatedAt"] = datetime.now(timezone.utc).isoformat()
        snapshot = dict(_routing_state)
    _persist_routing_state()
    return snapshot


@api_view(["GET", "POST"])
def admin_routing(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    if request.method == "GET":
        return Response(
            {
                "ok": True,
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "routing": _get_routing_state(),
            }
        )

    # POST – update routing state
    body = request.data or {}
    new_backend = str(body.get("activeBackend") or "").lower()
    new_canary_raw = body.get("canaryPercent")
    new_note = str(body.get("note") or "")[:300]

    if new_backend and new_backend not in _VALID_ROUTING_BACKENDS:
        return Response(
            {"error": "Invalid activeBackend. Allowed: node, django."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if new_canary_raw is not None:
        try:
            new_canary = int(new_canary_raw)
        except (TypeError, ValueError):
            new_canary = -1
        if new_canary not in _VALID_CANARY_PERCENTAGES:
            return Response(
                {"error": "Invalid canaryPercent. Allowed: 0, 10, 50, 100."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        new_canary = None

    updates: dict = {}
    if new_backend:
        updates["activeBackend"] = new_backend
    if new_canary is not None:
        updates["canaryPercent"] = new_canary
    if new_note:
        updates["note"] = new_note

    updated = _update_routing_state(**updates)

    return Response(
        {
            "ok": True,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "routing": updated,
        }
    )


@api_view(["POST"])
def admin_routing_verify(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    routing = _get_routing_state()
    django_url = str(routing.get("djangoUrl") or "http://127.0.0.1:8000")

    def _probe(backend: str, url: str) -> dict:
        import time

        start = time.monotonic()
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                raw = resp.read(2048)
                latency_ms = int((time.monotonic() - start) * 1000)
                try:
                    import json as _json
                    data = _json.loads(raw)
                except Exception:
                    data = {}
                ok = resp.status < 400 and (
                    data.get("ok") is True or data.get("status") == "ok"
                )
                return {
                    "backend": backend,
                    "url": url,
                    "ok": ok,
                    "statusCode": resp.status,
                    "latencyMs": latency_ms,
                }
        except Exception as exc:
            latency_ms = int((time.monotonic() - start) * 1000)
            return {
                "backend": backend,
                "url": url,
                "ok": False,
                "error": str(exc),
                "latencyMs": latency_ms,
            }

    django_port = str(os.getenv("MAGNETO_DJANGO_PORT") or os.getenv("PORT", "8000"))
    node_port = str(os.getenv("MAGNETO_NODE_PORT") or "3000")
    node_url = f"http://127.0.0.1:{node_port}/api/health"
    django_health_url = f"{django_url.rstrip('/')}/api/health"

    checks = [
        _probe("node", node_url),
        _probe("django", django_health_url),
    ]

    all_ok = all(c["ok"] for c in checks)

    return Response(
        {
            "ok": all_ok,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "checks": checks,
            "routing": routing,
        }
    )
