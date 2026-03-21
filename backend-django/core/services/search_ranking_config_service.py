from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parents[2]
SEARCH_RANKING_CONFIG_PATH = BASE_DIR.parent / "data" / "search-ranking-config.json"

OPTIONAL_QUERY_TOKENS = {
    "best",
    "explained",
    "guide",
    "guides",
    "latest",
    "new",
    "now",
    "recent",
    "recently",
    "simple",
    "today",
    "tutorial",
    "tutorials",
    "de",
    "din",
    "la",
    "cu",
    "si",
    "in",
    "pe",
    "pentru",
    "sau",
    "ultimele",
    "ultima",
    "ultimul",
    "azi",
    "acum",
    "nou",
    "noua",
    "noi",
    "recente",
}

COVERAGE_THRESHOLD_BY_INTENT = {
    "code": 0.65,
    "docs": 0.65,
    "images": 0.45,
    "jobs": 0.55,
    "news": 0.45,
    "research": 0.75,
}

SOURCE_AUTHORITY_BOOSTS = {
    "arxiv.org": 6,
    "bbc.com": 4,
    "developer.mozilla.org": 6,
    "docs.python.org": 6,
    "github.com": 4,
    "kaggle.com": 3,
    "learn.microsoft.com": 6,
    "medium.com": 1,
    "mongodb.com": 4,
    "nature.com": 6,
    "nodejs.org": 5,
    "openai.com": 4,
    "postgresql.org": 5,
    "pubmed.ncbi.nlm.nih.gov": 7,
    "pytorch.org": 5,
    "python.org": 5,
    "react.dev": 5,
    "reuters.com": 5,
    "sciencedirect.com": 5,
    "semanticscholar.org": 5,
    "stackoverflow.com": 4,
    "theguardian.com": 3,
    "wikipedia.org": 4,
}

SEARCH_RANKING_CONFIG_LIMITS = {
    "coverageMin": 0.35,
    "coverageMax": 0.95,
    "sourceBoostMin": 0,
    "sourceBoostMax": 20,
}

_RANKING_TOKEN_RE = re.compile(r"^[\w\d]+$", re.UNICODE)
_ranking_config_cache: dict[str, Any] | None = None


def _copy_config(config: dict[str, Any]) -> dict[str, Any]:
    return json.loads(json.dumps(config))


def normalize_ranking_coverage_config(input_value: Any) -> dict[str, float]:
    merged = {
        **COVERAGE_THRESHOLD_BY_INTENT,
        **(input_value if isinstance(input_value, dict) else {}),
    }

    normalized: dict[str, float] = {}
    for intent, value in merged.items():
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            continue

        normalized[str(intent)] = min(
            SEARCH_RANKING_CONFIG_LIMITS["coverageMax"],
            max(SEARCH_RANKING_CONFIG_LIMITS["coverageMin"], numeric),
        )

    return normalized


def normalize_ranking_source_boost_config(input_value: Any) -> dict[str, int]:
    merged = {
        **SOURCE_AUTHORITY_BOOSTS,
        **(input_value if isinstance(input_value, dict) else {}),
    }

    normalized: dict[str, int] = {}
    for host, value in merged.items():
        key = str(host or "").strip().lower()
        if not key:
            continue

        try:
            numeric = float(value)
        except (TypeError, ValueError):
            continue

        bounded = min(
            SEARCH_RANKING_CONFIG_LIMITS["sourceBoostMax"],
            max(SEARCH_RANKING_CONFIG_LIMITS["sourceBoostMin"], numeric),
        )
        normalized[key] = round(bounded)

    return normalized


def normalize_ranking_optional_tokens(input_value: Any) -> list[str]:
    tokens = input_value if isinstance(input_value, list) else sorted(list(OPTIONAL_QUERY_TOKENS))
    normalized: list[str] = []
    seen: set[str] = set()

    for token_raw in tokens:
        token = str(token_raw or "").strip().lower()
        if not token or len(token) < 2 or len(token) > 40:
            continue
        if not _RANKING_TOKEN_RE.match(token):
            continue
        if token in seen:
            continue

        seen.add(token)
        normalized.append(token)

    return normalized if normalized else sorted(list(OPTIONAL_QUERY_TOKENS))


def normalize_search_ranking_config(input_value: Any) -> dict[str, Any]:
    payload = input_value if isinstance(input_value, dict) else {}
    return {
        "coverageThresholdByIntent": normalize_ranking_coverage_config(
            payload.get("coverageThresholdByIntent")
        ),
        "sourceAuthorityBoosts": normalize_ranking_source_boost_config(
            payload.get("sourceAuthorityBoosts")
        ),
        "optionalQueryTokens": normalize_ranking_optional_tokens(
            payload.get("optionalQueryTokens")
        ),
    }


def get_default_search_ranking_config() -> dict[str, Any]:
    return normalize_search_ranking_config(
        {
            "coverageThresholdByIntent": COVERAGE_THRESHOLD_BY_INTENT,
            "sourceAuthorityBoosts": SOURCE_AUTHORITY_BOOSTS,
            "optionalQueryTokens": sorted(list(OPTIONAL_QUERY_TOKENS)),
        }
    )


def read_search_ranking_config() -> dict[str, Any]:
    try:
        raw = json.loads(SEARCH_RANKING_CONFIG_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raw = {}
    except (json.JSONDecodeError, OSError):
        raw = {}
    return normalize_search_ranking_config(raw)


def write_search_ranking_config(config: Any) -> dict[str, Any]:
    global _ranking_config_cache

    normalized = normalize_search_ranking_config(config)
    SEARCH_RANKING_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp_path = SEARCH_RANKING_CONFIG_PATH.with_suffix(".json.tmp")
    temp_path.write_text(f"{json.dumps(normalized, indent=2)}\n", encoding="utf-8")
    temp_path.replace(SEARCH_RANKING_CONFIG_PATH)
    _ranking_config_cache = normalized
    return _copy_config(normalized)


def get_search_ranking_config() -> dict[str, Any]:
    global _ranking_config_cache

    if _ranking_config_cache is None:
        _ranking_config_cache = read_search_ranking_config()
    return _copy_config(_ranking_config_cache)


def reset_search_ranking_config() -> dict[str, Any]:
    global _ranking_config_cache

    _ranking_config_cache = None
    return write_search_ranking_config(get_default_search_ranking_config())
