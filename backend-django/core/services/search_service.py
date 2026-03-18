import json
import re
from math import ceil
from datetime import timedelta
from pathlib import Path
from typing import Any

from django.utils import timezone
from django.db.models import Count

from core.models import SearchDocument, SearchSource
from .analytics_service import read_analytics

BASE_DIR = Path(__file__).resolve().parents[2]
SEARCH_INDEX_PATH = BASE_DIR.parent / "data" / "search-index.json"
STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "au",
    "cu",
    "da",
    "de",
    "din",
    "do",
    "for",
    "from",
    "in",
    "la",
    "of",
    "on",
    "or",
    "pe",
    "si",
    "sunt",
    "the",
    "to",
    "un",
    "una",
}
QUERY_SYNONYMS = {
    "ai": ["artificial", "intelligence", "machine", "learning", "llm"],
    "ml": ["machine", "learning"],
    "js": ["javascript"],
    "ux": ["design", "experience"],
    "ui": ["interface", "design"],
    "go": ["golang"],
    "db": ["database"],
}


def _normalize_text(value: str) -> str:
    raw = str(value or "")
    try:
        import unicodedata

        raw = unicodedata.normalize("NFD", raw)
        raw = "".join(ch for ch in raw if unicodedata.category(ch) != "Mn")
    except Exception:
        pass
    return raw.lower()


def detect_query_language(query: str) -> str:
    raw = str(query or "")
    lowered = raw.lower()
    if re.search(r"[ăâîșşțţ]", lowered):
        return "ro"
    romanian_hint_words = {
        "care",
        "poze",
        "imagini",
        "stiri",
        "vreme",
        "azi",
        "maine",
        "cautare",
    }
    words = {word.strip() for word in re.split(r"[^\w]+", lowered) if word.strip()}
    if romanian_hint_words.intersection(words):
        return "ro"
    return "en"


def _normalize_filter_value(value: str | None) -> str:
    return _normalize_text(str(value or "")).strip()


def _document_freshness_bonus(document: SearchDocument) -> int:
    now = timezone.now()
    fetched_at = document.fetched_at or document.indexed_at
    if not fetched_at:
        return 0
    if fetched_at >= now - timedelta(days=3):
        return 4
    if fetched_at >= now - timedelta(days=14):
        return 2
    if fetched_at >= now - timedelta(days=45):
        return 1
    return 0


def _read_search_index() -> list[dict[str, Any]]:
    try:
        content = SEARCH_INDEX_PATH.read_text(encoding="utf-8")
        parsed = json.loads(content)
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
    except Exception:
        pass
    return []


def _safe_limit(limit: int | str | None, default: int = 20) -> int:
    try:
        parsed = int(limit or default)
    except Exception:
        parsed = default
    return max(1, min(50, parsed))


def _safe_offset(offset: int | str | None) -> int:
    try:
        parsed = int(offset or 0)
    except Exception:
        parsed = 0
    return max(0, parsed)


