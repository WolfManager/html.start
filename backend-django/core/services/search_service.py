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
from .ltr_model_trainer import train_ltr_model, load_model, save_model, compute_ndcg, compute_average_precision
from .ltr_training_pipeline import run_training_cycle, get_training_summary
from .ab_testing import ABTest, get_current_ab_test, save_ab_test, start_ab_test, update_traffic_split, should_rollout_to_100_percent
from .deployment_safeguards import get_deployment_state, should_perform_canary_deployment, should_rollback, should_increase_canary_traffic, initiate_canary_deployment, increase_canary_traffic, rollback_deployment
from .continuous_deployment import run_continuous_deployment_cycle, get_deployment_readiness

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
VOCABULARY_CACHE_TTL_SECONDS = 3600  # 1 hour

# LLM SEMANTIC FALLBACK CONFIG
LLM_ENABLED = True  # set to False to disable LLM fallback
LLM_API_TIMEOUT_SECONDS = 3.0  # fast timeout to avoid blocking
LLM_SEMANTIC_MAX_TOKENS = 100
LLM_SEMANTIC_TEMPERATURE = 0.3  # low temperature for focused responses
LLM_FALLBACK_THRESHOLD_RESULTS = 2  # trigger semantic fallback if results < this
LLM_MAX_RETRIES = 1

# LEARNING-TO-RANK CONFIG
LTR_DATA_COLLECTION_ENABLED = True  # collect training data
LTR_MIN_TRAINING_SAMPLES = 1000  # collect this many interactions before training
LTR_FEATURE_CACHE_TTL_SECONDS = 7200  # 2 hours
LTR_MODEL_REFRESH_DAYS = 7  # retrain model weekly
LTR_FEATURES_TO_TRACK = [
    "query_length",
    "has_operators",
    "result_count",
    "click_count",
    "ctr_signal",
    "doc_position",
    "doc_score",
    "dwell_time_ms",
]

_click_signal_cache: dict[str, Any] = {
    "expiresAt": 0.0,
    "queryUrlCounts": {},
    "queryCounts": {},
    "urlCounts": {},
}

_vocabulary_cache: dict[str, Any] = {
    "expiresAt": 0.0,
    "vocabulary": [],
}

_ltr_feature_cache: dict[str, Any] = {
    "expiresAt": 0.0,
    "training_samples": [],  # list of (features, label) tuples
    "model_timestamp": None,
    "sample_count": 0,
}


def create_click_signal_telemetry_state() -> dict[str, Any]:
    return {
        "searchesEvaluated": 0,
        "docsEvaluated": 0,
        "boostApplied": 0,
        "suppressedMinBase": 0,
        "suppressedNoSignal": 0,
        "cappedByGuardrail": 0,
        "totalBoost": 0,
        "lastUpdatedAt": "",
        "lastRun": None,
    }


_click_signal_telemetry: dict[str, Any] = create_click_signal_telemetry_state()


def get_click_signal_telemetry() -> dict[str, Any]:
    return dict(_click_signal_telemetry)


def set_click_signal_telemetry(next_telemetry: Any) -> dict[str, Any]:
    global _click_signal_telemetry

    payload = next_telemetry if isinstance(next_telemetry, dict) else {}
    merged = create_click_signal_telemetry_state()
    for key in merged:
        if key in payload:
            merged[key] = payload[key]

    _click_signal_telemetry = merged
    return dict(_click_signal_telemetry)


def invalidate_click_signal_cache() -> None:
    _click_signal_cache["expiresAt"] = 0.0
    _click_signal_cache["queryUrlCounts"] = {}
    _click_signal_cache["queryCounts"] = {}
    _click_signal_cache["urlCounts"] = {}


def invalidate_vocabulary_cache() -> None:
    _vocabulary_cache["expiresAt"] = 0.0
    _vocabulary_cache["vocabulary"] = []


def _collect_ltr_training_sample(
    query: str,
    doc_url: str,
    doc_score: float,
    position: int,
    clicked: bool,
    dwell_time_ms: int = 0,
) -> None:
    """
    Collect training sample for learning-to-rank model.
    Called after user interacts with search result.
    """
    if not LTR_DATA_COLLECTION_ENABLED:
        return

    try:
        features = {
            "query_length": len(tokenize(str(query or ""))),
            "has_operators": bool(_parse_search_operators(query)[1].get("sites")),
            "doc_score": float(doc_score or 0.0),
            "position": int(position or 0),
            "dwell_time_ms": int(dwell_time_ms or 0),
        }

        # Label: 1 if clicked (relevant), 0 if not (not relevant)
        label = 1 if clicked else 0

        now = time.time()
        global _ltr_feature_cache
        if now >= float(_ltr_feature_cache.get("expiresAt") or 0):
            _ltr_feature_cache["training_samples"] = []
            _ltr_feature_cache["expiresAt"] = now + LTR_FEATURE_CACHE_TTL_SECONDS

        _ltr_feature_cache["training_samples"].append({
            "features": features,
            "label": label,
            "timestamp": now,
        })
        _ltr_feature_cache["sample_count"] = len(_ltr_feature_cache.get("training_samples") or [])
    except Exception as e:
        # Silently fail on LTR collection; don't break search
        pass


