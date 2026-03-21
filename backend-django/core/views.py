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
from .services.analytics_service import log_page_view, log_result_click, log_search, read_analytics
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
from .services.index_sync_status_service import build_index_sync_status_payload
from .services.assistant_service import generate_assistant_response, probe_providers_health
from .services.location_service import resolve_approx_location
from .services.runtime_metrics_service import get_runtime_metrics
from .services.search_crawler_service import crawl_due_sources
from .services.search_index_service import seed_default_sources
from .services.search_ranking_config_service import (
    get_search_ranking_config,
    reset_search_ranking_config,
    write_search_ranking_config,
)
from .services.search_service import (
    get_query_rewrite_rules,
    get_search_sources,
    get_search_suggestions,
    invalidate_click_signal_cache,
    reset_query_rewrite_rules,
    run_search_page,
    write_query_rewrite_rules,
)


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

    language = str(request.query_params.get("language") or "").strip()
    category = str(request.query_params.get("category") or "").strip()
    source = str(request.query_params.get("source") or "").strip()
    sort = str(request.query_params.get("sort") or "relevance").strip()
    limit_raw = str(request.query_params.get("limit") or "").strip()
    limit = int(limit_raw) if limit_raw.isdigit() else 20
    page_raw = str(request.query_params.get("page") or "").strip()
    page = int(page_raw) if page_raw.isdigit() else 1
    page = max(1, min(500, page))
    safe_limit = max(1, min(50, limit))
    offset = (page - 1) * safe_limit

    payload = run_search_page(
        query,
        language=language,
        category=category,
        source=source,
        sort=sort,
        limit=safe_limit,
        offset=offset,
    )
    log_search(
        query=query,
        result_count=int(payload.get("total", 0) or 0),
        ip=get_client_ip(request.META),
    )

    total = int(payload.get("total", 0) or 0)
    total_pages = int(payload.get("totalPages", 0) or 0)
    current_page = int(payload.get("page", page) or page)
    has_next_page = bool(payload.get("hasNextPage"))
    has_prev_page = bool(payload.get("hasPrevPage"))

    return Response(
        {
            "engine": "MAGNETO Core",
            "query": query,
            "queryUsed": payload.get("queryUsed") or query,
            "queryRewrite": payload.get("queryRewrite"),
            "total": total,
            "appliedFilters": {
                "language": language,
                "category": category,
                "source": source,
                "sort": sort or "relevance",
                "limit": safe_limit,
                "page": current_page,
            },
            "pagination": {
                "page": current_page,
                "pageSize": safe_limit,
                "offset": int(payload.get("offset", offset) or offset),
                "total": total,
                "totalPages": total_pages,
                "hasNextPage": has_next_page,
                "hasPrevPage": has_prev_page,
                "nextPage": current_page + 1 if has_next_page else None,
                "prevPage": current_page - 1 if has_prev_page else None,
            },
            "facets": payload.get("facets") or {
                "languages": [],
                "categories": [],
                "sources": [],
            },
            "results": payload.get("results") or [],
        }
    )


@api_view(["GET"])
def search_sources(request):
    query = str(request.query_params.get("q") or "").strip()
    limit_raw = str(request.query_params.get("limit") or "").strip()
    limit = int(limit_raw) if limit_raw.isdigit() else 20
    sources = get_search_sources(query=query, limit=limit)
    return Response(
        {
            "ok": True,
            "total": len(sources),
            "sources": sources,
        }
    )


@api_view(["GET"])
def search_suggest(request):
    query = str(request.query_params.get("q") or "").strip()
    limit_raw = str(request.query_params.get("limit") or "").strip()
    limit = int(limit_raw) if limit_raw.isdigit() else 10
    safe_limit = max(1, min(20, limit))

    if len(query) < 2:
        return Response(
            {
                "ok": True,
                "query": query,
                "total": 0,
                "suggestions": [],
            }
        )

    suggestions = get_search_suggestions(partial=query, limit=safe_limit)
    return Response(
        {
            "ok": True,
            "query": query,
            "total": len(suggestions),
            "suggestions": suggestions,
        }
    )


