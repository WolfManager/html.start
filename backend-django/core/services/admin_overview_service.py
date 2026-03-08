from datetime import datetime, timedelta, timezone
from typing import Any

from .analytics_service import read_analytics

TREND_DAILY_POINTS = max(7, min(90, int(__import__("os").getenv("TREND_DAILY_POINTS", "14"))))
TREND_WEEKLY_POINTS = max(4, min(104, int(__import__("os").getenv("TREND_WEEKLY_POINTS", "8"))))


def _parse_at(value: Any) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _get_range_ms(range_value: str) -> int | None:
    if range_value == "24h":
        return 24 * 60 * 60 * 1000
    if range_value == "7d":
        return 7 * 24 * 60 * 60 * 1000
    if range_value == "30d":
        return 30 * 24 * 60 * 60 * 1000
    return None


def parse_range_to_since(range_value: str) -> datetime | None:
    range_ms = _get_range_ms(range_value)
    if range_ms is None:
        return None
    return datetime.now(timezone.utc) - timedelta(milliseconds=range_ms)


def filter_by_date_range(items: list[dict[str, Any]], since: datetime | None) -> list[dict[str, Any]]:
    if since is None:
        return items

    out: list[dict[str, Any]] = []
    for item in items:
        at = _parse_at(item.get("at"))
        if at and at >= since:
            out.append(item)
    return out


def _iso_week_data(dt: datetime) -> tuple[int, int]:
    iso = dt.isocalendar()
    return int(iso.year), int(iso.week)


def _day_floor_utc(dt: datetime) -> datetime:
    return datetime(dt.year, dt.month, dt.day, tzinfo=timezone.utc)


def _week_start_utc(dt: datetime) -> datetime:
    weekday = dt.isoweekday()
    return _day_floor_utc(dt) - timedelta(days=weekday - 1)


def build_trend_series(searches: list[dict[str, Any]], page_views: list[dict[str, Any]], mode: str, count: int) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    buckets: list[dict[str, Any]] = []
    bucket_map: dict[str, dict[str, Any]] = {}

    for i in range(count - 1, -1, -1):
        if mode == "daily":
            day = _day_floor_utc(now) - timedelta(days=i)
            key = day.strftime("%Y-%m-%d")
            label = key[5:]
        else:
            week_start = _week_start_utc(_day_floor_utc(now)) - timedelta(days=i * 7)
            year, week = _iso_week_data(week_start)
            key = f"{year}-W{week:02d}"
            label = f"W{week:02d}"

        bucket = {"key": key, "label": label, "searchCount": 0, "pageViewCount": 0}
        buckets.append(bucket)
        bucket_map[key] = bucket

    for item in searches:
        at = _parse_at(item.get("at"))
        if not at:
            continue
        if mode == "daily":
            key = _day_floor_utc(at).strftime("%Y-%m-%d")
        else:
            year, week = _iso_week_data(at)
            key = f"{year}-W{week:02d}"
        if key in bucket_map:
            bucket_map[key]["searchCount"] += 1

    for item in page_views:
        at = _parse_at(item.get("at"))
        if not at:
            continue
        if mode == "daily":
            key = _day_floor_utc(at).strftime("%Y-%m-%d")
        else:
            year, week = _iso_week_data(at)
            key = f"{year}-W{week:02d}"
        if key in bucket_map:
            bucket_map[key]["pageViewCount"] += 1

    return buckets


def _totals_for_items(searches: list[dict[str, Any]], page_views: list[dict[str, Any]]) -> dict[str, int]:
    unique_queries = {
        str(item.get("query") or "").strip().lower()
        for item in searches
        if str(item.get("query") or "").strip()
    }

    return {
        "totalSearches": len(searches),
        "totalPageViews": len(page_views),
        "uniqueQueries": len(unique_queries),
    }