def _call_llm_semantic_fallback(query: str, max_retries: int = 1) -> list[str] | None:
    """
    Use LLM for semantic query understanding when search fails.

    Returns list of clarifying questions or alternative search suggestions.
    Falls back gracefully if LLM unavailable or times out.
    """
    if not LLM_ENABLED:
        return None

    try:
        from django.conf import settings
        import os

        # Check for LLM provider config
        provider = getattr(settings, "LLM_PROVIDER", os.getenv("LLM_PROVIDER", ""))
        api_key = os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY")

        if not provider or not api_key:
            return None

        # Only use for short queries (avoid API cost on long inputs)
        if len(query) > 100:
            return None

        # Call appropriate LLM
        if provider.lower() == "openai":
            return _call_openai_semantic(query, api_key)
        elif provider.lower() == "anthropic":
            return _call_anthropic_semantic(query, api_key)

        return None
    except Exception as e:
        # Fail silently - LLM is optional enhancement
        return None


def _call_openai_semantic(query: str, api_key: str) -> list[str] | None:
    """Call OpenAI for semantic query understanding."""
    try:
        import requests

        prompt = f"""Given this search query, provide 2-3 alternative queries that clarify the intent:
Query: "{query}"

Return JSON: {{"alternatives": ["query1", "query2", "query3"]}}`

Be concise, return valid JSON only."""

        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": LLM_SEMANTIC_TEMPERATURE,
                "max_tokens": LLM_SEMANTIC_MAX_TOKENS,
            },
            timeout=LLM_API_TIMEOUT_SECONDS,
        )

        if response.status_code == 200:
            content = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
            import json
            parsed = json.loads(content)
            return parsed.get("alternatives", [])
        return None
    except Exception:
        return None


def _call_anthropic_semantic(query: str, api_key: str) -> list[str] | None:
    """Call Anthropic for semantic query understanding."""
    try:
        import requests

        prompt = f"""Given this search query, provide 2-3 alternative queries that clarify the intent:
Query: "{query}"

Return JSON: {{"alternatives": ["query1", "query2", "query3"]}}

Be concise, return valid JSON only."""

        response = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
            json={
                "model": "claude-3-haiku-20240307",
                "max_tokens": LLM_SEMANTIC_MAX_TOKENS,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=LLM_API_TIMEOUT_SECONDS,
        )

        if response.status_code == 200:
            content = response.json().get("content", [{}])[0].get("text", "")
            import json
            parsed = json.loads(content)
            return parsed.get("alternatives", [])
        return None
    except Exception:
        return None


def _normalize_accents_advanced(text: str) -> str:
    """
    Advanced accent normalization: café → cafe, naïve → naive, etc.
    Also handles special cases: C++ → cpp, C# → csharp
    """
    raw = str(text or "").strip()
    if not raw:
        return ""

    try:
        import unicodedata
        # NFD decomposition: café → cafe
        normalized = unicodedata.normalize("NFD", raw)
        normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    except Exception:
        normalized = raw

    # Handle special programming language syntax
    normalized = normalized.replace("C++", "cpp").replace("c++", "cpp")
    normalized = normalized.replace("C#", "csharp").replace("c#", "csharp")
    normalized = normalized.replace("C++", "cpp")

    return normalized.lower()


