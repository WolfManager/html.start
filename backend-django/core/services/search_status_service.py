"""
Service for building admin search status payload.
Aggregates index stats, ranking config, rewrite rules, and latest sync run info.
"""

import json
from pathlib import Path
from datetime import datetime
from collections import Counter


def build_search_status_payload():
    """
    Build comprehensive search system status payload.
    Returns dict with index stats, ranking config, rewrite rules, and latest run info.
    """
    search_index_path = Path("data/search-index.json")
    ranking_config_path = Path("data/search-ranking-config.json")
    rewrite_rules_path = Path("data/query-rewrite-rules.json")
    sync_state_path = Path("data/index-sync-state.json")

    # Read search index statistics
    index_stats = _read_search_index_stats(search_index_path)

    # Read ranking configuration
    ranking_config = _read_ranking_config(ranking_config_path)

    # Read rewrite rules
    rewrite_rules_summary = _read_rewrite_rules_summary(rewrite_rules_path)

    # Read sync state and build latest run summary
    latest_run = _build_latest_run_summary(sync_state_path)

    return {
        "sources": {
            "active": index_stats["source_count"],
            "total": index_stats["source_count"],
        },
        "documents": {
            "indexed": index_stats["total_docs"],
            "blocked": 0,
            "errors": 0,
        },
        "blockRules": 0,
        "latestRun": latest_run,
        "recentRuns": [latest_run] if latest_run.get("startedAt") else [],
        "rankingConfig": ranking_config,
        "rewriteRules": rewrite_rules_summary,
    }


def _read_search_index_stats(search_index_path):
    """
    Read search index and compute statistics.
    Returns dict with total_docs, and top languages, categories, sources.
    """
    try:
        with open(search_index_path, "r", encoding="utf-8") as f:
            payload = json.load(f)

        # Handle both array format and {docs: []} format
        docs = payload if isinstance(payload, list) else payload.get("docs", [])

        total_docs = len(docs)

        # Count languages, categories, sources
        languages = Counter()
        categories = Counter()
        sources = Counter()

        for doc in docs:
            if isinstance(doc, dict):
                languages[doc.get("language", "unknown")] += 1
                categories[doc.get("category", "unknown")] += 1
                source = doc.get("sourceName") or doc.get("sourceSlug", "unknown")
                sources[source] += 1

        return {
            "total_docs": total_docs,
            "language_count": len(languages),
            "category_count": len(categories),
            "source_count": len(sources),
            "top_languages": dict(languages.most_common(8)),
            "top_categories": dict(categories.most_common(8)),
            "top_sources": dict(sources.most_common(12)),
        }
    except (FileNotFoundError, json.JSONDecodeError):
        return {
            "total_docs": 0,
            "language_count": 0,
            "category_count": 0,
            "source_count": 0,
            "top_languages": {},
            "top_categories": {},
            "top_sources": {},
        }


def _read_ranking_config(ranking_config_path):
    """
    Read search ranking configuration from JSON file.
    Returns full ranking config object.
    """
    try:
        with open(ranking_config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {
            "coverageThresholdByIntent": {},
            "sourceAuthorityBoosts": {},
            "optionalQueryTokens": [],
        }


def _read_rewrite_rules_summary(rewrite_rules_path):
    """
    Read query rewrite rules and return enabled/total count.
    """
    try:
        with open(rewrite_rules_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        rules = data.get("rules", [])
        enabled_count = sum(1 for rule in rules if rule.get("enabled", False))
        total_count = len(rules)

        return {
            "enabled": enabled_count,
            "total": total_count,
        }
    except (FileNotFoundError, json.JSONDecodeError):
        return {
            "enabled": 0,
            "total": 0,
        }


def _build_latest_run_summary(sync_state_path):
    """
    Build latest sync run summary from index-sync-state.json.
    """
    try:
        with open(sync_state_path, "r", encoding="utf-8") as f:
            state = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        state = {
            "updatedSince": "",
            "lastRunAt": "",
            "lastSuccessAt": "",
            "lastError": "",
        }

    last_run_at = state.get("lastRunAt", "")
    last_error = state.get("lastError", "")

    # Build latest run summary (similar to Node.js buildAdminSearchLatestRunSummary)
    return {
        "id": last_run_at if last_run_at else "",
        "status": "error" if last_error else ("success" if last_run_at else "idle"),
        "startedAt": last_run_at,
        "finishedAt": last_run_at,  # We don't track finish time separately, use start time
        "pagesSeen": 0,
        "pagesIndexed": 0,
        "pagesUpdated": 0,
        "pagesFailed": 1 if last_error else 0,
        "pagesBlocked": 0,
        "source": "all",
        "durationMs": 0,  # We don't track duration separately in state
        "lastError": last_error,
    }
