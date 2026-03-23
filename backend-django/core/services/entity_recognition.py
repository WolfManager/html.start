import re
from typing import Any


ENTITY_CATALOG: dict[str, tuple[str, ...]] = {
    "programming_languages": (
        "python",
        "javascript",
        "typescript",
        "java",
        "golang",
        "go",
        "rust",
        "c++",
        "c#",
        "php",
    ),
    "frameworks": (
        "django",
        "flask",
        "fastapi",
        "react",
        "vue",
        "angular",
        "next.js",
        "nextjs",
        "express",
        "spring",
    ),
    "tools": (
        "docker",
        "kubernetes",
        "postgresql",
        "redis",
        "celery",
        "git",
        "github actions",
        "api",
        "sdk",
        "cli",
    ),
    "organizations": (
        "github",
        "gitlab",
        "stackoverflow",
        "wikipedia",
        "google",
        "microsoft",
        "openai",
        "anthropic",
    ),
}


def _normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def extract_entities(text: str) -> dict[str, list[str]]:
    normalized = _normalize_text(text)
    results: dict[str, list[str]] = {key: [] for key in ENTITY_CATALOG}
    if not normalized:
        return results

    for category, candidates in ENTITY_CATALOG.items():
        for candidate in candidates:
            pattern = r"(?<!\w)" + re.escape(candidate) + r"(?!\w)"
            if re.search(pattern, normalized):
                results[category].append(candidate)
    return results


def flatten_entities(entities: dict[str, list[str]]) -> set[str]:
    flattened: set[str] = set()
    for values in entities.values():
        flattened.update(values)
    return flattened


def extract_referenced_domains(text: str) -> set[str]:
    normalized = _normalize_text(text)
    return set(re.findall(r"(?:https?://)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})", normalized))


def compute_entity_overlap(query_text: str, document_text: str) -> dict[str, Any]:
    query_entities = extract_entities(query_text)
    doc_entities = extract_entities(document_text)
    query_flat = flatten_entities(query_entities)
    doc_flat = flatten_entities(doc_entities)
    matched = sorted(query_flat & doc_flat)
    coverage = (len(matched) / len(query_flat)) if query_flat else 0.0
    return {
        "queryEntities": query_entities,
        "documentEntities": doc_entities,
        "matchedEntities": matched,
        "coverage": round(coverage, 3),
    }
