import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlparse

from .index_backups_service import backup_search_index


BASE_DIR = Path(__file__).resolve().parents[2]
SEARCH_INDEX_PATH = BASE_DIR.parent / "data" / "search-index.json"
TOKEN_RE = re.compile(r"[a-z0-9]+")


def _read_existing_docs() -> list[dict]:
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


def _normalize_index_url(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""

    try:
        parsed = urlparse(raw)
    except Exception:
        return raw

    if not parsed.scheme or not parsed.netloc:
        return raw

    return parsed._replace(netloc=parsed.netloc.lower(), fragment="").geturl()


def _default_doc_id(url: str) -> str:
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
    return f"doc-{digest}"


def _normalize_doc(raw_doc: dict) -> dict | None:
    normalized_url = _normalize_index_url(raw_doc.get("url") or "")
    title = str(raw_doc.get("title") or "").strip()
    summary = str(raw_doc.get("summary") or "").strip()

    if not normalized_url or (not title and not summary):
        return None

    normalized = dict(raw_doc)
    normalized["url"] = normalized_url
    normalized["id"] = str(raw_doc.get("id") or "").strip() or _default_doc_id(normalized_url)
    normalized["title"] = title or normalized_url
    normalized["summary"] = summary
    return normalized


def _sort_docs(docs: list[dict]) -> list[dict]:
    return sorted(
        docs,
        key=lambda item: (
            -float(item.get("qualityScore") or 0),
            str(item.get("title") or ""),
        ),
    )


def _compute_artifacts(docs: list[dict]) -> dict:
    vocabulary: set[str] = set()
    token_df: dict[str, int] = {}

    for doc in docs:
        bag = " ".join(
            [
                str(doc.get("title") or ""),
                str(doc.get("summary") or ""),
                " ".join(str(tag) for tag in (doc.get("tags") or []) if tag is not None),
            ]
        ).lower()
        tokens = set(TOKEN_RE.findall(bag))
        vocabulary.update(tokens)
        for token in tokens:
            token_df[token] = token_df.get(token, 0) + 1

    return {
        "docCount": len(docs),
        "vocabularySize": len(vocabulary),
        "tokenDfSize": len(token_df),
    }


def rebuild_search_index(*, merge_docs: list | None = None, create_backup: bool = True) -> dict:
    existing = _read_existing_docs()
    incoming = merge_docs if isinstance(merge_docs, list) else []
    raw_docs = [*existing, *incoming]

    before_count = len(raw_docs)
    by_url: dict[str, dict] = {}
    removed_invalid = 0

    for raw_doc in raw_docs:
        if not isinstance(raw_doc, dict):
            removed_invalid += 1
            continue

        normalized_doc = _normalize_doc(raw_doc)
        if normalized_doc is None:
            removed_invalid += 1
            continue

        by_url[str(normalized_doc["url"]).lower()] = normalized_doc

    rebuilt = _sort_docs(list(by_url.values()))
    backup_file = backup_search_index("index-refresh") if create_backup else None

    SEARCH_INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    SEARCH_INDEX_PATH.write_text(
        f"{json.dumps(rebuilt, indent=2, ensure_ascii=False)}\n",
        encoding="utf-8",
    )

    return {
        "beforeCount": before_count,
        "afterCount": len(rebuilt),
        "removedInvalid": removed_invalid,
        "deduplicated": max(0, before_count - len(rebuilt) - removed_invalid),
        "backupFile": backup_file,
        "artifacts": _compute_artifacts(rebuilt),
    }