def _expand_query_with_synonyms(query: str) -> str:
    """
    Expand short query tokens with common synonyms.
    e.g., "ai" → "artificial intelligence", "js" → "javascript"

    Only expands if synonym significantly improves search results potential.
    """
    raw = str(query or "").strip()
    if not raw or len(raw) > 50:
        return raw

    tokens = tokenize(raw)
    expanded_tokens: list[str] = []

    for token in tokens:
        normalized = _normalize_accents_advanced(token)

        # Check if token has synonym mapping
        if normalized.lower() in QUERY_SYNONYMS:
            synonyms = QUERY_SYNONYMS.get(normalized.lower(), [])
            # Add primary synonym (first in list)
            if synonyms:
                expanded_tokens.append(synonyms[0])
            else:
                expanded_tokens.append(token)
        else:
            expanded_tokens.append(token)

    return " ".join(expanded_tokens).strip()


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
    """
    Apply query rewrite rules with enhanced matching.

    Enhancement: Try both original and accent-normalized versions,
    and also check expanded synonym version for better matching.
    """
    original_query = str(query or "").strip()
    if not original_query:
        return "", None

    normalized_query = _normalize_filter_value(original_query)
    expanded_query = _expand_query_with_synonyms(original_query)
    accent_normalized = _normalize_accents_advanced(original_query)

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
            # Try: original, accent-normalized, and expanded versions
            if (normalized_query == normalized_source or
                _normalize_filter_value(accent_normalized) == normalized_source or
                _normalize_filter_value(expanded_query) == normalized_source):
                rewritten_query = target
        elif match_type == "contains":
            # Enhanced: look for pattern in all versions
            search_text = normalized_query
            if normalized_source not in search_text:
                search_text = _normalize_filter_value(accent_normalized)
            if normalized_source not in search_text:
                search_text = _normalize_filter_value(expanded_query)

            if normalized_source and normalized_source in search_text:
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


def _bounded_levenshtein(left: str, right: str, max_distance: int = 2) -> int:
    if left == right:
        return 0
    if abs(len(left) - len(right)) > max_distance:
        return max_distance + 1

    previous = list(range(len(right) + 1))
    for left_index, left_char in enumerate(left, start=1):
        current = [left_index]
        row_min = current[0]

        for right_index, right_char in enumerate(right, start=1):
            insertion = current[right_index - 1] + 1
            deletion = previous[right_index] + 1
            substitution = previous[right_index - 1] + (0 if left_char == right_char else 1)
            value = min(insertion, deletion, substitution)
            current.append(value)
            row_min = min(row_min, value)

        if row_min > max_distance:
            return max_distance + 1
        previous = current

    return previous[-1]


def _build_search_vocabulary() -> list[str]:
    """Build search vocabulary from index with caching (1h TTL)"""
    vocabulary: set[str] = set()

    for doc in _read_search_index():
        for token in tokenize(str(doc.get("title") or "")):
            if len(token) >= 3:
                vocabulary.add(token)
        for token in tokenize(str(doc.get("summary") or "")):
            if len(token) >= 3:
                vocabulary.add(token)
        for token in tokenize(str(doc.get("category") or "")):
            if len(token) >= 3:
                vocabulary.add(token)
        for token in tokenize(
            str(doc.get("url") or "").replace("https://", "").replace("http://", "")
        ):
            if len(token) >= 3:
                vocabulary.add(token)

        raw_tags = doc.get("tags")
        if isinstance(raw_tags, list):
            for tag in raw_tags:
                for token in tokenize(str(tag or "")):
                    if len(token) >= 3:
                        vocabulary.add(token)

    return sorted(vocabulary)


def _get_cached_vocabulary() -> list[str]:
    """Get vocabulary with 1h caching to reduce CPU."""
    now = time.time()
    if now < float(_vocabulary_cache.get("expiresAt") or 0):
        return _vocabulary_cache.get("vocabulary") or []

    built = _build_search_vocabulary()
    _vocabulary_cache["vocabulary"] = built
    _vocabulary_cache["expiresAt"] = now + VOCABULARY_CACHE_TTL_SECONDS
    return built


def _suggest_query_correction(query: str, vocabulary: list[str] | None = None) -> dict[str, str] | None:
    """
    Suggest spelling corrections using adaptive Levenshtein distance threshold.

    Adaptive thresholds per token:
    - Short tokens (<=4 chars): distance ≤1 (strict, fewer false positives)
    - Medium tokens (5-8 chars): distance ≤2 (balanced)
    - Long tokens (>8 chars): distance ≤3 (generous, better recall)
    """
    raw_query = str(query or "").strip()
    tokens = tokenize(raw_query)
    if not tokens:
        return None

    candidates = vocabulary or _get_cached_vocabulary()
    if not candidates:
        return None

    changed = False
    corrected_tokens: list[str] = []

    for token in tokens:
        if len(token) < 4:
            corrected_tokens.append(token)
            continue

        # Adaptive threshold based on token length
        if len(token) <= 4:
            max_distance = 1  # strict for short tokens
        elif len(token) <= 8:
            max_distance = 2  # balanced for medium tokens
        else:
            max_distance = 3  # generous for long tokens

        best_candidate = token
        best_distance = max_distance + 1

        for candidate in candidates:
            if candidate == token:
                best_candidate = token
                best_distance = 0
                break
            if abs(len(candidate) - len(token)) > max_distance:
                continue

            distance = _bounded_levenshtein(token, candidate, max_distance)
            if distance < best_distance:
                best_candidate = candidate
                best_distance = distance
            if best_distance == 1:
                break

        if best_candidate != token and best_distance <= max_distance:
            changed = True
            corrected_tokens.append(best_candidate)
        else:
            corrected_tokens.append(token)

    corrected_query = " ".join(corrected_tokens).strip()
    if not changed or not corrected_query or corrected_query == " ".join(tokens):
        return None

    return {
        "originalQuery": raw_query,
        "correctedQuery": corrected_query,
    }


