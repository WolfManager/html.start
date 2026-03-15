from __future__ import annotations

import hashlib
import re
from collections import deque
from datetime import timedelta
from html.parser import HTMLParser
from typing import Iterable
from urllib.parse import urldefrag, urljoin, urlparse
from urllib.request import Request, urlopen

from django.db.models import Avg
from django.utils import timezone

from core.models import CrawlRun, SearchBlockRule, SearchDocument, SearchSource


USER_AGENT = "MAGNETO-Bot/0.1 (+https://localhost)"
MAX_CONTENT_CHARS = 30000


class _HtmlDocumentParser(HTMLParser):
    def __init__(self, base_url: str):
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.in_title = False
        self.in_script = False
        self.in_style = False
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []
        self.links: list[str] = []
        self.meta_description = ""
        self.lang = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {key.lower(): (value or "") for key, value in attrs}
        tag_name = tag.lower()
        if tag_name == "title":
            self.in_title = True
        elif tag_name in {"script", "noscript"}:
            self.in_script = True
        elif tag_name == "style":
            self.in_style = True
        elif tag_name == "a":
            href = attrs_dict.get("href", "").strip()
            if href:
                self.links.append(urljoin(self.base_url, href))
        elif tag_name == "meta":
            name = attrs_dict.get("name", "").strip().lower()
            if name == "description" and not self.meta_description:
                self.meta_description = attrs_dict.get("content", "").strip()
        elif tag_name == "html" and not self.lang:
            self.lang = attrs_dict.get("lang", "").strip().lower()

    def handle_endtag(self, tag: str) -> None:
        tag_name = tag.lower()
        if tag_name == "title":
            self.in_title = False
        elif tag_name in {"script", "noscript"}:
            self.in_script = False
        elif tag_name == "style":
            self.in_style = False

    def handle_data(self, data: str) -> None:
        text = re.sub(r"\s+", " ", data or "").strip()
        if not text:
            return
        if self.in_title:
            self.title_parts.append(text)
            return
        if self.in_script or self.in_style:
            return
        self.text_parts.append(text)


def _normalize_url(url: str) -> str:
    clean, _fragment = urldefrag(str(url or "").strip())
    return clean[:-1] if clean.endswith("/") else clean


def _same_domain(url: str, allowed_domains: Iterable[str]) -> bool:
    hostname = (urlparse(url).hostname or "").lower()
    allowed = [str(item).strip().lower() for item in allowed_domains if str(item).strip()]
    return bool(hostname and any(hostname == domain or hostname.endswith(f".{domain}") for domain in allowed))


def _is_blocked(url: str, rules: Iterable[SearchBlockRule]) -> bool:
    lowered = url.lower()
    hostname = (urlparse(url).hostname or "").lower()
    for rule in rules:
        pattern = str(rule.pattern or "").strip()
        if not pattern:
            continue
        if rule.rule_type == SearchBlockRule.RULE_DOMAIN and hostname == pattern.lower():
            return True
        if rule.rule_type == SearchBlockRule.RULE_URL_CONTAINS and pattern.lower() in lowered:
            return True
        if rule.rule_type == SearchBlockRule.RULE_REGEX and re.search(pattern, url, flags=re.IGNORECASE):
            return True
    return False


def _fetch_html(url: str, timeout_seconds: int = 12) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    with urlopen(request, timeout=timeout_seconds) as response:
        content_type = str(response.headers.get("Content-Type") or "")
        if "html" not in content_type.lower():
            raise ValueError(f"Unsupported content type: {content_type}")
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read(MAX_CONTENT_CHARS * 2).decode(charset, errors="replace")


def _extract_document(url: str, html: str) -> dict[str, object]:
    parser = _HtmlDocumentParser(url)
    parser.feed(html)
    title = " ".join(parser.title_parts).strip()
    content = re.sub(r"\s+", " ", " ".join(parser.text_parts)).strip()[:MAX_CONTENT_CHARS]
    summary = parser.meta_description or content[:320]
    return {
        "title": title[:300],
        "summary": summary[:1200],
        "content": content,
        "links": [_normalize_url(link) for link in parser.links if link],
        "language": parser.lang.split("-", 1)[0] if parser.lang else "",
    }


def _compute_quality(title: str, summary: str, content: str) -> float:
    score = 0.0
    if len(title.strip()) >= 8:
        score += 30
    if len(summary.strip()) >= 40:
        score += 25
    score += min(45.0, len(content.strip()) / 50)
    return round(min(score, 100.0), 2)


