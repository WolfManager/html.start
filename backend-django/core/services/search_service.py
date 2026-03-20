import json
import math
import re
import time
from math import ceil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from django.utils import timezone
from django.db.models import Count

from core.models import SearchDocument, SearchSource
from .analytics_service import read_analytics

BASE_DIR = Path(__file__).resolve().parents[2]
SEARCH_INDEX_PATH = BASE_DIR.parent / "data" / "search-index.json"
SEARCH_REWRITE_RULES_PATH = BASE_DIR.parent / "data" / "query-rewrite-rules.json"
QUERY_REWRITE_MATCH_TYPES = {"exact", "contains"}
DEFAULT_QUERY_REWRITE_RULES = [
    {
        "enabled": True,
        "matchType": "exact",
        "from": "pythn",
        "to": "python",
        "reason": "common-typo",
    },
    {
        "enabled": True,
        "matchType": "exact",
        "from": "opnai",
        "to": "openai",
        "reason": "common-typo",
    },
]
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
CLICK_SIGNAL_WINDOW_DAYS = 30
CLICK_SIGNAL_CACHE_TTL_SECONDS = 30
CLICK_SIGNAL_MAX_BOOST = 10.0
CLICK_SIGNAL_CTR_MAX_BOOST = 3.0
CLICK_SIGNAL_GUARDRAIL_MIN_BASE_SCORE = 12.0
CLICK_SIGNAL_GUARDRAIL_MAX_SHARE = 0.3
CLICK_SIGNAL_DECAY_HALFLIFE_DAYS = 14
CLICK_SIGNAL_DECAY_MIN_WEIGHT = 0.2

_click_signal_cache: dict[str, Any] = {
    "expiresAt": 0.0,
    "queryUrlCounts": {},
    "queryCounts": {},
    "urlCounts": {},
}


def invalidate_click_signal_cache() -> None:
    _click_signal_cache["expiresAt"] = 0.0
    _click_signal_cache["queryUrlCounts"] = {}
    _click_signal_cache["queryCounts"] = {}
    _click_signal_cache["urlCounts"] = {}


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


def _normalize_index_url(url: str) -> str:
    raw = str(url or "").strip()
    if not raw:
        return ""
    try:
        parsed = urlparse(raw)
    except Exception:
        return _normalize_filter_value(raw).rstrip("/")

    host = _normalize_filter_value(parsed.hostname or "")
    path = _normalize_filter_value(parsed.path or "")
    if not host:
        return _normalize_filter_value(raw).rstrip("/")
    return f"{host}{path}".rstrip("/")


def _build_click_signal_artifacts() -> dict[str, Any]:
    analytics = read_analytics()
    result_clicks = list(analytics.get("resultClicks") or [])

    now = time.time()
    oldest = now - CLICK_SIGNAL_WINDOW_DAYS * 24 * 60 * 60
    half_life = CLICK_SIGNAL_DECAY_HALFLIFE_DAYS * 24 * 60 * 60

    query_url_counts: dict[str, float] = {}
    query_counts: dict[str, float] = {}
    url_counts: dict[str, float] = {}

    for item in result_clicks:
        clicked_at = str(item.get("at") or "")
        try:
            clicked_ts = datetime.fromisoformat(clicked_at.replace("Z", "+00:00")).timestamp()
        except Exception:
            continue

        if clicked_ts < oldest:
            continue

        normalized_url = _normalize_index_url(str(item.get("url") or ""))
        normalized_query = _normalize_filter_value(str(item.get("query") or ""))
        if not normalized_url or not normalized_query:
            continue

        age_seconds = max(0.0, now - clicked_ts)
        decay_weight = max(
            CLICK_SIGNAL_DECAY_MIN_WEIGHT,
            math.pow(0.5, age_seconds / max(1.0, half_life)),
        )

        query_url_key = f"{normalized_query}||{normalized_url}"
        query_url_counts[query_url_key] = query_url_counts.get(query_url_key, 0.0) + decay_weight
        query_counts[normalized_query] = query_counts.get(normalized_query, 0.0) + decay_weight
        url_counts[normalized_url] = url_counts.get(normalized_url, 0.0) + decay_weight

    return {
        "queryUrlCounts": query_url_counts,
        "queryCounts": query_counts,
        "urlCounts": url_counts,
    }