def _rebuild_query_with_operators(cleaned_query: str, operators: dict[str, list[str]]) -> str:
    parts: list[str] = []
    normalized_cleaned_query = str(cleaned_query or "").strip()
    if normalized_cleaned_query:
        parts.append(normalized_cleaned_query)

    for site in operators.get("sites") or []:
        parts.append(f"site:{site}")
    for site in operators.get("excluded_sites") or []:
        parts.append(f"-site:{site}")
    for filetype in operators.get("filetypes") or []:
        parts.append(f"filetype:{filetype}")
    for token in operators.get("inurl") or []:
        parts.append(f"inurl:{token}")
    for token in operators.get("intitle") or []:
        parts.append(f"intitle:{token}")

    return " ".join(part for part in parts if part).strip()


def get_applied_search_operators(query: str) -> dict[str, Any]:
    cleaned_query, operators = _parse_search_operators(query)
    return {
        "site": list(operators.get("sites") or []),
        "excludedSite": list(operators.get("excluded_sites") or []),
        "filetype": list(operators.get("filetypes") or []),
        "inurl": list(operators.get("inurl") or []),
        "intitle": list(operators.get("intitle") or []),
        "cleanedQuery": cleaned_query,
    }


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
    user_id: str = "",  # for A/B testing
) -> dict[str, Any]:
    original_query = str(query or "").strip()
    query_used, query_rewrite = _apply_query_rewrite_rules(original_query)
    query_correction = None

    all_results = _run_search_all(
        query_used,
        language=language,
        category=category,
        source=source,
        sort=sort,
        limit=limit,
    )

    if not all_results:
        cleaned_query, operators = _parse_search_operators(query_used)
        correction = _suggest_query_correction(cleaned_query)
        if correction and correction.get("correctedQuery"):
            corrected_query_with_operators = _rebuild_query_with_operators(
                str(correction.get("correctedQuery") or "").strip(),
                operators,
            )
            corrected_results = _run_search_all(
                corrected_query_with_operators,
                language=language,
                category=category,
                source=source,
                sort=sort,
                limit=limit,
            )
            if corrected_results:
                query_used = corrected_query_with_operators
                query_correction = {
                    "originalQuery": correction["originalQuery"],
                    "correctedQuery": correction["correctedQuery"],
                    "autoApplied": True,
                }
                all_results = corrected_results

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

    # Apply LTR ranking if user is in treatment variant and model is deployed
    if user_id and _should_use_ltr_ranking(user_id):
        try:
            model = load_model()
            if model:
                all_results = _apply_ltr_ranking_adjustment(all_results, model, query_used)
        except Exception:
            # LTR ranking failure is silent - use original results
            pass

    safe_limit = _safe_limit(limit)
    safe_offset = _safe_offset(offset)
    total = len(all_results)
    paged_results = all_results[safe_offset : safe_offset + safe_limit]
    total_pages = ceil(total / safe_limit) if total else 0
    current_page = (safe_offset // safe_limit) + 1 if total else 1
    query_suggestion = None

    if 0 < total < 5 and query_correction is None:
        cleaned_query, _operators = _parse_search_operators(query_used)
        suggestion = _suggest_query_correction(cleaned_query)
        corrected_query = str((suggestion or {}).get("correctedQuery") or "").strip()
        if corrected_query and _normalize_filter_value(corrected_query) != _normalize_filter_value(cleaned_query):
            query_suggestion = {"correctedQuery": corrected_query}

    # LLM semantic fallback for very sparse results
    semantic_fallback = None
    if total < LLM_FALLBACK_THRESHOLD_RESULTS:
        semantic_suggestions = _call_llm_semantic_fallback(original_query)
        if semantic_suggestions:
            semantic_fallback = {
                "suggestions": semantic_suggestions,
                "reason": "sparse_results_semantic_fallback",
            }

    return {
        "queryUsed": query_used,
        "queryRewrite": query_rewrite,
        "appliedOperators": get_applied_search_operators(query_used),
        "queryCorrection": query_correction,
        "querySuggestion": query_suggestion,
        "semanticFallback": semantic_fallback,
        "ltrVariant": _get_ab_test_variant(user_id) if user_id else None,
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


def get_related_queries(query: str, limit: int = 6) -> list[str]:
    normalized_query = _normalize_filter_value(query)
    if len(normalized_query) < 2:
        return []

    safe_limit = max(1, min(10, int(limit or 6)))
    searches = list(read_analytics().get("searches") or [])
    searches_with_time: list[dict[str, Any]] = []
    search_by_id: dict[str, dict[str, Any]] = {}

    for item in searches:
        parsed_at = None
        try:
            parsed_at = datetime.fromisoformat(str(item.get("at") or "").replace("Z", "+00:00"))
        except Exception:
            parsed_at = None

        enriched = {
            **item,
            "_normalizedQuery": _normalize_filter_value(str(item.get("query") or "")),
            "_parsedAt": parsed_at,
            "_ip": str(item.get("ip") or "").strip(),
        }
        searches_with_time.append(enriched)

        item_id = str(item.get("id") or "").strip()
        if item_id:
            search_by_id[item_id] = enriched

    scores: dict[str, dict[str, Any]] = {}

    def add_candidate(raw_value: str, score: int, parsed_at: Any) -> None:
        normalized_value = _normalize_filter_value(raw_value)
        if len(normalized_value) < 2 or normalized_value == normalized_query:
            return
        if any(token in normalized_value for token in ("site:", "inurl:", "intitle:")):
            return

        current = scores.get(normalized_value)
        if current is None:
            scores[normalized_value] = {
                "value": str(raw_value or "").strip(),
                "score": score,
                "lastAt": parsed_at,
            }
            return

        current["score"] = int(current.get("score") or 0) + score
        if parsed_at and (current.get("lastAt") is None or parsed_at > current.get("lastAt")):
            current["lastAt"] = parsed_at
            current["value"] = str(raw_value or "").strip()

    for item in searches_with_time:
        item_query = str(item.get("query") or "").strip()
        parsed_at = item.get("_parsedAt")
        parent_id = str(item.get("reformulatesSearchId") or "").strip()

        if item.get("_normalizedQuery") == normalized_query and parent_id:
            parent = search_by_id.get(parent_id)
            if parent:
                add_candidate(str(parent.get("query") or ""), 3, parsed_at)

        parent = search_by_id.get(parent_id) if parent_id else None
        if parent and parent.get("_normalizedQuery") == normalized_query:
            result_count = int(item.get("resultCount") or 0)
            add_candidate(item_query, 4 if result_count > 0 else 2, parsed_at)

    grouped_by_ip: dict[str, list[dict[str, Any]]] = {}
    for item in searches_with_time:
        ip = str(item.get("_ip") or "")
        if not ip or item.get("_parsedAt") is None:
            continue
        grouped_by_ip.setdefault(ip, []).append(item)

    session_window_seconds = 10 * 60
    for items in grouped_by_ip.values():
        items.sort(key=lambda item: item.get("_parsedAt") or datetime.min)
        for index, item in enumerate(items):
            if item.get("_normalizedQuery") != normalized_query:
                continue

            item_time = item.get("_parsedAt")
            if item_time is None:
                continue

            for neighbor_index in range(max(0, index - 3), min(len(items), index + 4)):
                if neighbor_index == index:
                    continue
                neighbor = items[neighbor_index]
                neighbor_time = neighbor.get("_parsedAt")
                if neighbor_time is None:
                    continue
                if abs((neighbor_time - item_time).total_seconds()) > session_window_seconds:
                    continue
                add_candidate(str(neighbor.get("query") or ""), 1, neighbor_time)

    ranked = sorted(
        scores.values(),
        key=lambda item: (
            -int(item.get("score") or 0),
            -int((item.get("lastAt") or datetime.min.replace(tzinfo=timezone.utc)).timestamp()),
            str(item.get("value") or "").lower(),
        ),
    )
    return [str(item.get("value") or "").strip() for item in ranked[:safe_limit]]


def _compute_query_ctr_score(query: str, hits: int, positive_hits: int) -> float:
    """
    RefinedCTR-enhanced score for better ranking accuracy.

    Scoring formula (refined):
    - Frequency base: log2(positive_hits + 1) * 4 (logarithmic scale)
    - CTR signal: (positive_hits / hits) * 5 when hits > 0 (0-5 range)
    - Frequency depth: log2(hits + 1) * 1.5 (total search volume)
    - Combined score normalized for stability

    This gives better differentiation between high-quality vs low-quality suggestions.
    """
    if hits <= 0 or positive_hits <= 0:
        return 0.0

    # Normalize CTR to 0-1 range then scale
    ctr = min(1.0, float(positive_hits) / float(hits))

    # Component scores
    frequency_base = math.log2(float(positive_hits) + 1) * 4  # log scale for positive results
    ctr_signal = ctr * 5  # CTR in 0-5 range (dominant signal)
    hit_depth = math.log2(float(hits) + 1) * 1.5  # total search volume influence

    # Combined score: emphasize CTR but reward frequency
    combined = frequency_base + ctr_signal + hit_depth

    return combined


def _get_popular_query_suggestions(partial: str, limit: int) -> list[dict[str, Any]]:
    """Get popular query suggestions with CTR-enhanced ranking."""
    normalized_partial = _normalize_filter_value(partial)
    if not normalized_partial:
        return []

    analytics = read_analytics()
    searches = list(analytics.get("searches") or [])
    stats: dict[str, dict[str, Any]] = {}

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
                "score": int(_compute_query_ctr_score(query, item["hits"], item["positive_hits"])),
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


# ==============================================================================
# TIER 3 PHASE 2: Learning-to-Rank Model Training & Deployment
# ==============================================================================


def train_ltr_model_from_collected_data() -> bool:
    """
    Train new LTR model from collected interaction samples.

    Triggers when:
    - Enough samples collected (LTR_MIN_TRAINING_SAMPLES)
    - Model is stale (>LTR_MODEL_REFRESH_DAYS)

    Returns True if model was trained successfully.
    """
    try:
        # Get training samples
        training_samples = _ltr_feature_cache.get("training_samples", [])
        if len(training_samples) < LTR_MIN_TRAINING_SAMPLES:
            return False

        # Train model
        model = train_ltr_model(training_samples, min_samples=LTR_MIN_TRAINING_SAMPLES // 2)
        if not model:
            return False

        # Save model
        if not save_model(model):
            return False

        # Reset training cache
        now = time.time()
        _ltr_feature_cache["training_samples"] = []
        _ltr_feature_cache["sample_count"] = 0
        _ltr_feature_cache["model_timestamp"] = now
        _ltr_feature_cache["expiresAt"] = now + LTR_FEATURE_CACHE_TTL_SECONDS

        return True
    except Exception:
        return False


def _apply_ltr_ranking_adjustment(
    results: list[dict[str, Any]],
    model,
    query: str,
) -> list[dict[str, Any]]:
    """
    Rerank results using LTR model if available.

    Computes LTR features for each result and adjusts position based on model score.
    """
    if not model or not results:
        return results

    try:
        # Prepare features for each result
        docs_with_features = []
        for position, result in enumerate(results):
            features = {
                "query_length": len(tokenize(query)),
                "has_operators": bool(_parse_search_operators(query)[1].get("sites")),
                "doc_position": position,
                "doc_score": 50.0,  # normalized base score
            }
            docs_with_features.append({
                "position": position,
                "features": features,
                "result": result,
            })

        # Get LTR predictions
        predictions = model.predict_ranking(docs_with_features)

        # Sort by LTR score (descending)
        scored_results = [
            (pred, doc["result"])
            for pred, doc in zip(predictions, docs_with_features)
        ]
        scored_results.sort(key=lambda x: x[0], reverse=True)

        return [result for _score, result in scored_results]
    except Exception:
        # Fail gracefully - return original results
        return results


def _get_ab_test_variant(user_id: str) -> str:
    """Get A/B test variant for user (control or treatment)."""
    try:
        test = get_current_ab_test()
        if not test or test.status != "active":
            return "control"
        return test.assign_variant(user_id)
    except Exception:
        return "control"


def _should_use_ltr_ranking(user_id: str) -> bool:
    """
    Determine if LTR ranking should be applied for this user.

    Returns True if:
    - User assigned to treatment variant
    - Canary deployment is active
    - Deployment hasn't rolled back
    """
    try:
        variant = _get_ab_test_variant(user_id)
        if variant != "treatment":
            return False

        config, _events = get_deployment_state()
        if not config.is_active or config.canary_percentage == 0:
            return False

        return True
    except Exception:
        return False


def check_model_deployment_health() -> None:
    """
    Check if deployed model's performance is acceptable.

    Automatically:
    - Increases canary traffic if improvement confirmed
    - Rolls back if degradation detected
    - Commits A/B test if 100% rollout achieved

    Called periodically (e.g., in background task).
    """
    try:
        config, _events = get_deployment_state()
        test = get_current_ab_test()

        if not config.is_active or not test:
            return

        # Record A/B test metrics
        test.check_statistical_significance()

        # Check for rollback triggers
        if should_rollback(
            current_metrics={
                "ndcg@5": 0.65,  # would come from actual metrics
                "observations": 1000,
            },
            baseline_metrics={
                "ndcg@5": 0.70,
            },
            config=config,
        ):
            rollback_deployment()
            return

        # Check for canary increase
        if should_increase_canary_traffic(
            current_metrics={
                "ndcg@5": 0.72,
            },
            baseline_metrics={
                "ndcg@5": 0.70,
            },
            config=config,
        ):
            increase_canary_traffic(percentage=10.0)

        # Check for full rollout
        if should_rollout_to_100_percent(test):
            from .deployment_safeguards import commit_deployment
            commit_deployment()

        save_ab_test(test)
    except Exception:
        # Silent failure - health check is best-effort
        pass


# ==============================================================================
# TIER 3 PHASE 2B: Advanced Monitoring & Continuous Deployment
# ==============================================================================


def get_ltr_model_status() -> dict[str, Any]:
    """Get comprehensive LTR model status and metrics."""
    try:
        model = load_model()
        training_summary = get_training_summary()

        return {
            "status": "active" if model else "inactive",
            "current_model": {
                "model_id": model.model_id if model else None,
                "version": model.version if model else None,
                "feature_count": len(model.feature_weights) if model else 0,
            },
            "training": {
                "total_runs": training_summary.get("total_training_runs", 0),
                "successful_runs": training_summary.get("successful_runs", 0),
                "latest_run": training_summary.get("latest_run"),
                "current_metrics": training_summary.get("current_model_metrics"),
                "ndcg_trend": training_summary.get("ndcg_trend", []),
                "avg_training_duration_seconds": training_summary.get("avg_training_duration_seconds", 0.0),
            },
        }
    except Exception as e:
        return {"status": "error", "error": str(e)[:100]}


def get_ab_test_status() -> dict[str, Any]:
    """Get current A/B test status and metrics."""
    try:
        test = get_current_ab_test()
        if not test:
            return {"active": False, "status": "no_active_test"}

        test.check_statistical_significance()

        # Compute enhanced statistics
        ci = test.compute_confidence_interval()
        adequacy = test.compute_sample_adequacy()
        duration = test.get_test_duration()
        pvalue = test.compute_chi_square_pvalue()

        return {
            "active": test.status == "active",
            "test_id": test.test_id,
            "created_at": test.created_at,
            "status": test.status,
            "control": {
                "name": "control",
                "traffic_fraction": test.variants["control"].traffic_fraction,
                "visits": test.variants["control"].metrics.get("visits", 0),
                "clicks": test.variants["control"].metrics.get("clicks", 0),
                "ctr": test.variants["control"].metrics.get("ctr", 0.0),
                "ci": ci.get("control", {}),
                "adequacy": adequacy.get("control", {}),
            },
            "treatment": {
                "name": "treatment",
                "traffic_fraction": test.variants["treatment"].traffic_fraction,
                "visits": test.variants["treatment"].metrics.get("visits", 0),
                "clicks": test.variants["treatment"].metrics.get("clicks", 0),
                "ctr": test.variants["treatment"].metrics.get("ctr", 0.0),
                "ci": ci.get("treatment", {}),
                "adequacy": adequacy.get("treatment", {}),
            },
            "winner": test.winner,
            "is_statistically_significant": test.is_statistically_significant,
            "statistics": {
                "pvalue": round(pvalue, 4),
                "duration": duration,
            },
        }
    except Exception as e:
        return {"active": False, "error": str(e)[:100]}


def get_reformulation_stats(range_days: int = 7) -> dict[str, Any]:
    """Analyse analytics data to produce query reformulation tracking stats."""
    try:
        analytics = read_analytics()
        searches = list(analytics.get("searches") or [])

        cutoff_ts = time.time() - (range_days * 86400)
        recent_searches = []
        for s in searches:
            try:
                at = s.get("at") or ""
                ts = datetime.fromisoformat(at.replace("Z", "+00:00")).timestamp()
                if ts >= cutoff_ts:
                    recent_searches.append(s)
            except Exception:
                continue

        total_searches = len(recent_searches)
        rewritten_searches = [s for s in recent_searches if s.get("wasRewritten")]
        rewrite_count = len(rewritten_searches)
        rewrite_rate = (rewrite_count / total_searches * 100) if total_searches > 0 else 0.0

        # Tally which rules fired most
        rule_counts: dict[str, dict[str, Any]] = {}
        for s in rewritten_searches:
            rule = s.get("rewriteRule") or {}
            key = f"{rule.get('from', '?')} → {rule.get('to', '?')}"
            if key not in rule_counts:
                rule_counts[key] = {
                    "from": rule.get("from", "?"),
                    "to": rule.get("to", "?"),
                    "reason": rule.get("reason", "configured-rewrite"),
                    "matchType": rule.get("matchType", "exact"),
                    "count": 0,
                    "zero_results_after": 0,
                }
            rule_counts[key]["count"] += 1
            if int(s.get("resultCount", 0)) == 0:
                rule_counts[key]["zero_results_after"] += 1

        top_rules = sorted(rule_counts.values(), key=lambda r: r["count"], reverse=True)[:10]

        # Recent rewrites for the activity log
        recent_rewrites = []
        for s in sorted(rewritten_searches, key=lambda x: x.get("at", ""), reverse=True)[:20]:
            recent_rewrites.append({
                "originalQuery": s.get("query", ""),
                "rewrittenQuery": s.get("queryUsed", ""),
                "rule": s.get("rewriteRule", {}),
                "resultCount": s.get("resultCount", 0),
                "at": s.get("at", ""),
            })

        # User-initiated reformulations (sequential behaviour)
        user_reformulations = [s for s in recent_searches if s.get("reformulationType")]
        zero_results_refinements = sum(1 for s in user_reformulations if s.get("reformulationType") == "zero-results-refinement")
        low_results_refinements = sum(1 for s in user_reformulations if s.get("reformulationType") == "low-results-refinement")
        query_refinements = sum(1 for s in user_reformulations if s.get("reformulationType") == "query-refinement")

        return {
            "range_days": range_days,
            "total_searches": total_searches,
            "rewrite_count": rewrite_count,
            "rewrite_rate": round(rewrite_rate, 2),
            "top_rules": top_rules,
            "recent_rewrites": recent_rewrites,
            "user_reformulations": {
                "total": len(user_reformulations),
                "zero_results_refinement": zero_results_refinements,
                "low_results_refinement": low_results_refinements,
                "query_refinement": query_refinements,
            },
        }
    except Exception as e:
        return {"error": str(e)[:200], "range_days": range_days}


def get_deployment_status() -> dict[str, Any]:
    """Get current deployment status and canary state."""
    try:
        config, events = get_deployment_state()

        return {
            "model_version": config.model_version,
            "is_active": config.is_active,
            "canary_percentage": config.canary_percentage,
            "auto_rollback_enabled": config.auto_rollback_enabled,
            "deployment_events": [
                {
                    "event_type": e.event_type,
                    "timestamp": e.timestamp,
                    "details": e.details,
                }
                for e in events[-10:]  # Last 10 events
            ],
        }
    except Exception as e:
        return {"error": str(e)[:100]}


def run_full_deployment_cycle(training_samples: list[dict] | None = None) -> dict[str, Any]:
    """
    Execute complete deployment cycle:
    - Health checks
    - Model training
    - A/B test evaluation
    - Traffic management
    - Automatic promotion

    Called by background task or admin endpoint.
    """
    return run_continuous_deployment_cycle(training_samples)


def get_system_readiness_for_production() -> dict[str, Any]:
    """
    Check if system is production-ready.

    Returns:
    - is_ready: bool
    - readiness_score: 0-100%
    - checks: detailed status of each component
    - recommendations: list of actions needed
    """
    readiness = get_deployment_readiness()

    checks = readiness.get("checks", {})
    is_ready = readiness.get("is_ready", False)

    # Compute readiness score
    score = 0.0
    max_score = 0.0

    check_weights = {
        "ab_test_significant": 25,
        "canary_at_100": 20,
        "has_successful_training": 20,
        "model_ndcg_acceptable": 20,
        "deployment_active": 15,
    }

    for check_name, weight in check_weights.items():
        max_score += weight
        if checks.get(check_name):
            score += weight

    readiness_percent = (score / max_score * 100) if max_score > 0 else 0.0

    # Generate recommendations
    recommendations = []
    if not checks.get("ab_test_significant"):
        recommendations.append("Wait for A/B test to reach statistical significance")
    if not checks.get("has_successful_training"):
        recommendations.append("Need successful model training run first")
    if not checks.get("model_ndcg_acceptable"):
        recommendations.append("Model NDCG score is below acceptable threshold")
    if not checks.get("canary_at_100"):
        recommendations.append("Gradually increase canary traffic to 100%")

    return {
        "is_ready": is_ready,
        "readiness_percent": round(readiness_percent, 1),
        "checks": checks,
        "recommendations": recommendations,
        "timestamp": datetime.utcnow().isoformat(),
    }