def get_period_comparison(all_searches: list[dict[str, Any]], all_page_views: list[dict[str, Any]], range_value: str) -> dict[str, Any] | None:
    range_ms = _get_range_ms(range_value)
    if not range_ms:
        return None

    now_ms = datetime.now(timezone.utc).timestamp() * 1000
    current_start = now_ms - range_ms
    previous_start = now_ms - (2 * range_ms)
    previous_end = current_start

    def in_current(item: dict[str, Any]) -> bool:
        at = _parse_at(item.get("at"))
        if not at:
            return False
        ms = at.timestamp() * 1000
        return ms >= current_start

    def in_previous(item: dict[str, Any]) -> bool:
        at = _parse_at(item.get("at"))
        if not at:
            return False
        ms = at.timestamp() * 1000
        return previous_start <= ms < previous_end

    current_searches = [item for item in all_searches if in_current(item)]
    current_page_views = [item for item in all_page_views if in_current(item)]
    previous_searches = [item for item in all_searches if in_previous(item)]
    previous_page_views = [item for item in all_page_views if in_previous(item)]

    current_totals = _totals_for_items(current_searches, current_page_views)
    previous_totals = _totals_for_items(previous_searches, previous_page_views)

    def pct_delta(current: int, previous: int) -> float | None:
        if previous == 0:
            return 0 if current == 0 else None
        return round(((current - previous) / previous) * 100, 2)

    return {
        "previousTotals": previous_totals,
        "deltaPercent": {
            "totalSearches": pct_delta(current_totals["totalSearches"], previous_totals["totalSearches"]),
            "totalPageViews": pct_delta(current_totals["totalPageViews"], previous_totals["totalPageViews"]),
            "uniqueQueries": pct_delta(current_totals["uniqueQueries"], previous_totals["uniqueQueries"]),
        },
    }


def build_overview(searches: list[dict[str, Any]], page_views: list[dict[str, Any]]) -> dict[str, Any]:
    query_counts: dict[str, int] = {}
    for item in searches:
        key = str(item.get("query") or "").strip().lower()
        if not key:
            continue
        query_counts[key] = query_counts.get(key, 0) + 1

    total_searches = len(searches)
    top_queries = [
        {
            "query": query,
            "count": count,
            "percent": round((count / total_searches) * 100, 2) if total_searches > 0 else 0,
        }
        for query, count in sorted(query_counts.items(), key=lambda item: item[1], reverse=True)[:10]
    ]

    page_counts: dict[str, int] = {}
    for item in page_views:
        page = str(item.get("page") or "unknown")
        page_counts[page] = page_counts.get(page, 0) + 1

    total_views = len(page_views)
    traffic_by_page = [
        {
            "page": page,
            "count": count,
            "percent": round((count / total_views) * 100, 2) if total_views > 0 else 0,
        }
        for page, count in sorted(page_counts.items(), key=lambda item: item[1], reverse=True)
    ]

    return {
        "totals": {
            "totalSearches": total_searches,
            "totalPageViews": total_views,
            "uniqueQueries": len(query_counts.keys()),
        },
        "topQueries": top_queries,
        "trafficByPage": traffic_by_page,
        "latestSearches": list(reversed(searches[-20:])),
        "trends": {
            "daily": build_trend_series(searches, page_views, "daily", TREND_DAILY_POINTS),
            "weekly": build_trend_series(searches, page_views, "weekly", TREND_WEEKLY_POINTS),
        },
    }


def build_admin_overview(range_value: str) -> dict[str, Any]:
    normalized_range = range_value if range_value in {"all", "24h", "7d", "30d"} else "all"

    analytics = read_analytics()
    all_searches = list(analytics.get("searches") or [])
    all_page_views = list(analytics.get("pageViews") or [])

    since = parse_range_to_since(normalized_range)
    searches = filter_by_date_range(all_searches, since)
    page_views = filter_by_date_range(all_page_views, since)

    overview = build_overview(searches, page_views)
    comparison = get_period_comparison(all_searches, all_page_views, normalized_range)

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "range": normalized_range,
        "comparison": comparison,
        **overview,
    }
