import json
import re
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parents[2]
SEARCH_INDEX_PATH = BASE_DIR.parent / "data" / "search-index.json"


def _read_search_index() -> list[dict[str, Any]]:
    try:
        content = SEARCH_INDEX_PATH.read_text(encoding="utf-8")
        parsed = json.loads(content)
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
    except Exception:
        pass
    return []


def tokenize(query: str) -> list[str]:
    return [token.strip() for token in re.split(r"[^a-z0-9]+", query.lower()) if token.strip()]


def compute_score(doc: dict[str, Any], tokens: list[str]) -> int:
    if not tokens:
        return 0

    title = str(doc.get("title", "")).lower()
    summary = str(doc.get("summary", "")).lower()
    category = str(doc.get("category", "")).lower()
    raw_tags = doc.get("tags")
    tags = [str(tag).lower() for tag in raw_tags] if isinstance(raw_tags, list) else []

    score = 0
    for token in tokens:
        if token in title:
            score += 6
        if token in summary:
            score += 3
        if token in category:
            score += 2
        for tag in tags:
            if token in tag:
                score += 4
    return score


def run_search(query: str) -> list[dict[str, Any]]:
    index = _read_search_index()
    tokens = tokenize(query)

    ranked_with_score = [
        {**doc, "score": compute_score(doc, tokens)}
        for doc in index
    ]
    ranked = [doc for doc in ranked_with_score if int(doc.get("score", 0)) > 0]
    ranked.sort(key=lambda item: int(item.get("score", 0)), reverse=True)

    if ranked:
        clean = []
        for item in ranked[:20]:
            copy = dict(item)
            copy.pop("score", None)
            clean.append(copy)
        return clean

    return index[:12]