def _search_admin_payload() -> dict:
    from .models import CrawlRun, SearchBlockRule, SearchDocument, SearchSource

    latest_run = CrawlRun.objects.order_by("-started_at").first()
    recent_runs = CrawlRun.objects.select_related("source").order_by("-started_at")[:12]
    rewrite_rules = get_query_rewrite_rules()
    return {
        "sources": {
            "total": SearchSource.objects.count(),
            "active": SearchSource.objects.filter(is_active=True).count(),
        },
        "documents": {
            "indexed": SearchDocument.objects.filter(
                status=SearchDocument.STATUS_INDEXED
            ).count(),
            "blocked": SearchDocument.objects.filter(
                status=SearchDocument.STATUS_BLOCKED
            ).count(),
            "errors": SearchDocument.objects.filter(
                status=SearchDocument.STATUS_ERROR
            ).count(),
        },
        "blockRules": SearchBlockRule.objects.filter(is_active=True).count(),
        "rewriteRules": {
            "total": len(rewrite_rules),
            "enabled": sum(1 for item in rewrite_rules if item.get("enabled", True)),
            "contains": sum(
                1
                for item in rewrite_rules
                if str(item.get("matchType") or "exact").strip().lower() == "contains"
            ),
        },
        "latestRun": {
            "status": latest_run.status if latest_run else "idle",
            "startedAt": latest_run.started_at.isoformat().replace("+00:00", "Z")
            if latest_run
            else "",
            "finishedAt": latest_run.finished_at.isoformat().replace("+00:00", "Z")
            if latest_run and latest_run.finished_at
            else "",
            "pagesSeen": latest_run.pages_seen if latest_run else 0,
            "pagesIndexed": latest_run.pages_indexed if latest_run else 0,
            "pagesUpdated": latest_run.pages_updated if latest_run else 0,
            "pagesFailed": latest_run.pages_failed if latest_run else 0,
        },
        "recentRuns": [
            {
                "id": run.pk,
                "source": run.source.slug if run.source else "all",
                "status": run.status,
                "trigger": run.trigger,
                "startedAt": run.started_at.isoformat().replace("+00:00", "Z")
                if run.started_at
                else "",
                "finishedAt": run.finished_at.isoformat().replace("+00:00", "Z")
                if run.finished_at
                else "",
                "pagesSeen": run.pages_seen,
                "pagesIndexed": run.pages_indexed,
                "pagesUpdated": run.pages_updated,
                "pagesFailed": run.pages_failed,
                "pagesBlocked": run.pages_blocked,
                "notes": run.notes,
            }
            for run in recent_runs
        ],
    }


def _parse_iso_datetime(raw_value: str):
    value = str(raw_value or "").strip()
    if not value:
        return None

    normalized = value
    if normalized.endswith("Z"):
        normalized = f"{normalized[:-1]}+00:00"

    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)

    return parsed


def _iso_or_empty(value) -> str:
    if not value:
        return ""
    return value.isoformat().replace("+00:00", "Z")


def _normalize_query_text(value: str) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _looks_like_operator_query(value: str) -> bool:
    normalized = _normalize_query_text(value)
    return any(
        token in normalized
        for token in ("site:", "-site:", "inurl:", "intitle:", "filetype:")
    )


def _build_rewrite_rule_suggestions(
    limit: int = 10,
    min_confidence: float = 0.0,
) -> list[dict]:
    analytics = read_analytics()
    searches = list(analytics.get("searches") or [])
    searches_by_id = {
        str(item.get("id") or "").strip(): item
        for item in searches
        if str(item.get("id") or "").strip()
    }

    existing_keys = {
        (
            _normalize_query_text(str(rule.get("from") or "")),
            _normalize_query_text(str(rule.get("to") or "")),
            str(rule.get("matchType") or "exact").strip().lower() or "exact",
        )
        for rule in get_query_rewrite_rules()
    }

    candidate_stats: dict[tuple[str, str], dict] = {}
    for current in searches:
        previous_id = str(current.get("reformulatesSearchId") or "").strip()
        if not previous_id:
            continue

        previous = searches_by_id.get(previous_id)
        if not previous:
            continue

        previous_query = str(previous.get("query") or "").strip()
        current_query = str(current.get("query") or "").strip()
        previous_norm = _normalize_query_text(previous_query)
        current_norm = _normalize_query_text(current_query)

        if not previous_norm or not current_norm or previous_norm == current_norm:
            continue
        if len(previous_norm) < 3 or len(current_norm) < 3:
            continue
        if _looks_like_operator_query(previous_norm) or _looks_like_operator_query(current_norm):
            continue

        previous_count = int(previous.get("resultCount") or 0)
        current_count = int(current.get("resultCount") or 0)
        reformulation_type = str(current.get("reformulationType") or "").strip().lower()

        # Only suggest when reformulation clearly improves a failed/weak query.
        if reformulation_type not in {"zero-results-refinement", "low-results-refinement"}:
            continue
        if current_count <= previous_count:
            continue

        key = (previous_norm, current_norm)
        entry = candidate_stats.get(key)
        if entry is None:
            entry = {
                "from": previous_query,
                "to": current_query,
                "count": 0,
                "maxImprovement": 0,
                "types": set(),
            }
            candidate_stats[key] = entry

        entry["count"] = int(entry["count"]) + 1
        entry["maxImprovement"] = max(
            int(entry["maxImprovement"]),
            current_count - previous_count,
        )
        entry["types"].add(reformulation_type)

    candidates: list[dict] = []
    for (source_norm, target_norm), item in candidate_stats.items():
        if (source_norm, target_norm, "exact") in existing_keys:
            continue

        count = int(item.get("count") or 0)
        max_improvement = int(item.get("maxImprovement") or 0)
        confidence = min(0.99, 0.45 + (0.12 * min(count, 4)) + (0.02 * min(max_improvement, 10)))
        candidates.append(
            {
                "enabled": True,
                "matchType": "exact",
                "from": str(item.get("from") or "").strip(),
                "to": str(item.get("to") or "").strip(),
                "reason": "telemetry-suggested",
                "signals": {
                    "reformulations": count,
                    "maxImprovement": max_improvement,
                    "types": sorted(list(item.get("types") or [])),
                    "confidence": round(confidence, 2),
                },
            }
        )

    threshold = max(0.0, min(0.99, float(min_confidence or 0.0)))
    candidates = [
        item
        for item in candidates
        if float((item.get("signals") or {}).get("confidence") or 0.0) >= threshold
    ]

    candidates.sort(
        key=lambda entry: (
            int((entry.get("signals") or {}).get("reformulations") or 0),
            int((entry.get("signals") or {}).get("maxImprovement") or 0),
        ),
        reverse=True,
    )
    return candidates[: max(1, min(50, int(limit or 10)))]


