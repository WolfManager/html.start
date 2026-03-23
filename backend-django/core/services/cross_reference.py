import re
from typing import Any
from urllib.parse import urlparse

from .doc_structure import analyze_document_structure, get_structure_intent_bonus
from .entity_recognition import compute_entity_overlap, extract_referenced_domains

STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "for",
    "from",
    "in",
    "of",
    "on",
    "or",
    "the",
    "to",
}


def _tokenize_query(query: str) -> list[str]:
    return [
        token.strip()
        for token in re.split(r"[^\w]+", str(query or "").lower(), flags=re.UNICODE)
        if token.strip() and len(token.strip()) >= 2 and token.strip() not in STOPWORDS
    ]


def _document_text(document: Any) -> str:
    if isinstance(document, dict):
        parts = [
            str(document.get("title") or ""),
            str(document.get("summary") or ""),
            str(document.get("content") or ""),
            " ".join(str(tag or "") for tag in (document.get("tags") or [])),
            str(document.get("url") or ""),
        ]
    else:
        parts = [
            str(getattr(document, "title", "") or ""),
            str(getattr(document, "summary", "") or ""),
            str(getattr(document, "content", "") or ""),
            " ".join(str(tag or "") for tag in (getattr(document, "tags", []) or [])),
            str(getattr(document, "url", "") or ""),
        ]
    return " ".join(parts)


def _compute_topic_coherence_bonus(query: str, document: Any) -> float:
    query_tokens = [token for token in _tokenize_query(query) if len(token) >= 3]
    if len(query_tokens) < 2:
        return 0.0

    text = _document_text(document).lower()
    matched = sum(1 for token in query_tokens if token in text)
    coverage = matched / len(query_tokens)
    if coverage >= 1.0:
        return 0.8
    if coverage >= 0.75:
        return 0.4
    return 0.0


def _compute_reference_bonus(document: Any, query: str) -> float:
    query_tokens = _tokenize_query(query)
    if len(query_tokens) < 2:
        return 0.0

    text = _document_text(document)
    referenced_domains = extract_referenced_domains(text)
    source_domain = urlparse(str(getattr(document, "url", "") or (document.get("url") if isinstance(document, dict) else ""))).netloc.lower()
    cross_domain_refs = {domain for domain in referenced_domains if domain and domain != source_domain}
    if not cross_domain_refs:
        return 0.0
    return min(1.2, 0.3 * len(cross_domain_refs))


def compute_cross_domain_signal_bonus(document: Any, query: str, query_intent: dict[str, Any] | None = None) -> dict[str, Any]:
    text = _document_text(document)
    entity_overlap = compute_entity_overlap(query, text)
    entity_bonus = min(2.4, len(entity_overlap["matchedEntities"]) * 0.8)

    structure = analyze_document_structure(document)
    structure_bonus = get_structure_intent_bonus(
        str((query_intent or {}).get("intent") or ""),
        structure,
    )
    reference_bonus = _compute_reference_bonus(document, query)
    coherence_bonus = _compute_topic_coherence_bonus(query, document)

    total_bonus = min(4.0, round(entity_bonus + structure_bonus + reference_bonus + coherence_bonus, 3))
    return {
        "totalBonus": total_bonus,
        "entityBonus": round(entity_bonus, 3),
        "structureBonus": round(structure_bonus, 3),
        "referenceBonus": round(reference_bonus, 3),
        "coherenceBonus": round(coherence_bonus, 3),
        "structureType": structure,
        "matchedEntities": entity_overlap["matchedEntities"],
    }
