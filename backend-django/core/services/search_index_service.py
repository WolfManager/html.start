from __future__ import annotations

from typing import Any

from core.models import SearchSource


DEFAULT_SOURCE_SPECS: list[dict[str, Any]] = [
    {"slug": "wikipedia-en", "name": "Wikipedia", "base_url": "https://www.wikipedia.org/", "start_urls": ["https://en.wikipedia.org/wiki/Main_Page"], "allowed_domains": ["en.wikipedia.org"], "language_hint": "en", "category_hint": "Knowledge", "max_pages": 30},
    {"slug": "wikipedia-ro", "name": "Wikipedia Romania", "base_url": "https://ro.wikipedia.org/", "start_urls": ["https://ro.wikipedia.org/wiki/Pagina_principal%C4%83"], "allowed_domains": ["ro.wikipedia.org"], "language_hint": "ro", "category_hint": "Knowledge", "max_pages": 30},
    {"slug": "mozilla-mdn", "name": "MDN Web Docs", "base_url": "https://developer.mozilla.org/", "start_urls": ["https://developer.mozilla.org/en-US/docs/Web"], "allowed_domains": ["developer.mozilla.org"], "language_hint": "en", "category_hint": "Development", "max_pages": 20},
    {"slug": "github-blog", "name": "GitHub Blog", "base_url": "https://github.blog/", "start_urls": ["https://github.blog/"], "allowed_domains": ["github.blog"], "language_hint": "en", "category_hint": "Development", "max_pages": 20},
    {"slug": "python-docs", "name": "Python Docs", "base_url": "https://docs.python.org/", "start_urls": ["https://docs.python.org/3/"], "allowed_domains": ["docs.python.org"], "language_hint": "en", "category_hint": "Development", "max_pages": 20},
    {"slug": "bbc-news", "name": "BBC News", "base_url": "https://www.bbc.com/", "start_urls": ["https://www.bbc.com/news"], "allowed_domains": ["www.bbc.com"], "language_hint": "en", "category_hint": "News", "max_pages": 20},
    {"slug": "reuters-world", "name": "Reuters", "base_url": "https://www.reuters.com/", "start_urls": ["https://www.reuters.com/world/"], "allowed_domains": ["www.reuters.com"], "language_hint": "en", "category_hint": "News", "max_pages": 20},
    {"slug": "hotnews", "name": "HotNews", "base_url": "https://hotnews.ro/", "start_urls": ["https://hotnews.ro/"], "allowed_domains": ["hotnews.ro"], "language_hint": "ro", "category_hint": "News", "max_pages": 20},
    {"slug": "g4media", "name": "G4Media", "base_url": "https://www.g4media.ro/", "start_urls": ["https://www.g4media.ro/"], "allowed_domains": ["www.g4media.ro"], "language_hint": "ro", "category_hint": "News", "max_pages": 20},
    {"slug": "digi24", "name": "Digi24", "base_url": "https://www.digi24.ro/", "start_urls": ["https://www.digi24.ro/"], "allowed_domains": ["www.digi24.ro"], "language_hint": "ro", "category_hint": "News", "max_pages": 20},
    {"slug": "arstechnica", "name": "Ars Technica", "base_url": "https://arstechnica.com/", "start_urls": ["https://arstechnica.com/"], "allowed_domains": ["arstechnica.com"], "language_hint": "en", "category_hint": "Technology", "max_pages": 20},
    {"slug": "theverge", "name": "The Verge", "base_url": "https://www.theverge.com/", "start_urls": ["https://www.theverge.com/tech"], "allowed_domains": ["www.theverge.com"], "language_hint": "en", "category_hint": "Technology", "max_pages": 20},
    {"slug": "unsplash", "name": "Unsplash", "base_url": "https://unsplash.com/", "start_urls": ["https://unsplash.com/"], "allowed_domains": ["unsplash.com"], "language_hint": "en", "category_hint": "Images", "max_pages": 20},
    {"slug": "pexels", "name": "Pexels", "base_url": "https://www.pexels.com/", "start_urls": ["https://www.pexels.com/"], "allowed_domains": ["www.pexels.com"], "language_hint": "en", "category_hint": "Images", "max_pages": 20},
    {"slug": "pixabay", "name": "Pixabay", "base_url": "https://pixabay.com/", "start_urls": ["https://pixabay.com/"], "allowed_domains": ["pixabay.com"], "language_hint": "en", "category_hint": "Images", "max_pages": 20},
    {"slug": "youtube-help", "name": "YouTube Help", "base_url": "https://support.google.com/youtube/", "start_urls": ["https://support.google.com/youtube/"], "allowed_domains": ["support.google.com"], "language_hint": "en", "category_hint": "Help", "max_pages": 20},
    {"slug": "coursera-blog", "name": "Coursera Blog", "base_url": "https://blog.coursera.org/", "start_urls": ["https://blog.coursera.org/"], "allowed_domains": ["blog.coursera.org"], "language_hint": "en", "category_hint": "Education", "max_pages": 20},
    {"slug": "khan-academy", "name": "Khan Academy", "base_url": "https://www.khanacademy.org/", "start_urls": ["https://www.khanacademy.org/"], "allowed_domains": ["www.khanacademy.org"], "language_hint": "en", "category_hint": "Education", "max_pages": 20},
    {"slug": "linkedin-blog", "name": "LinkedIn Blog", "base_url": "https://blog.linkedin.com/", "start_urls": ["https://blog.linkedin.com/"], "allowed_domains": ["blog.linkedin.com"], "language_hint": "en", "category_hint": "Career", "max_pages": 20},
    {"slug": "stackoverflow-blog", "name": "Stack Overflow Blog", "base_url": "https://stackoverflow.blog/", "start_urls": ["https://stackoverflow.blog/"], "allowed_domains": ["stackoverflow.blog"], "language_hint": "en", "category_hint": "Development", "max_pages": 20},
]


def seed_default_sources(force: bool = False) -> tuple[int, int]:
    created = 0
    updated = 0
    for spec in DEFAULT_SOURCE_SPECS:
        slug = str(spec["slug"])
        defaults = {key: value for key, value in spec.items() if key != "slug"}
        source, was_created = SearchSource.objects.get_or_create(slug=slug, defaults=defaults)
        if was_created:
            created += 1
            continue

        updated += 1
        if force:
            for key, value in defaults.items():
                setattr(source, key, value)
            source.save(update_fields=[*defaults.keys(), "updated_at"])
    return created, updated
