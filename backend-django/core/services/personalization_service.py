import hashlib
import time
from collections import Counter
from typing import Any
from urllib.parse import urlparse

from .analytics_service import read_analytics

PROFILE_CACHE_TTL_SECONDS = 60
MIN_PERSONALIZATION_CLICKS = 2
MAX_DOMAIN_BONUS = 1.4
MAX_CATEGORY_BONUS = 0.7
MAX_SOURCE_BONUS = 0.5
MAX_TOTAL_BONUS = 2.2

_PROFILE_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}


def _normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def _normalize_domain(url: str) -> str:
    raw = _normalize_text(url)
    if not raw:
        return ""
    candidate = raw if raw.startswith(("http://", "https://")) else f"https://{raw}"
    try:
        return _normalize_text(urlparse(candidate).netloc)
    except Exception:
        return ""


def resolve_user_hash(*, explicit_user_id: str = "", session_key: str = "", ip: str = "") -> str:
    raw = explicit_user_id.strip() or session_key.strip() or ip.strip() or "anonymous"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def build_personalization_profile(user_hash: str) -> dict[str, Any]:
    normalized_user_hash = _normalize_text(user_hash)
    if not normalized_user_hash:
        return {
            "enabled": False,
            "clickCount": 0,
            "preferredDomains": [],
            "preferredCategories": [],
            "preferredSources": [],
        }

    cached = _PROFILE_CACHE.get(normalized_user_hash)
    now = time.time()
    if cached and (now - cached[0]) < PROFILE_CACHE_TTL_SECONDS:
        return cached[1]

    analytics = read_analytics()
    result_clicks = list(analytics.get("resultClicks") or [])
    user_clicks = [
        item for item in result_clicks
        if _normalize_text(item.get("userHash")) == normalized_user_hash
    ]

    domain_counts = Counter(
        domain
        for domain in (_normalize_domain(str(item.get("url") or "")) for item in user_clicks)
        if domain
    )
    category_counts = Counter(
        category
        for category in (_normalize_text(item.get("category")) for item in user_clicks)
        if category
    )
    source_counts = Counter(
        source
        for source in (_normalize_text(item.get("sourceSlug") or item.get("sourceName")) for item in user_clicks)
        if source
    )

    profile = {
        "enabled": len(user_clicks) >= MIN_PERSONALIZATION_CLICKS,
        "clickCount": len(user_clicks),
        "preferredDomains": domain_counts.most_common(5),
        "preferredCategories": category_counts.most_common(5),
        "preferredSources": source_counts.most_common(5),
    }
    _PROFILE_CACHE[normalized_user_hash] = (now, profile)
    return profile


def invalidate_personalization_profile_cache(user_hash: str = "") -> None:
    if user_hash:
        _PROFILE_CACHE.pop(_normalize_text(user_hash), None)
        return
    _PROFILE_CACHE.clear()


def _compute_personalization_bonus(item: dict[str, Any], profile: dict[str, Any]) -> float:
    domain = _normalize_domain(str(item.get("url") or ""))
    category = _normalize_text(item.get("category"))
    source = _normalize_text(item.get("sourceSlug") or item.get("sourceName"))

    domain_map = dict(profile.get("preferredDomains") or [])
    category_map = dict(profile.get("preferredCategories") or [])
    source_map = dict(profile.get("preferredSources") or [])

    domain_bonus = min(MAX_DOMAIN_BONUS, float(domain_map.get(domain, 0)) * 0.35)
    category_bonus = min(MAX_CATEGORY_BONUS, float(category_map.get(category, 0)) * 0.25)
    source_bonus = min(MAX_SOURCE_BONUS, float(source_map.get(source, 0)) * 0.2)
    return round(min(MAX_TOTAL_BONUS, domain_bonus + category_bonus + source_bonus), 3)


def apply_personalization(results: list[dict[str, Any]], *, user_hash: str, query: str = "") -> list[dict[str, Any]]:
    if not results:
        return results

    profile = build_personalization_profile(user_hash)
    if not profile.get("enabled"):
        return results

    enriched: list[tuple[float, dict[str, Any]]] = []
    for item in results:
        bonus = _compute_personalization_bonus(item, profile)
        enriched.append((bonus, dict(item)))

    enriched.sort(key=lambda entry: entry[0], reverse=True)
    return [item for _bonus, item in enriched]


def build_personalization_stats(*, limit_users: int = 10) -> dict[str, Any]:
    analytics = read_analytics()
    searches = list(analytics.get("searches") or [])
    clicks = list(analytics.get("resultClicks") or [])

    safe_limit = max(1, min(50, int(limit_users or 10)))

    user_clicks: dict[str, int] = {}
    user_searches: dict[str, int] = {}
    domain_counts = Counter()
    category_counts = Counter()
    source_counts = Counter()

    for search in searches:
        user_hash = _normalize_text(search.get("userHash"))
        if not user_hash:
            continue
        user_searches[user_hash] = user_searches.get(user_hash, 0) + 1

    for click in clicks:
        user_hash = _normalize_text(click.get("userHash"))
        if user_hash:
            user_clicks[user_hash] = user_clicks.get(user_hash, 0) + 1

        domain = _normalize_domain(str(click.get("url") or ""))
        if domain:
            domain_counts[domain] += 1

        category = _normalize_text(click.get("category"))
        if category:
            category_counts[category] += 1

        source = _normalize_text(click.get("sourceSlug") or click.get("sourceName"))
        if source:
            source_counts[source] += 1

    eligible_users = [user_hash for user_hash, count in user_clicks.items() if count >= MIN_PERSONALIZATION_CLICKS]
    avg_clicks_per_eligible = (
        round(sum(user_clicks[user_hash] for user_hash in eligible_users) / len(eligible_users), 2)
        if eligible_users
        else 0.0
    )

    top_users = sorted(
        user_clicks.items(),
        key=lambda item: item[1],
        reverse=True,
    )[:safe_limit]

    return {
        "summary": {
            "searchEvents": len(searches),
            "clickEvents": len(clicks),
            "uniqueUsersWithSearch": len(user_searches),
            "uniqueUsersWithClicks": len(user_clicks),
            "eligibleUsers": len(eligible_users),
            "minClicksForPersonalization": MIN_PERSONALIZATION_CLICKS,
            "avgClicksPerEligibleUser": avg_clicks_per_eligible,
        },
        "topDomains": [{"domain": domain, "count": count} for domain, count in domain_counts.most_common(safe_limit)],
        "topCategories": [{"category": category, "count": count} for category, count in category_counts.most_common(safe_limit)],
        "topSources": [{"source": source, "count": count} for source, count in source_counts.most_common(safe_limit)],
        "topUsers": [
            {
                "userHash": user_hash,
                "clickCount": int(click_count),
                "searchCount": int(user_searches.get(user_hash, 0)),
                "eligible": click_count >= MIN_PERSONALIZATION_CLICKS,
            }
            for user_hash, click_count in top_users
        ],
    }
