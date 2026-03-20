import json
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR.parent / "data"
ANALYTICS_PATH = DATA_DIR / "analytics.json"
RESULT_CLICK_DEDUP_SECONDS = 20
SEARCH_REFORMULATION_WINDOW_SECONDS = 10 * 60


def _ensure_files() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not ANALYTICS_PATH.exists():
        ANALYTICS_PATH.write_text(
            json.dumps({"searches": [], "pageViews": [], "resultClicks": []}, indent=2),
            encoding="utf-8",
        )


def read_analytics() -> dict[str, Any]:
    _ensure_files()
    try:
        return json.loads(ANALYTICS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"searches": [], "pageViews": [], "resultClicks": []}


def write_analytics(data: dict[str, Any]) -> None:
    _ensure_files()
    ANALYTICS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _trim_list(items: list[dict[str, Any]], max_size: int) -> list[dict[str, Any]]:
    if len(items) <= max_size:
        return items
    return items[-max_size:]


def _normalize_text(value: str) -> str:
    return str(value or "").strip().lower()


def _normalize_index_url(url: str) -> str:
    raw = str(url or "").strip()
    if not raw:
        return ""
    try:
        parsed = urlparse(raw)
    except Exception:
        return _normalize_text(raw).rstrip("/")

    host = _normalize_text(parsed.hostname or "")
    path = _normalize_text(parsed.path or "")
    if not host:
        return _normalize_text(raw).rstrip("/")
    return f"{host}{path}".rstrip("/")


def _parse_timestamp_ms(value: str) -> int | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    except Exception:
        return None


def _detect_reformulation(
    searches: list[dict[str, Any]],
    *,
    normalized_query: str,
    ip: str,
    now_ms: int,
) -> tuple[str | None, str | None]:
    if not normalized_query:
        return None, None

    for item in reversed(searches):
        existing_ip = str(item.get("ip") or "unknown").strip()
        if existing_ip != ip:
            continue

        existing_ms = _parse_timestamp_ms(str(item.get("at") or ""))
        if existing_ms is None:
            continue
        if now_ms - existing_ms > SEARCH_REFORMULATION_WINDOW_SECONDS * 1000:
            break

        previous_query = _normalize_text(str(item.get("query") or ""))
        if not previous_query or previous_query == normalized_query:
            continue

        previous_result_count = int(item.get("resultCount") or 0)
        if previous_result_count == 0:
            return str(item.get("id") or "") or None, "zero-results-refinement"
        if previous_result_count <= 2:
            return str(item.get("id") or "") or None, "low-results-refinement"
        return str(item.get("id") or "") or None, "query-refinement"

    return None, None


def log_search(*, query: str, result_count: int, ip: str) -> None:
    analytics = read_analytics()
    searches = list(analytics.get("searches") or [])
    normalized_query = _normalize_text(query)
    normalized_ip = str(ip or "unknown").strip()
    now_ms = int(time.time() * 1000)
    reformulates_search_id, reformulation_type = _detect_reformulation(
        searches,
        normalized_query=normalized_query,
        ip=normalized_ip,
        now_ms=now_ms,
    )
    searches.append(
        {
            "id": f"s-{now_ms}-{random.randint(1000, 9999)}",
            "query": query.strip(),
            "normalizedQuery": normalized_query,
            "resultCount": int(result_count),
            "zeroResults": int(result_count) == 0,
            "ip": normalized_ip,
            "reformulatesSearchId": reformulates_search_id,
            "reformulationType": reformulation_type,
            "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    )
    analytics["searches"] = _trim_list(searches, 10000)
    analytics.setdefault("pageViews", [])
    analytics.setdefault("resultClicks", [])
    write_analytics(analytics)


def log_page_view(*, page: str, ip: str, user_agent: str) -> None:
    analytics = read_analytics()
    page_views = list(analytics.get("pageViews") or [])
    page_views.append(
        {
            "id": f"p-{int(time.time() * 1000)}-{random.randint(1000, 9999)}",
            "page": (page or "unknown").strip() or "unknown",
            "ip": ip or "unknown",
            "userAgent": user_agent or "unknown",
            "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    )
    analytics.setdefault("searches", [])
    analytics.setdefault("resultClicks", [])
    analytics["pageViews"] = _trim_list(page_views, 20000)
    write_analytics(analytics)


def log_result_click(*, url: str, title: str, query: str, ip: str) -> None:
    analytics = read_analytics()
    result_clicks = list(analytics.get("resultClicks") or [])
    normalized_url = _normalize_index_url(url)
    normalized_query = _normalize_text(query)
    normalized_ip = str(ip or "unknown").strip()
    if not normalized_url or not normalized_query:
        return

    now_ms = int(time.time() * 1000)
    for existing in reversed(result_clicks):
        existing_at = str(existing.get("at") or "")
        try:
            existing_ms = int(time.mktime(time.strptime(existing_at, "%Y-%m-%dT%H:%M:%SZ")) * 1000)
        except Exception:
            try:
                existing_ms = int(time.mktime(time.strptime(existing_at.split(".")[0] + "Z", "%Y-%m-%dT%H:%M:%SZ")) * 1000)
            except Exception:
                continue

        if now_ms - existing_ms > RESULT_CLICK_DEDUP_SECONDS * 1000:
            break

        same_ip = str(existing.get("ip") or "").strip() == normalized_ip
        same_url = _normalize_index_url(str(existing.get("url") or "")) == normalized_url
        same_query = _normalize_text(str(existing.get("query") or "")) == normalized_query
        if same_ip and same_url and same_query:
            return

    result_clicks.append(
        {
            "id": f"c-{int(time.time() * 1000)}-{random.randint(1000, 9999)}",
            "url": normalized_url,
            "title": str(title or "").strip(),
            "query": str(query or "").strip(),
            "ip": normalized_ip,
            "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    )
    analytics.setdefault("searches", [])
    analytics.setdefault("pageViews", [])
    analytics["resultClicks"] = _trim_list(result_clicks, 50000)
    write_analytics(analytics)