def _get_click_signal_artifacts() -> dict[str, Any]:
    now = time.time()
    if now < float(_click_signal_cache.get("expiresAt") or 0):
        return _click_signal_cache

    built = _build_click_signal_artifacts()
    _click_signal_cache["queryUrlCounts"] = built["queryUrlCounts"]
    _click_signal_cache["queryCounts"] = built["queryCounts"]
    _click_signal_cache["urlCounts"] = built["urlCounts"]
    _click_signal_cache["expiresAt"] = now + CLICK_SIGNAL_CACHE_TTL_SECONDS
    return _click_signal_cache


def _get_result_click_boost(*, url: str, query: str, base_score: float) -> float:
    normalized_url = _normalize_index_url(url)
    normalized_query = _normalize_filter_value(query)
    if not normalized_url or not normalized_query:
        return 0.0

    safe_base_score = float(base_score or 0)
    if safe_base_score < CLICK_SIGNAL_GUARDRAIL_MIN_BASE_SCORE:
        return 0.0

    artifacts = _get_click_signal_artifacts()
    query_url_key = f"{normalized_query}||{normalized_url}"

    exact_pair_clicks = float((artifacts.get("queryUrlCounts") or {}).get(query_url_key, 0.0) or 0.0)
    query_clicks = float((artifacts.get("queryCounts") or {}).get(normalized_query, 0.0) or 0.0)
    url_clicks = float((artifacts.get("urlCounts") or {}).get(normalized_url, 0.0) or 0.0)
    if exact_pair_clicks <= 0 and query_clicks <= 0 and url_clicks <= 0:
        return 0.0

    pair_boost = math.log2(1 + exact_pair_clicks) * 2.5
    url_boost = math.log2(1 + url_clicks) * 0.8
    ctr = exact_pair_clicks / query_clicks if query_clicks > 0 else 0.0
    ctr_boost = min(CLICK_SIGNAL_CTR_MAX_BOOST, ctr * CLICK_SIGNAL_CTR_MAX_BOOST)
    uncapped_boost = pair_boost + url_boost + ctr_boost
    max_by_base = safe_base_score * CLICK_SIGNAL_GUARDRAIL_MAX_SHARE

    return max(0.0, min(CLICK_SIGNAL_MAX_BOOST, uncapped_boost, max_by_base))


def _normalize_domain_token(value: str) -> str:
    token = _normalize_filter_value(value)
    token = token.replace("http://", "").replace("https://", "")
    return token.strip("/ ")