def _should_recrawl(source: SearchSource) -> bool:
    if not source.last_crawled_at:
        return True
    return timezone.now() >= source.last_crawled_at + timedelta(hours=source.recrawl_interval_hours)


def crawl_source_by_id(source_id: int, *, trigger: str = "manual") -> CrawlRun:
    source = SearchSource.objects.get(pk=source_id)
    return crawl_source(source, trigger=trigger)


def crawl_source(source: SearchSource, *, trigger: str = "manual", max_pages: int | None = None) -> CrawlRun:
    run = CrawlRun.objects.create(source=source, trigger=trigger, status=CrawlRun.STATUS_RUNNING)
    block_rules = list(SearchBlockRule.objects.filter(is_active=True))
    queue = deque(_normalize_url(url) for url in (source.start_urls or [source.base_url]))
    visited: set[str] = set()
    depth_map = {url: 0 for url in queue}
    pages_limit = max_pages or source.max_pages
    max_depth = max(0, int(source.crawl_depth))
    allowed_domains = source.allowed_domains or [urlparse(source.base_url).hostname or ""]
    last_error = ""

    while queue and run.pages_seen < pages_limit:
        url = queue.popleft()
        if not url or url in visited:
            continue
        visited.add(url)

        if not _same_domain(url, allowed_domains) or _is_blocked(url, block_rules):
            run.pages_blocked += 1
            continue

        depth = depth_map.get(url, 0)
        run.pages_seen += 1
        try:
            html = _fetch_html(url)
            parsed = _extract_document(url, html)
            title = str(parsed["title"] or "")
            summary = str(parsed["summary"] or "")
            content = str(parsed["content"] or "")
            quality = _compute_quality(title, summary, content)

            _document, created = SearchDocument.objects.update_or_create(
                url=url,
                defaults={
                    "source": source,
                    "canonical_url": url,
                    "title": title,
                    "summary": summary,
                    "content": content,
                    "language": str(parsed["language"] or source.language_hint or ""),
                    "category": source.category_hint,
                    "tags": [source.category_hint] if source.category_hint else [],
                    "status": SearchDocument.STATUS_INDEXED,
                    "quality_score": quality,
                    "crawl_depth": depth,
                    "content_hash": hashlib.sha256(content.encode("utf-8", errors="ignore")).hexdigest(),
                    "fetched_at": timezone.now(),
                },
            )
            if created:
                run.pages_indexed += 1
            else:
                run.pages_updated += 1

            if depth < max_depth:
                for link in parsed["links"]:
                    clean_link = _normalize_url(str(link or ""))
                    if not clean_link or clean_link in visited:
                        continue
                    if not _same_domain(clean_link, allowed_domains) or _is_blocked(clean_link, block_rules):
                        continue
                    if clean_link not in depth_map:
                        depth_map[clean_link] = depth + 1
                        queue.append(clean_link)
        except Exception as exc:
            run.pages_failed += 1
            last_error = str(exc)

    run.finished_at = timezone.now()
    if run.pages_failed > 0 and run.pages_indexed == 0 and run.pages_updated == 0:
        run.status = CrawlRun.STATUS_FAILED
    elif run.pages_failed > 0:
        run.status = CrawlRun.STATUS_PARTIAL
    else:
        run.status = CrawlRun.STATUS_COMPLETED
    run.notes = last_error[:2000]
    run.save()

    source.last_crawled_at = run.finished_at
    source.last_status = run.status
    source.last_error = last_error[:2000]
    source.quality_score = SearchDocument.objects.filter(source=source).aggregate(avg=Avg("quality_score")).get("avg") or 0
    source.save(update_fields=["last_crawled_at", "last_status", "last_error", "quality_score", "updated_at"])
    return run


def crawl_due_sources(*, trigger: str = "scheduler", source_ids: Iterable[int] | None = None, max_pages: int | None = None) -> list[CrawlRun]:
    queryset = SearchSource.objects.filter(is_active=True)
    if source_ids is not None:
        queryset = queryset.filter(id__in=list(source_ids))
    runs: list[CrawlRun] = []
    for source in queryset:
        if source_ids is None and not _should_recrawl(source):
            continue
        runs.append(crawl_source(source, trigger=trigger, max_pages=max_pages))
    return runs