def _build_facets(items: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    language_counts: dict[str, int] = {}
    category_counts: dict[str, int] = {}
    source_counts: dict[str, int] = {}

    for item in items:
        language = str(item.get("language") or "").strip()
        category = str(item.get("category") or "").strip()
        source = str(item.get("sourceName") or item.get("sourceSlug") or "").strip()

        if language:
            language_counts[language] = language_counts.get(language, 0) + 1
        if category:
            category_counts[category] = category_counts.get(category, 0) + 1
        if source:
            source_counts[source] = source_counts.get(source, 0) + 1

    def _to_sorted_entries(counts: dict[str, int]) -> list[dict[str, Any]]:
        return [
            {"value": key, "count": value}
            for key, value in sorted(
                counts.items(),
                key=lambda pair: (-pair[1], pair[0].lower()),
            )
        ]

    return {
        "languages": _to_sorted_entries(language_counts),
        "categories": _to_sorted_entries(category_counts),
        "sources": _to_sorted_entries(source_counts),
    }


def tokenize(query: str) -> list[str]:
    normalized = _normalize_text(query)
    return [
        token.strip()
        for token in re.split(r"[^\w]+", normalized, flags=re.UNICODE)
        if token.strip() and len(token.strip()) >= 2 and token.strip() not in STOPWORDS
    ]


def _expand_query_tokens(tokens: list[str]) -> list[str]:
    seen: set[str] = set()
    expanded: list[str] = []

    for token in tokens:
        candidates = [token, *QUERY_SYNONYMS.get(token, [])]
        if token.endswith("ies") and len(token) > 4:
            candidates.append(f"{token[:-3]}y")
        if token.endswith("ing") and len(token) > 5:
            candidates.append(token[:-3])
        if token.endswith("ed") and len(token) > 4:
            candidates.append(token[:-2])
        if token.endswith("es") and len(token) > 4:
            candidates.append(token[:-2])
        if token.endswith("s") and len(token) > 3:
            candidates.append(token[:-1])

        for candidate in candidates:
            clean = _normalize_filter_value(candidate)
            if not clean or clean in STOPWORDS or len(clean) < 2 or clean in seen:
                continue
            seen.add(clean)
            expanded.append(clean)

    return expanded


def _is_one_edit_away(left: str, right: str) -> bool:
    if left == right:
        return False
    if min(len(left), len(right)) < 4 or abs(len(left) - len(right)) > 1:
        return False

    left_index = 0
    right_index = 0
    edits = 0
    while left_index < len(left) and right_index < len(right):
        if left[left_index] == right[right_index]:
            left_index += 1
            right_index += 1
            continue
        edits += 1
        if edits > 1:
            return False
        if len(left) > len(right):
            left_index += 1
        elif len(right) > len(left):
            right_index += 1
        else:
            left_index += 1
            right_index += 1

    if left_index < len(left) or right_index < len(right):
        edits += 1
    return edits <= 1


def _score_token_against_field(
    token: str,
    field_tokens: list[str],
    *,
    exact: int,
    prefix: int,
    substring: int,
    fuzzy: int,
) -> int:
    if any(candidate == token for candidate in field_tokens):
        return exact
    if any(
        candidate != token and (candidate.startswith(token) or token.startswith(candidate))
        for candidate in field_tokens
    ):
        return prefix
    if any(_is_one_edit_away(token, candidate) for candidate in field_tokens):
        return fuzzy
    if any(
        len(candidate) > len(token) and token in candidate for candidate in field_tokens
    ):
        return substring
    return 0


def compute_score(doc: dict[str, Any], tokens: list[str], raw_query: str = "") -> int:
    if not tokens:
        return 0

    expanded_tokens = _expand_query_tokens(tokens)
    title_tokens = tokenize(str(doc.get("title", "")))
    summary_tokens = tokenize(str(doc.get("summary", "")))
    category_tokens = tokenize(str(doc.get("category", "")))
    url_tokens = tokenize(
        str(doc.get("url", "")).replace("https://", "").replace("http://", "")
    )
    raw_tags = doc.get("tags")
    tags: list[str] = []
    if isinstance(raw_tags, list):
        for tag in raw_tags:
            tags.extend(tokenize(str(tag or "")))

    normalized_title = _normalize_text(str(doc.get("title", "")))
    normalized_summary = _normalize_text(str(doc.get("summary", "")))
    normalized_query = _normalize_text(raw_query).strip()

    score = 0

    for token in expanded_tokens:
        score += _score_token_against_field(
            token,
            title_tokens,
            exact=6,
            prefix=3,
            substring=1,
            fuzzy=2,
        )
        score += _score_token_against_field(
            token,
            tags,
            exact=4,
            prefix=2,
            substring=1,
            fuzzy=1,
        )
        score += _score_token_against_field(
            token,
            summary_tokens,
            exact=3,
            prefix=1,
            substring=0,
            fuzzy=1,
        )
        score += _score_token_against_field(
            token,
            category_tokens,
            exact=2,
            prefix=1,
            substring=0,
            fuzzy=0,
        )
        score += _score_token_against_field(
            token,
            url_tokens,
            exact=2,
            prefix=1,
            substring=0,
            fuzzy=0,
        )

    if normalized_query and len(normalized_query) >= 4:
        if normalized_query in normalized_title:
            score += 8
        elif normalized_query in normalized_summary:
            score += 4

    if tokens and len(tokens) > 1 and all(
        any(candidate.startswith(token) for candidate in title_tokens)
        for token in tokens
    ):
        score += 5

    return score


def _run_db_search(
    query: str,
    *,
    language: str = "",
    category: str = "",
    source: str = "",
    sort: str = "relevance",
    limit: int = 20,
) -> list[dict[str, Any]]:
    tokens = tokenize(query)
    if not tokens:
        return []

    normalized_language = _normalize_filter_value(language)
    normalized_category = _normalize_filter_value(category)
    normalized_source = _normalize_filter_value(source)
    query_language = detect_query_language(query)

    documents = (
        SearchDocument.objects.filter(status=SearchDocument.STATUS_INDEXED)
        .select_related("source")
        .order_by("-quality_score", "-indexed_at")[:1200]
    )
    ranked_with_score: list[dict[str, Any]] = []

    for document in documents:
        doc_language = _normalize_filter_value(document.language)
        doc_category = _normalize_filter_value(document.category)
        doc_source_name = _normalize_filter_value(
            document.source.name if document.source else ""
        )
        doc_source_slug = _normalize_filter_value(
            document.source.slug if document.source else ""
        )

        if normalized_language and doc_language != normalized_language:
            continue
        if normalized_category and doc_category != normalized_category:
            continue
        if normalized_source and normalized_source not in {
            doc_source_name,
            doc_source_slug,
        }:
            continue

        payload = {
            "title": document.title,
            "summary": document.summary,
            "category": document.category,
            "tags": document.tags,
        }
        score = compute_score(payload, tokens, query)
        if score <= 0:
            continue

        quality_bonus = int(document.quality_score // 10)
        freshness_bonus = _document_freshness_bonus(document)
        language_bonus = 3 if doc_language and doc_language == query_language else 0
        total_score = score + quality_bonus + freshness_bonus + language_bonus
        fetched_at = document.fetched_at or document.indexed_at
        ranked_with_score.append(
            {
                "id": f"db-{document.pk}",
                "title": document.title or document.url,
                "url": document.url,
                "summary": document.summary or document.content[:320],
                "tags": document.tags,
                "category": document.category
                or (document.source.category_hint if document.source else "Web"),
                "language": document.language,
                "sourceName": document.source.name if document.source else "",
                "sourceSlug": document.source.slug if document.source else "",
                "qualityScore": round(float(document.quality_score or 0), 2),
                "fetchedAt": fetched_at.isoformat().replace("+00:00", "Z")
                if fetched_at
                else "",
                "score": total_score,
            }
        )

    normalized_sort = _normalize_filter_value(sort) or "relevance"
    if normalized_sort == "newest":
        ranked_with_score.sort(
            key=lambda item: (
                str(item.get("fetchedAt") or ""),
                int(item.get("score", 0)),
            ),
            reverse=True,
        )
    elif normalized_sort == "quality":
        ranked_with_score.sort(
            key=lambda item: (
                float(item.get("qualityScore", 0)),
                int(item.get("score", 0)),
            ),
            reverse=True,
        )
    else:
        ranked_with_score.sort(
            key=lambda item: int(item.get("score", 0)),
            reverse=True,
        )

    clean: list[dict[str, Any]] = []
    for item in ranked_with_score:
        copy = dict(item)
        copy.pop("score", None)
        clean.append(copy)
    return clean


def _run_local_index_search(
    query: str,
    *,
    language: str = "",
    category: str = "",
    source: str = "",
    sort: str = "relevance",
    limit: int = 20,
) -> list[dict[str, Any]]:
    index = _read_search_index()
    tokens = tokenize(query)
    normalized_language = _normalize_filter_value(language)
    normalized_category = _normalize_filter_value(category)
    normalized_source = _normalize_filter_value(source)
    ranked_with_score: list[dict[str, Any]] = []
    for doc in index:
        doc_category = _normalize_filter_value(str(doc.get("category") or ""))
        doc_language = _normalize_filter_value(str(doc.get("language") or ""))
        doc_source = _normalize_filter_value(str(doc.get("sourceName") or ""))
        if normalized_category and doc_category != normalized_category:
            continue
        if normalized_language and doc_language and doc_language != normalized_language:
            continue
        if normalized_source and normalized_source != doc_source:
            continue

        score = compute_score(doc, tokens, query)
        if score > 0:
            ranked_with_score.append({**doc, "score": score})

    normalized_sort = _normalize_filter_value(sort) or "relevance"
    if normalized_sort == "newest":
        ranked_with_score.sort(
            key=lambda item: (
                str(item.get("fetchedAt") or ""),
                int(item.get("score", 0)),
            ),
            reverse=True,
        )
    elif normalized_sort == "quality":
        ranked_with_score.sort(
            key=lambda item: (
                float(item.get("qualityScore", 0)),
                int(item.get("score", 0)),
            ),
            reverse=True,
        )
    else:
        ranked_with_score.sort(key=lambda item: int(item.get("score", 0)), reverse=True)
    if not ranked_with_score:
        return []

    clean: list[dict[str, Any]] = []
    for item in ranked_with_score:
        copy = dict(item)
        copy.pop("score", None)
        clean.append(copy)
    return clean


def _run_search_all(
    query: str,
    *,
    language: str = "",
    category: str = "",
    source: str = "",
    sort: str = "relevance",
    limit: int = 20,
) -> list[dict[str, Any]]:
    results = _run_db_search(
        query,
        language=language,
        category=category,
        source=source,
        sort=sort,
        limit=limit,
    )
    if results:
        return results

    return _run_local_index_search(
        query,
        language=language,
        category=category,
        source=source,
        sort=sort,
        limit=limit,
    )


def run_search_page(
    query: str,
    *,
    language: str = "",
    category: str = "",
    source: str = "",
    sort: str = "relevance",
    limit: int = 20,
    offset: int = 0,
) -> dict[str, Any]:
    all_results = _run_search_all(
        query,
        language=language,
        category=category,
        source=source,
        sort=sort,
        limit=limit,
    )

    contextual_languages = _run_search_all(
        query,
        language="",
        category=category,
        source=source,
        sort=sort,
        limit=limit,
    )
    contextual_categories = _run_search_all(
        query,
        language=language,
        category="",
        source=source,
        sort=sort,
        limit=limit,
    )
    contextual_sources = _run_search_all(
        query,
        language=language,
        category=category,
        source="",
        sort=sort,
        limit=limit,
    )

    language_facets = _build_facets(contextual_languages).get("languages", [])
    category_facets = _build_facets(contextual_categories).get("categories", [])
    source_facets = _build_facets(contextual_sources).get("sources", [])

    safe_limit = _safe_limit(limit)
    safe_offset = _safe_offset(offset)
    total = len(all_results)
    paged_results = all_results[safe_offset : safe_offset + safe_limit]
    total_pages = ceil(total / safe_limit) if total else 0
    current_page = (safe_offset // safe_limit) + 1 if total else 1

    return {
        "results": paged_results,
        "total": total,
        "limit": safe_limit,
        "offset": safe_offset,
        "page": current_page,
        "totalPages": total_pages,
        "hasNextPage": safe_offset + safe_limit < total,
        "hasPrevPage": safe_offset > 0,
        "facets": {
            "languages": language_facets,
            "categories": category_facets,
            "sources": source_facets,
        },
    }


def run_search(
    query: str,
    *,
    language: str = "",
    category: str = "",
    source: str = "",
    sort: str = "relevance",
    limit: int = 20,
    offset: int = 0,
) -> list[dict[str, Any]]:
    payload = run_search_page(
        query,
        language=language,
        category=category,
        source=source,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return payload["results"]


def get_search_sources(*, query: str = "", limit: int = 20) -> list[dict[str, Any]]:
    normalized_query = _normalize_filter_value(query)
    safe_limit = max(1, min(100, int(limit or 20)))

    base_queryset = (
        SearchSource.objects.filter(is_active=True)
        .annotate(indexed_count=Count("documents"))
        .order_by("-indexed_count", "name")
    )

    if normalized_query:
        filtered = []
        for source in base_queryset:
            slug = _normalize_filter_value(source.slug)
            name = _normalize_filter_value(source.name)
            if normalized_query in slug or normalized_query in name:
                filtered.append(source)
        queryset = filtered
    else:
        queryset = list(base_queryset)

    return [
        {
            "slug": source.slug,
            "name": source.name,
            "indexedCount": int(getattr(source, "indexed_count", 0) or 0),
            "languageHint": source.language_hint,
            "categoryHint": source.category_hint,
        }
        for source in queryset[:safe_limit]
    ]


def _get_popular_query_suggestions(partial: str, limit: int) -> list[dict[str, Any]]:
    normalized_partial = _normalize_filter_value(partial)
    if not normalized_partial:
        return []

    analytics = read_analytics()
    searches = list(analytics.get("searches") or [])
    stats: dict[str, dict[str, int]] = {}

    for item in searches:
        query = str(item.get("query") or "").strip()
        normalized = _normalize_filter_value(query)
        if not normalized or len(normalized) < 2:
            continue
        if normalized_partial not in normalized:
            continue

        result_count = int(item.get("resultCount") or 0)
        current = stats.get(query) or {
            "hits": 0,
            "positive_hits": 0,
        }
        current["hits"] += 1
        if result_count > 0:
            current["positive_hits"] += 1
        stats[query] = current

    ranked = sorted(
        [
            {
                "value": query,
                "score": int(item["positive_hits"] * 2 + item["hits"]),
                "source": "analytics",
            }
            for query, item in stats.items()
            if item["positive_hits"] > 0
        ],
        key=lambda item: (-int(item["score"]), str(item["value"]).lower()),
    )
    return ranked[:limit]


def _get_index_query_suggestions(partial: str, limit: int) -> list[dict[str, Any]]:
    normalized_partial = _normalize_filter_value(partial)
    if not normalized_partial:
        return []

    index = _read_search_index()
    suggestions: dict[str, dict[str, Any]] = {}

    for doc in index:
        title = str(doc.get("title") or "").strip()
        normalized_title = _normalize_filter_value(title)
        if not title or normalized_partial not in normalized_title:
            continue

        key = normalized_title
        current = suggestions.get(key)
        if current:
            current["score"] = int(current["score"]) + 3
        else:
            suggestions[key] = {
                "value": title,
                "score": 3,
                "source": "index-title",
            }

        if len(suggestions) >= limit * 2:
            break

    for doc in index:
        if len(suggestions) >= limit * 3:
            break

        for token in tokenize(str(doc.get("title") or "")):
            if len(token) < 3 or not token.startswith(normalized_partial):
                continue

            key = _normalize_filter_value(token)
            if key in suggestions:
                continue

            suggestions[key] = {
                "value": token,
                "score": 2,
                "source": "index-token",
            }

            if len(suggestions) >= limit * 3:
                break

    ranked = sorted(
        suggestions.values(),
        key=lambda item: (-int(item["score"]), str(item["value"]).lower()),
    )
    return ranked[:limit]


def get_search_suggestions(*, partial: str, limit: int = 10) -> list[str]:
    normalized_partial = _normalize_filter_value(partial)
    if len(normalized_partial) < 2:
        return []

    safe_limit = max(1, min(20, int(limit or 10)))
    merged: dict[str, dict[str, Any]] = {}

    for item in _get_popular_query_suggestions(partial, safe_limit):
        key = _normalize_filter_value(item.get("value") or "")
        if not key:
            continue
        merged[key] = {
            "value": str(item.get("value") or "").strip(),
            "score": int(item.get("score") or 0),
        }

    for item in _get_index_query_suggestions(partial, safe_limit):
        key = _normalize_filter_value(item.get("value") or "")
        if not key:
            continue

        existing = merged.get(key)
        if existing:
            existing["score"] = int(existing["score"]) + int(item.get("score") or 0)
        else:
            merged[key] = {
                "value": str(item.get("value") or "").strip(),
                "score": int(item.get("score") or 0),
            }

    ranked = sorted(
        merged.values(),
        key=lambda item: (-int(item["score"]), str(item["value"]).lower()),
    )
    return [str(item["value"]) for item in ranked[:safe_limit]]
