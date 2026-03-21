import json
from datetime import datetime, timezone
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
SEARCH_INDEX_PATH = BASE_DIR.parent / "data" / "search-index.json"


def _read_search_index_docs() -> list[dict]:
    if not SEARCH_INDEX_PATH.exists():
        return []

    try:
        payload = json.loads(SEARCH_INDEX_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    if isinstance(payload, list):
        docs = payload
    elif isinstance(payload, dict):
        docs = payload.get("docs") or []
    else:
        return []

    if not isinstance(docs, list):
        return []

    return [doc for doc in docs if isinstance(doc, dict)]


def _build_top_entries(counts: dict[str, int], limit: int) -> list[dict]:
    return [
        {"value": value, "count": count}
        for value, count in sorted(
            counts.items(),
            key=lambda item: (-item[1], item[0]),
        )[:limit]
    ]


def build_index_status_payload() -> dict:
    docs = _read_search_index_docs()
    language_counts: dict[str, int] = {}
    category_counts: dict[str, int] = {}
    source_counts: dict[str, int] = {}

    for doc in docs:
        language = str(doc.get("language") or "").strip() or "unknown"
        category = str(doc.get("category") or "").strip() or "unknown"
        source = (
            str(doc.get("sourceName") or doc.get("sourceSlug") or "").strip()
            or "unknown"
        )

        language_counts[language] = language_counts.get(language, 0) + 1
        category_counts[category] = category_counts.get(category, 0) + 1
        source_counts[source] = source_counts.get(source, 0) + 1

    try:
        stats = SEARCH_INDEX_PATH.stat()
    except OSError:
        stats = None

    return {
        "index": {
            "totalDocs": len(docs),
            "file": {
                "path": str(SEARCH_INDEX_PATH),
                "sizeBytes": int(stats.st_size) if stats else 0,
                "mtime": (
                    datetime.fromtimestamp(stats.st_mtime, tz=timezone.utc)
                    .isoformat()
                    .replace("+00:00", "Z")
                    if stats
                    else ""
                ),
            },
            "topLanguages": _build_top_entries(language_counts, 8),
            "topCategories": _build_top_entries(category_counts, 8),
            "topSources": _build_top_entries(source_counts, 12),
        }
    }