def _copy_query_rewrite_rules(rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [dict(rule) for rule in rules]


def normalize_query_rewrite_rules(value: Any) -> list[dict[str, Any]]:
    rules = value.get("rules") if isinstance(value, dict) else value
    if not isinstance(rules, list):
        raise ValueError("Rewrite rules payload must be a list or an object with a rules list.")

    normalized_rules: list[dict[str, Any]] = []
    for index, item in enumerate(rules, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Rule {index} must be an object.")

        match_type = _normalize_filter_value(str(item.get("matchType") or "exact")) or "exact"
        if match_type not in QUERY_REWRITE_MATCH_TYPES:
            raise ValueError(f"Rule {index} has invalid matchType. Use exact or contains.")

        source = str(item.get("from") or "").strip()
        target = str(item.get("to") or "").strip()
        reason = str(item.get("reason") or "configured-rewrite").strip() or "configured-rewrite"
        if not source:
            raise ValueError(f"Rule {index} is missing a from value.")
        if not target:
            raise ValueError(f"Rule {index} is missing a to value.")
        if len(source) > 160 or len(target) > 160:
            raise ValueError(f"Rule {index} from/to values must be 160 characters or fewer.")
        if len(reason) > 120:
            raise ValueError(f"Rule {index} reason must be 120 characters or fewer.")
        if _normalize_filter_value(source) == _normalize_filter_value(target):
            raise ValueError(f"Rule {index} must change the query.")

        normalized_rules.append(
            {
                "enabled": bool(item.get("enabled", True)),
                "matchType": match_type,
                "from": source,
                "to": target,
                "reason": reason,
            }
        )

    return normalized_rules


def get_default_query_rewrite_rules() -> list[dict[str, Any]]:
    return _copy_query_rewrite_rules(DEFAULT_QUERY_REWRITE_RULES)


def get_query_rewrite_rules() -> list[dict[str, Any]]:
    try:
        content = SEARCH_REWRITE_RULES_PATH.read_text(encoding="utf-8")
        parsed = json.loads(content)
        return normalize_query_rewrite_rules(parsed)
    except FileNotFoundError:
        return []
    except ValueError:
        return []
    except Exception:
        return []


def write_query_rewrite_rules(value: Any) -> list[dict[str, Any]]:
    normalized_rules = normalize_query_rewrite_rules(value)
    SEARCH_REWRITE_RULES_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {"rules": normalized_rules}
    temp_path = SEARCH_REWRITE_RULES_PATH.with_suffix(".json.tmp")
    temp_path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")
    temp_path.replace(SEARCH_REWRITE_RULES_PATH)
    return _copy_query_rewrite_rules(normalized_rules)


def reset_query_rewrite_rules() -> list[dict[str, Any]]:
    return write_query_rewrite_rules(get_default_query_rewrite_rules())


def _read_query_rewrite_rules() -> list[dict[str, Any]]:
    return get_query_rewrite_rules()


def _apply_query_rewrite_rules(query: str) -> tuple[str, dict[str, Any] | None]:
    original_query = str(query or "").strip()
    if not original_query:
        return "", None

    normalized_query = _normalize_filter_value(original_query)
    for rule in _read_query_rewrite_rules():
        if rule.get("enabled", True) is False:
            continue

        match_type = _normalize_filter_value(str(rule.get("matchType") or "exact")) or "exact"
        source = str(rule.get("from") or "").strip()
        target = str(rule.get("to") or "").strip()
        if not source or not target:
            continue

        normalized_source = _normalize_filter_value(source)
        rewritten_query = None

        if match_type == "exact":
            if normalized_query == normalized_source:
                rewritten_query = target
        elif match_type == "contains":
            if normalized_source and normalized_source in normalized_query:
                rewritten_query = re.sub(
                    re.escape(source),
                    target,
                    original_query,
                    flags=re.IGNORECASE,
                )

        if rewritten_query and rewritten_query.strip() and rewritten_query.strip() != original_query:
            return rewritten_query.strip(), {
                "matchType": match_type,
                "from": source,
                "to": target,
                "reason": str(rule.get("reason") or "configured-rewrite").strip() or "configured-rewrite",
            }

    return original_query, None


def _parse_search_operators(query: str) -> tuple[str, dict[str, list[str]]]:
    raw = str(query or "")
    operators: dict[str, list[str]] = {
        "sites": [],
        "excluded_sites": [],
        "filetypes": [],
        "inurl": [],
        "intitle": [],
    }

    def _capture(pattern: str, key: str, normalizer=None) -> None:
        nonlocal raw
        regex = re.compile(pattern, re.IGNORECASE)

        def _replace(match: re.Match[str]) -> str:
            value = str(match.group(1) or "").strip()
            if normalizer:
                value = normalizer(value)
            else:
                value = _normalize_filter_value(value)
            if value:
                operators[key].append(value)
            return " "

        raw = regex.sub(_replace, raw)

    _capture(r"(?:^|\s)site:([^\s\"']+)", "sites", _normalize_domain_token)
    _capture(r"(?:^|\s)-site:([^\s\"']+)", "excluded_sites", _normalize_domain_token)
    _capture(
        r"(?:^|\s)filetype:([^\s\"']+)",
        "filetypes",
        lambda value: _normalize_filter_value(value).lstrip("."),
    )
    _capture(r"\binurl:([^\s\"']+)", "inurl", _normalize_filter_value)
    _capture(r"\bintitle:([^\s\"']+)", "intitle", _normalize_filter_value)

    cleaned = " ".join(raw.split()).strip()
    return cleaned, operators


def _has_operator_constraints(operators: dict[str, list[str]]) -> bool:
    return any(bool(values) for values in operators.values())


def _doc_matches_site_operator(url: str, operators: dict[str, list[str]]) -> bool:
    required_sites = operators.get("sites") or []
    if not required_sites:
        return True
    try:
        hostname = _normalize_domain_token(urlparse(url).hostname or "")
    except Exception:
        hostname = ""
    if not hostname:
        return False
    for site in required_sites:
        if hostname == site or hostname.endswith(f".{site}"):
            return True
    return False


def _doc_matches_excluded_site_operator(url: str, operators: dict[str, list[str]]) -> bool:
    excluded_sites = operators.get("excluded_sites") or []
    if not excluded_sites:
        return True
    try:
        hostname = _normalize_domain_token(urlparse(url).hostname or "")
    except Exception:
        hostname = ""
    if not hostname:
        return True
    for site in excluded_sites:
        if hostname == site or hostname.endswith(f".{site}"):
            return False
    return True


def _doc_matches_filetype_operator(url: str, operators: dict[str, list[str]]) -> bool:
    filetypes = operators.get("filetypes") or []
    if not filetypes:
        return True
    try:
        path = _normalize_filter_value(urlparse(url).path or "")
    except Exception:
        path = ""
    if not path:
        return False
    return any(path.endswith(f".{filetype}") for filetype in filetypes)


def _doc_matches_inurl_operator(url: str, operators: dict[str, list[str]]) -> bool:
    inurl_terms = operators.get("inurl") or []
    if not inurl_terms:
        return True
    normalized_url = _normalize_filter_value(url)
    return all(term in normalized_url for term in inurl_terms)


def _doc_matches_intitle_operator(title: str, operators: dict[str, list[str]]) -> bool:
    intitle_terms = operators.get("intitle") or []
    if not intitle_terms:
        return True
    normalized_title = _normalize_filter_value(title)
    return all(term in normalized_title for term in intitle_terms)


def _doc_matches_query_operators(doc: dict[str, Any], operators: dict[str, list[str]]) -> bool:
    url = str(doc.get("url") or "")
    title = str(doc.get("title") or "")
    return (
        _doc_matches_site_operator(url, operators)
        and _doc_matches_excluded_site_operator(url, operators)
        and _doc_matches_filetype_operator(url, operators)
        and _doc_matches_inurl_operator(url, operators)
        and _doc_matches_intitle_operator(title, operators)
    )


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


def _source_authority_bonus(document: SearchDocument) -> float:
    source = document.source
    if not source:
        return 0.0
    quality_score = float(getattr(source, "quality_score", 0) or 0)
    normalized = max(0.0, min(100.0, quality_score)) / 100.0
    # Keep authority influence meaningful but bounded so lexical relevance remains primary.
    return round(normalized * 3.0, 3)


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
    parsed_query, operators = _parse_search_operators(query)
    tokens = tokenize(parsed_query)
    if not tokens and not _has_operator_constraints(operators):
        return []

    normalized_language = _normalize_filter_value(language)
    normalized_category = _normalize_filter_value(category)
    normalized_source = _normalize_filter_value(source)
    normalized_sort = _normalize_filter_value(sort) or "relevance"
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
            "url": document.url,
        }
        if not _doc_matches_query_operators(payload, operators):
            continue

        score = compute_score(payload, tokens, parsed_query) if tokens else 1
        if tokens and score <= 0:
            continue

        quality_bonus = int(document.quality_score // 10)
        freshness_bonus = _document_freshness_bonus(document)
        language_bonus = 3 if doc_language and doc_language == query_language else 0
        authority_bonus = _source_authority_bonus(document)
        click_boost = (
            _get_result_click_boost(
                url=document.url,
                query=parsed_query,
                base_score=score,
            )
            if normalized_sort == "relevance"
            else 0.0
        )
        total_score = (
            score
            + quality_bonus
            + freshness_bonus
            + language_bonus
            + authority_bonus
            + click_boost
        )
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

    if normalized_sort == "newest":
        ranked_with_score.sort(
            key=lambda item: (
                str(item.get("fetchedAt") or ""),
                float(item.get("score", 0)),
            ),
            reverse=True,
        )
    elif normalized_sort == "quality":
        ranked_with_score.sort(
            key=lambda item: (
                float(item.get("qualityScore", 0)),
                float(item.get("score", 0)),
            ),
            reverse=True,
        )
    else:
        ranked_with_score.sort(
            key=lambda item: float(item.get("score", 0)),
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
    parsed_query, operators = _parse_search_operators(query)
    tokens = tokenize(parsed_query)
    if not tokens and not _has_operator_constraints(operators):
        return []

    normalized_language = _normalize_filter_value(language)
    normalized_category = _normalize_filter_value(category)
    normalized_source = _normalize_filter_value(source)
    normalized_sort = _normalize_filter_value(sort) or "relevance"
    ranked_with_score: list[dict[str, Any]] = []
    for doc in index:
        doc_category = _normalize_filter_value(str(doc.get("category") or ""))
        doc_language = _normalize_filter_value(str(doc.get("language") or ""))
        doc_source = _normalize_filter_value(str(doc.get("sourceName") or ""))
        doc_source_slug = _normalize_filter_value(str(doc.get("sourceSlug") or ""))
        if normalized_category and doc_category != normalized_category:
            continue
        if normalized_language and doc_language and doc_language != normalized_language:
            continue
        if normalized_source and normalized_source not in {doc_source, doc_source_slug}:
            continue

        if not _doc_matches_query_operators(doc, operators):
            continue

        score = compute_score(doc, tokens, parsed_query) if tokens else 1
        if normalized_sort == "relevance":
            score += _get_result_click_boost(
                url=str(doc.get("url") or ""),
                query=parsed_query,
                base_score=score,
            )
        if score > 0:
            ranked_with_score.append({**doc, "score": score})

    if normalized_sort == "newest":
        ranked_with_score.sort(
            key=lambda item: (
                str(item.get("fetchedAt") or ""),
                float(item.get("score", 0)),
            ),
            reverse=True,
        )
    elif normalized_sort == "quality":
        ranked_with_score.sort(
            key=lambda item: (
                float(item.get("qualityScore", 0)),
                float(item.get("score", 0)),
            ),
            reverse=True,
        )
    else:
        ranked_with_score.sort(key=lambda item: float(item.get("score", 0)), reverse=True)
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
    original_query = str(query or "").strip()
    query_used, query_rewrite = _apply_query_rewrite_rules(original_query)

    all_results = _run_search_all(
        query_used,
        language=language,
        category=category,
        source=source,
        sort=sort,
        limit=limit,
    )

    contextual_languages = _run_search_all(
        query_used,
        language="",
        category=category,
        source=source,
        sort=sort,
        limit=limit,
    )
    contextual_categories = _run_search_all(
        query_used,
        language=language,
        category="",
        source=source,
        sort=sort,
        limit=limit,
    )
    contextual_sources = _run_search_all(
        query_used,
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
        "queryUsed": query_used,
        "queryRewrite": query_rewrite,
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
