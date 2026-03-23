import json
import random
import time
from datetime import datetime, timedelta, timezone
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


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


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


def log_search(
    *,
    query: str,
    result_count: int,
    ip: str,
    user_hash: str = "",
    query_used: str | None = None,
    was_rewritten: bool = False,
    rewrite_rule: dict | None = None,
) -> None:
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
    entry: dict = {
        "id": f"s-{now_ms}-{random.randint(1000, 9999)}",
        "query": query.strip(),
        "normalizedQuery": normalized_query,
        "resultCount": int(result_count),
        "zeroResults": int(result_count) == 0,
        "ip": normalized_ip,
        "userHash": str(user_hash or "").strip(),
        "reformulatesSearchId": reformulates_search_id,
        "reformulationType": reformulation_type,
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    if was_rewritten and query_used and rewrite_rule:
        entry["wasRewritten"] = True
        entry["queryUsed"] = str(query_used).strip()
        entry["rewriteRule"] = {
            "from": str(rewrite_rule.get("from", ""))[:160],
            "to": str(rewrite_rule.get("to", ""))[:160],
            "reason": str(rewrite_rule.get("reason", "configured-rewrite"))[:120],
            "matchType": str(rewrite_rule.get("matchType", "exact"))[:20],
        }
    searches.append(entry)
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


def log_result_click(
    *,
    url: str,
    title: str,
    query: str,
    ip: str,
    user_hash: str = "",
    category: str = "",
    source_slug: str = "",
    source_name: str = "",
) -> None:
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
            "userHash": str(user_hash or "").strip(),
            "category": str(category or "").strip(),
            "sourceSlug": str(source_slug or "").strip(),
            "sourceName": str(source_name or "").strip(),
            "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    )
    analytics.setdefault("searches", [])
    analytics.setdefault("pageViews", [])
    analytics["resultClicks"] = _trim_list(result_clicks, 50000)
    write_analytics(analytics)


def build_overview_payload(range_type: str = "all") -> dict[str, Any]:
    """
    Build comprehensive analytics overview for admin dashboard.

    Args:
        range_type: "all", "24h", "7d", or "30d"

    Returns:
        Dict with overview analytics including totals, top queries, clicked results, trends, etc.
    """
    from datetime import timedelta
    from collections import Counter, defaultdict

    analytics_data = read_analytics()

    # Determine time range
    now = datetime.now(timezone.utc)
    cutoff_time = _get_cutoff_time(now, range_type)

    # Filter events by time range
    searches = _filter_by_time(analytics_data.get("searches", []), cutoff_time)
    page_views = _filter_by_time(analytics_data.get("pageViews", []), cutoff_time)
    result_clicks = _filter_by_time(analytics_data.get("resultClicks", []), cutoff_time)

    # Get previous period for comparison
    prev_cutoff = _get_previous_period_cutoff(cutoff_time, range_type)
    prev_searches = _filter_by_time_range(
        analytics_data.get("searches", []), prev_cutoff, cutoff_time
    )
    prev_page_views = _filter_by_time_range(
        analytics_data.get("pageViews", []), prev_cutoff, cutoff_time
    )
    prev_clicks = _filter_by_time_range(
        analytics_data.get("resultClicks", []), prev_cutoff, cutoff_time
    )

    # Compute metrics
    totals = _compute_totals(searches, page_views, result_clicks)
    prev_totals = _compute_totals(prev_searches, prev_page_views, prev_clicks)

    # Compute comparisons
    deltas = _compute_delta_percent(totals, prev_totals)

    # Get click signal config
    click_signal_config = _get_click_signal_config(cutoff_time)

    # Get top items
    top_queries = _get_top_queries(searches, limit=10)
    top_clicked_results = _get_top_clicked_results(result_clicks, limit=12)
    top_click_pairs = _get_top_click_pairs(result_clicks, searches, limit=12)

    # Get traffic by page
    traffic_by_page = _get_traffic_by_page(page_views, limit=20)

    # Get latest searches
    latest_searches = _get_latest_searches(searches, limit=20)

    # Build trends
    trends = _build_trends(searches, page_views, result_clicks, range_type)

    return {
        "range": range_type,
        "comparison": {
            "previousTotals": prev_totals,
            "deltaPercent": deltas,
        },
        "clickSignalConfig": click_signal_config,
        "clickSignalTelemetry": {},
        "totals": totals,
        "topQueries": top_queries,
        "topClickedResults": top_clicked_results,
        "topClickPairs": top_click_pairs,
        "trafficByPage": traffic_by_page,
        "latestSearches": latest_searches,
        "trends": trends,
    }


def get_popular_searches_payload(*, limit: int = 12, days: int = 7) -> dict[str, Any]:
    safe_limit = max(1, min(50, int(limit or 12)))
    safe_days = max(1, min(365, int(days or 7)))

    searches = _filter_by_time(
        list(read_analytics().get("searches") or []),
        datetime.now(timezone.utc) - timedelta(days=safe_days),
    )

    query_map: dict[str, dict[str, Any]] = {}
    for item in searches:
        query = str(item.get("query") or "").strip()
        normalized = query.lower()
        if len(normalized) < 2:
            continue

        item_time = _parse_timestamp_iso(item.get("at"))
        current = query_map.get(normalized)
        if current is None:
            query_map[normalized] = {
                "query": query,
                "count": 1,
                "lastSeen": item_time,
            }
            continue

        current["count"] = int(current.get("count") or 0) + 1
        if item_time and (current.get("lastSeen") is None or item_time > current["lastSeen"]):
            current["lastSeen"] = item_time
            current["query"] = query

    sorted_queries = sorted(
        query_map.values(),
        key=lambda item: (
            -int(item.get("count") or 0),
            -int((item.get("lastSeen") or datetime.min.replace(tzinfo=timezone.utc)).timestamp()),
            str(item.get("query") or "").lower(),
        ),
    )

    return {
        "ok": True,
        "queries": [str(item.get("query") or "").strip() for item in sorted_queries[:safe_limit]],
        "generatedAt": _iso_now(),
    }


def get_trending_searches_payload(
    *,
    period: str = "weekly",
    limit: int = 10,
    include_zero: bool = False,
    query: str = "",
) -> dict[str, Any]:
    normalized_period = str(period or "weekly").strip().lower()
    if normalized_period not in {"daily", "weekly", "monthly"}:
        normalized_period = "weekly"

    window_days = {
        "daily": 1,
        "weekly": 7,
        "monthly": 30,
    }[normalized_period]
    safe_limit = max(1, min(50, int(limit or 10)))
    normalized_query = str(query or "").strip().lower()
    searches = _filter_by_time(
        list(read_analytics().get("searches") or []),
        datetime.now(timezone.utc) - timedelta(days=window_days),
    )

    top_level_buckets: dict[str, dict[str, Any]] = {}
    query_buckets: dict[str, dict[str, dict[str, int]]] = {}
    query_stats: dict[str, dict[str, Any]] = {}

    for item in searches:
        raw_query = str(item.get("query") or "").strip()
        normalized_item_query = raw_query.lower()
        if len(normalized_item_query) < 2:
            continue
        if normalized_query and normalized_query not in normalized_item_query:
            continue

        item_time = _parse_timestamp_iso(item.get("at"))
        if item_time is None:
            continue

        result_count = int(item.get("resultCount") or 0)
        is_positive = result_count > 0
        if not include_zero and not is_positive:
            continue

        bucket_key = item_time.date().isoformat()
        bucket_entry = top_level_buckets.setdefault(
            bucket_key,
            {
                "bucket": bucket_key,
                "totalSearches": 0,
                "positiveSearches": 0,
                "uniqueQueries": set(),
            },
        )
        bucket_entry["totalSearches"] = int(bucket_entry.get("totalSearches") or 0) + 1
        if is_positive:
            bucket_entry["positiveSearches"] = int(bucket_entry.get("positiveSearches") or 0) + 1
        bucket_entry["uniqueQueries"].add(normalized_item_query)

        current = query_stats.setdefault(
            normalized_item_query,
            {
                "query": raw_query,
                "hits": 0,
                "positiveHits": 0,
                "resultsTotal": 0,
                "firstSeen": item_time,
                "lastSeen": item_time,
            },
        )
        current["hits"] = int(current.get("hits") or 0) + 1
        current["resultsTotal"] = int(current.get("resultsTotal") or 0) + result_count
        if is_positive:
            current["positiveHits"] = int(current.get("positiveHits") or 0) + 1
        if item_time < current["firstSeen"]:
            current["firstSeen"] = item_time
        if item_time > current["lastSeen"]:
            current["lastSeen"] = item_time
            current["query"] = raw_query

        per_query_bucket = query_buckets.setdefault(normalized_item_query, {}).setdefault(
            bucket_key,
            {
                "bucket": bucket_key,
                "count": 0,
                "positiveHits": 0,
            },
        )
        per_query_bucket["count"] = int(per_query_bucket.get("count") or 0) + 1
        if is_positive:
            per_query_bucket["positiveHits"] = int(per_query_bucket.get("positiveHits") or 0) + 1

    ranked_items = []
    for normalized_item_query, stats in query_stats.items():
        hits = int(stats.get("hits") or 0)
        positive_hits = int(stats.get("positiveHits") or 0)
        avg_results = round((int(stats.get("resultsTotal") or 0) / hits), 2) if hits else 0
        ranked_items.append(
            {
                "query": str(stats.get("query") or "").strip(),
                "hits": hits,
                "positiveHits": positive_hits,
                "avgResults": avg_results,
                "firstSeen": stats["firstSeen"].isoformat().replace("+00:00", "Z"),
                "lastSeen": stats["lastSeen"].isoformat().replace("+00:00", "Z"),
                "trendScore": round((hits * 3) + (positive_hits * 1.5) + avg_results, 2),
                "buckets": sorted(
                    query_buckets.get(normalized_item_query, {}).values(),
                    key=lambda bucket: str(bucket.get("bucket") or ""),
                ),
            }
        )

    ranked_items.sort(
        key=lambda item: (
            -int(item.get("hits") or 0),
            -float(item.get("trendScore") or 0),
            str(item.get("query") or "").lower(),
        )
    )

    buckets = []
    for item in sorted(top_level_buckets.values(), key=lambda bucket: str(bucket.get("bucket") or "")):
        buckets.append(
            {
                "bucket": item["bucket"],
                "totalSearches": int(item.get("totalSearches") or 0),
                "positiveSearches": int(item.get("positiveSearches") or 0),
                "uniqueQueries": len(item.get("uniqueQueries") or set()),
            }
        )

    return {
        "ok": True,
        "generatedAt": _iso_now(),
        "period": normalized_period,
        "windowDays": window_days,
        "total": len(ranked_items[:safe_limit]),
        "items": ranked_items[:safe_limit],
        "buckets": buckets,
    }


def _get_cutoff_time(now: datetime, range_type: str) -> datetime:
    """Get cutoff time for the given range type."""
    from datetime import timedelta

    if range_type == "24h":
        return now - timedelta(hours=24)
    elif range_type == "7d":
        return now - timedelta(days=7)
    elif range_type == "30d":
        return now - timedelta(days=30)
    else:  # "all"
        return datetime.min.replace(tzinfo=timezone.utc)


def _get_previous_period_cutoff(cutoff_time: datetime, range_type: str) -> datetime:
    """Get cutoff time for the previous period of same length."""
    from datetime import timedelta

    now = datetime.now(timezone.utc)

    if range_type == "24h":
        period_length = timedelta(hours=24)
    elif range_type == "7d":
        period_length = timedelta(days=7)
    elif range_type == "30d":
        period_length = timedelta(days=30)
    else:  # "all"
        return datetime.min.replace(tzinfo=timezone.utc)

    # Previous period cutoff is 2 * period_length before now
    return now - (2 * period_length)


def _filter_by_time(events: list[dict[str, Any]], cutoff_time: datetime) -> list[dict[str, Any]]:
    """Filter events that occurred after cutoff_time."""
    result = []
    for event in events:
        event_time = _parse_timestamp_iso(event.get("at"))
        if event_time and event_time >= cutoff_time:
            result.append(event)
    return result


def _filter_by_time_range(
    events: list[dict[str, Any]], start_time: datetime, end_time: datetime
) -> list[dict[str, Any]]:
    """Filter events within time range [start_time, end_time)."""
    result = []
    for event in events:
        event_time = _parse_timestamp_iso(event.get("at"))
        if event_time and start_time <= event_time < end_time:
            result.append(event)
    return result


def _parse_timestamp_iso(timestamp_str: str | None) -> datetime | None:
    """Parse ISO timestamp string to datetime."""
    if not timestamp_str:
        return None
    try:
        text = str(timestamp_str).strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return datetime.fromisoformat(text)
    except (ValueError, AttributeError):
        return None


def _compute_totals(
    searches: list[dict[str, Any]],
    page_views: list[dict[str, Any]],
    clicks: list[dict[str, Any]],
) -> dict[str, Any]:
    """Compute aggregate metrics."""
    from collections import Counter

    total_searches = len(searches)
    total_page_views = len(page_views)
    total_clicks = len(clicks)

    # Unique queries and URLs
    unique_queries = set()
    for search in searches:
        query = str(search.get("query") or "").strip().lower()
        if query:
            unique_queries.add(query)

    unique_clicked_urls = set()
    for click in clicks:
        url = str(click.get("url") or "").strip().lower()
        if url:
            unique_clicked_urls.add(url)

    # CTR
    ctr = (total_clicks / total_searches * 100) if total_searches > 0 else 0

    return {
        "totalSearches": total_searches,
        "totalPageViews": total_page_views,
        "uniqueQueries": len(unique_queries),
        "totalResultClicks": total_clicks,
        "uniqueClickedUrls": len(unique_clicked_urls),
        "clickThroughRate": round(ctr, 2),
    }


def _compute_delta_percent(current: dict[str, Any], previous: dict[str, Any]) -> dict[str, Any]:
    """Compute percentage change from previous period."""
    return {
        "totalSearches": _delta_percent(
            current["totalSearches"], previous["totalSearches"]
        ),
        "totalPageViews": _delta_percent(
            current["totalPageViews"], previous["totalPageViews"]
        ),
        "uniqueQueries": _delta_percent(
            current["uniqueQueries"], previous["uniqueQueries"]
        ),
        "totalResultClicks": _delta_percent(
            current["totalResultClicks"], previous["totalResultClicks"]
        ),
    }


def _delta_percent(current: int, previous: int) -> float | None:
    """Compute delta percentage."""
    if previous == 0:
        return None if current == 0 else 100.0
    return round(((current - previous) / previous) * 100, 2)


def _get_click_signal_config(range_start: datetime) -> dict[str, Any]:
    """Get click signal configuration for overview."""
    return {
        "windowDays": 90,
        "decayHalfLifeDays": 30,
        "decayMinWeight": 0.1,
        "maxBoost": 2.0,
        "ctrMaxBoost": 1.5,
        "guardrailMinBaseScore": 0.3,
        "guardrailMaxShare": 0.3,
        "dedupSeconds": 3600,
        "rangeStartAt": range_start.isoformat().replace("+00:00", "Z"),
    }


def _get_top_queries(searches: list[dict[str, Any]], limit: int = 10) -> list[dict[str, Any]]:
    """Get top queries by count."""
    from collections import Counter

    query_counts = Counter()
    for search in searches:
        query = str(search.get("query") or "").strip().lower()
        if query:
            query_counts[query] += 1

    total = sum(query_counts.values())
    result = []
    for query, count in query_counts.most_common(limit):
        result.append({
            "query": query,
            "count": count,
            "percent": round((count / total * 100), 2) if total > 0 else 0,
        })
    return result


def _get_top_clicked_results(clicks: list[dict[str, Any]], limit: int = 12) -> list[dict[str, Any]]:
    """Get top clicked URLs."""
    from collections import defaultdict

    url_data = defaultdict(lambda: {"count": 0, "last_at": None})

    for click in clicks:
        url = str(click.get("url") or "").strip().lower()
        if url:
            url_data[url]["count"] += 1
            click_time = _parse_timestamp_iso(click.get("at"))
            if click_time and (url_data[url]["last_at"] is None or click_time > url_data[url]["last_at"]):
                url_data[url]["last_at"] = click_time
                url_data[url]["title"] = str(click.get("title") or "").strip()
                url_data[url]["last_query"] = str(click.get("query") or "").strip()

    total = sum(item["count"] for item in url_data.values())
    result = []

    # Sort by count descending
    sorted_urls = sorted(url_data.items(), key=lambda x: x[1]["count"], reverse=True)

    for url, data in sorted_urls[:limit]:
        last_at = (
            data["last_at"].isoformat().replace("+00:00", "Z")
            if data["last_at"]
            else ""
        )
        result.append({
            "url": url,
            "title": data.get("title", ""),
            "lastQuery": data.get("last_query", ""),
            "count": data["count"],
            "percent": round((data["count"] / total * 100), 2) if total > 0 else 0,
            "lastAt": last_at,
        })
    return result


def _get_top_click_pairs(
    clicks: list[dict[str, Any]], searches: list[dict[str, Any]], limit: int = 12
) -> list[dict[str, Any]]:
    """Get top query-URL click pairs."""
    from collections import Counter, defaultdict

    pair_data = defaultdict(lambda: {"count": 0, "last_at": None})

    # Count clicks by (query, url) pair
    for click in clicks:
        query = str(click.get("query") or "").strip().lower()
        url = str(click.get("url") or "").strip().lower()
        if query and url:
            key = (query, url)
            pair_data[key]["count"] += 1
            click_time = _parse_timestamp_iso(click.get("at"))
            if click_time and (pair_data[key]["last_at"] is None or click_time > pair_data[key]["last_at"]):
                pair_data[key]["last_at"] = click_time
                pair_data[key]["title"] = str(click.get("title") or "").strip()

    # Count searches by query
    search_counts = Counter()
    for search in searches:
        query = str(search.get("query") or "").strip().lower()
        if query:
            search_counts[query] += 1

    total_clicks = sum(item["count"] for item in pair_data.values())
    result = []

    # Sort by count descending
    sorted_pairs = sorted(pair_data.items(), key=lambda x: x[1]["count"], reverse=True)

    for (query, url), data in sorted_pairs[:limit]:
        query_total = search_counts.get(query, 0)
        ctr_percent = round(
            (data["count"] / query_total * 100), 2
        ) if query_total > 0 else 0
        last_at = (
            data["last_at"].isoformat().replace("+00:00", "Z")
            if data["last_at"]
            else ""
        )
        result.append({
            "query": query,
            "url": url,
            "title": data.get("title", ""),
            "count": data["count"],
            "percent": round((data["count"] / total_clicks * 100), 2) if total_clicks > 0 else 0,
            "queryTotalClicks": query_total,
            "ctrPercent": ctr_percent,
            "lastAt": last_at,
        })
    return result


def _get_traffic_by_page(page_views: list[dict[str, Any]], limit: int = 20) -> list[dict[str, Any]]:
    """Get page view counts by page."""
    from collections import Counter

    page_counts = Counter()
    for pv in page_views:
        page = str(pv.get("page") or "").strip()
        if page:
            page_counts[page] += 1

    total = sum(page_counts.values())
    result = []
    for page, count in page_counts.most_common(limit):
        result.append({
            "page": page,
            "count": count,
            "percent": round((count / total * 100), 2) if total > 0 else 0,
        })
    return result


def _get_latest_searches(searches: list[dict[str, Any]], limit: int = 20) -> list[dict[str, Any]]:
    """Get latest searches."""
    # Sort by timestamp descending
    sorted_searches = sorted(
        searches,
        key=lambda s: _parse_timestamp_iso(s.get("at")) or datetime.min,
        reverse=True,
    )

    result = []
    for search in sorted_searches[:limit]:
        result.append({
            "id": str(search.get("id") or "").strip(),
            "query": str(search.get("query") or "").strip(),
            "resultCount": int(search.get("resultCount") or 0),
            "ip": str(search.get("ip") or "").strip(),
            "at": str(search.get("at") or "").strip(),
        })
    return result


def _build_trends(
    searches: list[dict[str, Any]],
    page_views: list[dict[str, Any]],
    clicks: list[dict[str, Any]],
    range_type: str,
) -> dict[str, Any]:
    """Build daily and weekly trends."""
    if range_type == "all":
        # Can't compute meaningful trends for "all"
        return {"daily": [], "weekly": []}

    # For now, return empty trends (can be extended later)
    return {"daily": [], "weekly": []}
