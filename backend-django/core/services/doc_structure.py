from typing import Any


STRUCTURE_TUTORIAL = "tutorial"
STRUCTURE_DOCUMENTATION = "documentation"
STRUCTURE_API_REFERENCE = "api_reference"
STRUCTURE_BLOG = "blog"
STRUCTURE_NEWS = "news"
STRUCTURE_DISCUSSION = "discussion"
STRUCTURE_OTHER = "other"


def _collect_document_text(document: Any) -> tuple[str, str, str, str]:
    if isinstance(document, dict):
        title = str(document.get("title") or "")
        summary = str(document.get("summary") or "")
        content = str(document.get("content") or "")
        url = str(document.get("url") or "")
    else:
        title = str(getattr(document, "title", "") or "")
        summary = str(getattr(document, "summary", "") or "")
        content = str(getattr(document, "content", "") or "")
        url = str(getattr(document, "url", "") or "")
    return title.lower(), summary.lower(), content.lower(), url.lower()


def analyze_document_structure(document: Any) -> str:
    title, summary, content, url = _collect_document_text(document)
    combined = " ".join([title, summary, content[:2500], url])

    tutorial_markers = ("tutorial", "guide", "getting started", "step by step", "how to", "walkthrough")
    documentation_markers = ("documentation", "docs", "manual", "concepts", "overview")
    api_markers = ("api", "reference", "endpoint", "method", "parameter", "schema")
    blog_markers = ("blog", "opinion", "thoughts", "author", "published")
    news_markers = ("news", "breaking", "announcement", "today", "release notes")
    discussion_markers = ("forum", "thread", "discussion", "comment", "q&a")

    if any(marker in combined for marker in tutorial_markers):
        return STRUCTURE_TUTORIAL
    if any(marker in combined for marker in api_markers):
        return STRUCTURE_API_REFERENCE
    if any(marker in combined for marker in documentation_markers):
        return STRUCTURE_DOCUMENTATION
    if any(marker in combined for marker in news_markers):
        return STRUCTURE_NEWS
    if any(marker in combined for marker in discussion_markers):
        return STRUCTURE_DISCUSSION
    if any(marker in combined for marker in blog_markers):
        return STRUCTURE_BLOG
    return STRUCTURE_OTHER


def get_structure_intent_bonus(intent: str, structure: str) -> float:
    matrix = {
        "informational": {
            STRUCTURE_TUTORIAL: 1.2,
            STRUCTURE_DOCUMENTATION: 1.0,
            STRUCTURE_API_REFERENCE: 0.9,
            STRUCTURE_NEWS: 0.2,
        },
        "navigational": {
            STRUCTURE_DOCUMENTATION: 0.8,
            STRUCTURE_API_REFERENCE: 0.7,
            STRUCTURE_TUTORIAL: 0.3,
        },
        "transactional": {
            STRUCTURE_BLOG: 0.4,
            STRUCTURE_DOCUMENTATION: 0.2,
        },
        "local": {
            STRUCTURE_NEWS: 0.2,
            STRUCTURE_BLOG: 0.1,
        },
    }
    return float(matrix.get(intent, {}).get(structure, 0.0))
