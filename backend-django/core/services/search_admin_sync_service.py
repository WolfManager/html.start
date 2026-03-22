from __future__ import annotations

import os
import threading
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from core.models import SearchDocument

from .index_refresh_service import rebuild_search_index
from .index_status_service import build_index_status_payload
from .search_sync_service import read_django_sync_state, update_django_sync_state


_SYNC_LOCK = threading.Lock()
_SYNC_RUNNING = False


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _iso_or_empty(value: Any) -> str:
    if not value:
        return ""
    if isinstance(value, datetime):
        dt_value = value
    else:
        return str(value)

    if dt_value.tzinfo is None:
        dt_value = dt_value.replace(tzinfo=timezone.utc)
    else:
        dt_value = dt_value.astimezone(timezone.utc)
    return dt_value.isoformat().replace("+00:00", "Z")


def _safe_int(value: Any, default: int) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def _clamp(value: int, lower: int, upper: int) -> int:
    return max(lower, min(upper, value))


def _default_page_size() -> int:
    return _clamp(_safe_int(os.getenv("DJANGO_INDEX_SYNC_PAGE_SIZE", "200"), 200), 1, 500)


def _default_max_pages() -> int:
    return _clamp(_safe_int(os.getenv("DJANGO_INDEX_SYNC_MAX_PAGES", "50"), 50), 1, 300)


def _extract_token(authorization_header: str) -> str:
    header = str(authorization_header or "").strip()
    if not header:
        return ""
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return header


def _resolve_django_auth_token(authorization_header: str) -> str:
    env_token = str(os.getenv("DJANGO_ADMIN_TOKEN", "")).strip()
    if env_token:
        return env_token
    return _extract_token(authorization_header)


def _to_index_doc(document: SearchDocument) -> dict[str, Any]:
    source = document.source
    source_host = ""
    try:
        source_host = (urlparse(str(source.base_url or "")).hostname or "").lower()
    except Exception:
        source_host = ""

    return {
        "id": str(document.pk),
        "url": str(document.url or "").strip(),
        "canonicalUrl": str(document.canonical_url or "").strip() or str(document.url or "").strip(),
        "title": str(document.title or "").strip(),
        "summary": str(document.summary or "").strip(),
        "content": str(document.content or ""),
        "language": str(document.language or "").strip(),
        "category": str(document.category or "").strip(),
        "tags": list(document.tags or []),
        "status": str(document.status or "indexed").strip() or "indexed",
        "qualityScore": float(document.quality_score or 0),
        "crawlDepth": int(document.crawl_depth or 0),
        "fetchedAt": _iso_or_empty(document.fetched_at),
        "indexedAt": _iso_or_empty(document.indexed_at),
        "updatedAt": _iso_or_empty(document.updated_at),
        "sourceId": int(source.pk),
        "sourceSlug": str(source.slug or "").strip(),
        "sourceName": source_host or str(source.name or "").strip(),
    }


def _execute_sync(*, reason: str, max_pages: int, page_size: int) -> dict[str, Any]:
    global _SYNC_RUNNING

    with _SYNC_LOCK:
        if _SYNC_RUNNING:
            raise RuntimeError("A sync operation is already in progress.")
        _SYNC_RUNNING = True

    started_at = _iso_now()
    started_monotonic = datetime.now(timezone.utc)
    previous_state = read_django_sync_state()

    try:
        queryset = SearchDocument.objects.select_related("source").filter(status="indexed")
        django_reported_total = int(queryset.count())

        imported_docs: list[dict[str, Any]] = []
        page_summaries: list[dict[str, Any]] = []

        page = 1
        while page <= max_pages:
            offset = (page - 1) * page_size
            docs = list(queryset.order_by("updated_at", "id")[offset : offset + page_size])
            fetched = len(docs)
            imported_docs.extend(_to_index_doc(doc) for doc in docs)

            has_next_page = (offset + fetched) < django_reported_total
            page_summaries.append(
                {
                    "page": page,
                    "fetched": fetched,
                    "hasNextPage": has_next_page,
                }
            )

            if fetched == 0 or not has_next_page:
                break
            page += 1

        refresh_summary = rebuild_search_index(
            merge_docs=imported_docs,
            create_backup=True,
        )

        latest_updated_since = ""
        for item in reversed(imported_docs):
            updated_at = str(item.get("updatedAt") or "").strip()
            if updated_at:
                latest_updated_since = updated_at
                break

        completed_at = _iso_now()
        watermark = latest_updated_since or str(previous_state.get("updatedSince") or "").strip()
        update_django_sync_state(
            updated_since=watermark,
            last_run_at=started_at,
            last_success_at=completed_at,
            last_error="",
        )

        duration_ms = int((datetime.now(timezone.utc) - started_monotonic).total_seconds() * 1000)

        unique_url_count = len(
            {
                str(item.get("url") or "").strip().lower()
                for item in imported_docs
                if str(item.get("url") or "").strip()
            }
        )

        summary = {
            "durationMs": max(0, duration_ms),
            "reason": reason,
            "source": "all",
            "status": "indexed",
            "updatedSince": "",
            "nextUpdatedSince": watermark,
            "pagesFetched": len(page_summaries),
            "maxPages": max_pages,
            "pageSize": page_size,
            "djangoReportedTotal": django_reported_total,
            "fetchedDocuments": len(imported_docs),
            "importedDocuments": len(imported_docs),
            "uniqueUrlCount": unique_url_count,
            "pageSummaries": page_summaries,
        }

        index_payload = build_index_status_payload().get("index") or {}

        return {
            "summary": summary,
            "refresh": refresh_summary,
            "index": index_payload,
        }
    except Exception as exc:
        update_django_sync_state(
            updated_since=str(previous_state.get("updatedSince") or "").strip(),
            last_run_at=started_at,
            last_success_at=str(previous_state.get("lastSuccessAt") or "").strip(),
            last_error=str(exc),
        )
        raise RuntimeError(str(exc)) from exc
    finally:
        with _SYNC_LOCK:
            _SYNC_RUNNING = False


def execute_seed_sync(*, authorization_header: str) -> dict[str, Any]:
    django_token = _resolve_django_auth_token(authorization_header)
    if not django_token:
        raise ValueError(
            "Missing Django auth token. Set DJANGO_ADMIN_TOKEN or provide Authorization header."
        )

    return _execute_sync(
        reason="seed",
        max_pages=max(5, _default_max_pages()),
        page_size=_default_page_size(),
    )


def execute_crawl_sync(*, authorization_header: str, max_pages_value: Any) -> dict[str, Any]:
    django_token = _resolve_django_auth_token(authorization_header)
    if not django_token:
        raise ValueError(
            "Missing Django auth token. Set DJANGO_ADMIN_TOKEN or provide Authorization header."
        )

    parsed_max_pages = _safe_int(max_pages_value, _default_max_pages())

    return _execute_sync(
        reason="crawl",
        max_pages=_clamp(parsed_max_pages, 1, 300),
        page_size=_default_page_size(),
    )