@api_view(["POST"])
def admin_search_seed(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    force = bool((request.data or {}).get("force"))
    created, updated = seed_default_sources(force=force)
    return Response(
        {
            "ok": True,
            "created": created,
            "updated": updated,
            "search": _search_admin_payload(),
        }
    )


@api_view(["POST"])
def admin_search_crawl(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    raw_source_ids = (request.data or {}).get("sourceIds") or []
    source_ids = [int(item) for item in raw_source_ids if str(item).isdigit()]
    max_pages_raw = str((request.data or {}).get("maxPages") or "").strip()
    max_pages = int(max_pages_raw) if max_pages_raw.isdigit() else None
    runs = crawl_due_sources(
        trigger="admin-api",
        source_ids=source_ids or None,
        max_pages=max_pages,
    )
    return Response(
        {
            "ok": True,
            "runs": [
                {
                    "id": run.pk,
                    "source": run.source.slug if run.source else "all",
                    "status": run.status,
                    "pagesSeen": run.pages_seen,
                    "pagesIndexed": run.pages_indexed,
                    "pagesUpdated": run.pages_updated,
                    "pagesFailed": run.pages_failed,
                    "pagesBlocked": run.pages_blocked,
                    "notes": run.notes,
                }
                for run in runs
            ],
            "search": _search_admin_payload(),
        }
    )


@api_view(["GET"])
def admin_search_status(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    return Response({"ok": True, "search": _search_admin_payload()})


@api_view(["GET"])
def admin_search_rewrite_rules(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    return Response(
        {
            "ok": True,
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "rewriteRules": get_query_rewrite_rules(),
        }
    )


@api_view(["GET", "POST"])
def admin_search_ranking_config(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    if request.method == "GET":
        return Response(
            {
                "ok": True,
                "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "rankingConfig": get_search_ranking_config(),
            }
        )

    try:
        ranking_config = (
            reset_search_ranking_config()
            if bool((request.data or {}).get("reset"))
            else write_search_ranking_config((request.data or {}).get("rankingConfig") or {})
        )
    except ValueError as exc:
        return Response(
            {"error": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {
            "ok": True,
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "rankingConfig": ranking_config,
        }
    )


@api_view(["POST"])
def admin_search_rewrite_rules_update(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    try:
        rewrite_rules = (
            reset_query_rewrite_rules()
            if bool((request.data or {}).get("reset"))
            else write_query_rewrite_rules((request.data or {}).get("rewriteRules") or [])
        )
    except ValueError as exc:
        return Response(
            {"error": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {
            "ok": True,
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "rewriteRules": rewrite_rules,
        }
    )


@api_view(["GET"])
def admin_search_rewrite_rules_suggestions(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    limit_raw = str(request.query_params.get("limit") or "").strip()
    limit = int(limit_raw) if limit_raw.isdigit() else 10
    min_confidence_raw = str(request.query_params.get("minConfidence") or "").strip()
    try:
        min_confidence = float(min_confidence_raw) if min_confidence_raw else 0.0
    except ValueError:
        return Response(
            {"error": "Invalid minConfidence value."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if min_confidence < 0 or min_confidence > 0.99:
        return Response(
            {"error": "minConfidence must be between 0 and 0.99."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    suggestions = _build_rewrite_rule_suggestions(
        limit=limit,
        min_confidence=min_confidence,
    )
    return Response(
        {
            "ok": True,
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "suggestions": suggestions,
            "total": len(suggestions),
            "minConfidence": min_confidence,
        }
    )


@api_view(["GET"])
def admin_search_export(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    from .models import SearchDocument

    source_slug = str(request.query_params.get("source") or "").strip().lower()
    status_filter = str(request.query_params.get("status") or "indexed").strip().lower()
    updated_since_raw = str(request.query_params.get("updatedSince") or "").strip()
    limit_raw = str(request.query_params.get("limit") or "").strip()
    page_raw = str(request.query_params.get("page") or "").strip()

    limit = int(limit_raw) if limit_raw.isdigit() else 200
    page = int(page_raw) if page_raw.isdigit() else 1
    safe_limit = max(1, min(500, limit))
    safe_page = max(1, min(10000, page))
    offset = (safe_page - 1) * safe_limit

    allowed_statuses = {
        "indexed",
        "blocked",
        "error",
        "all",
    }
    if status_filter not in allowed_statuses:
        return Response(
            {"error": "Invalid status. Allowed: indexed, blocked, error, all."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    updated_since = None
    if updated_since_raw:
        updated_since = _parse_iso_datetime(updated_since_raw)
        if updated_since is None:
            return Response(
                {"error": "Invalid updatedSince ISO datetime."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    queryset = SearchDocument.objects.select_related("source")
    if status_filter != "all":
        queryset = queryset.filter(status=status_filter)
    if source_slug:
        queryset = queryset.filter(source__slug=source_slug)
    if updated_since is not None:
        queryset = queryset.filter(updated_at__gte=updated_since)

    total = queryset.count()
    docs = list(queryset.order_by("updated_at", "id")[offset : offset + safe_limit])
    has_next_page = offset + len(docs) < total

    return Response(
        {
            "ok": True,
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "filters": {
                "status": status_filter,
                "source": source_slug,
                "updatedSince": updated_since_raw,
            },
            "pagination": {
                "page": safe_page,
                "pageSize": safe_limit,
                "offset": offset,
                "total": total,
                "hasNextPage": has_next_page,
                "nextPage": safe_page + 1 if has_next_page else None,
            },
            "documents": [
                {
                    "id": doc.pk,
                    "url": doc.url,
                    "canonicalUrl": doc.canonical_url,
                    "title": doc.title,
                    "summary": doc.summary,
                    "content": doc.content,
                    "language": doc.language,
                    "category": doc.category,
                    "tags": doc.tags,
                    "status": doc.status,
                    "qualityScore": doc.quality_score,
                    "crawlDepth": doc.crawl_depth,
                    "fetchedAt": _iso_or_empty(doc.fetched_at),
                    "indexedAt": _iso_or_empty(doc.indexed_at),
                    "updatedAt": _iso_or_empty(doc.updated_at),
                    "source": {
                        "id": doc.source_id,
                        "slug": doc.source.slug,
                        "name": doc.source.name,
                        "baseUrl": doc.source.base_url,
                    },
                }
                for doc in docs
            ],
        }
    )


@api_view(["GET"])
def admin_index_sync_status(request):
    auth_error = _admin_auth_error(request)
    if auth_error is not None:
        return auth_error

    payload = build_index_sync_status_payload()
    return Response(
        {
            "ok": True,
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            **payload,
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
def result_click(request):
    payload = request.data or {}
    url = str(payload.get("url") or "").strip()
    query = str(payload.get("query") or "").strip()
    title = str(payload.get("title") or "").strip()
    if not url or not query:
        return Response(
            {"error": "url and query are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    log_result_click(
        url=url,
        title=title,
        query=query,
        ip=get_client_ip(request.META),
    )
    invalidate_click_signal_cache()
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
    history = (request.data or {}).get("history") or []
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

    use_cache = not bool(history)
    cache_key = normalize_query_key(message)
    if use_cache:
        cached = get_cache_entry(cache_key)
        if cached:
            register_cache_hit()
            provider = str(cached.get("provider") or "unknown")
            register_provider(provider)
            return Response(cached)

    try:
        payload = generate_assistant_response(message, history)
        provider = str(payload.get("provider") or "unknown")
        model = str(payload.get("model") or "unknown")
        helper = str(payload.get("helper") or "general")

        register_provider(provider)
        if provider == "local-fallback" and payload.get("reason"):
            register_provider_error(str(payload.get("reason") or ""))
        if use_cache:
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
