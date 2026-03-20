from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from core.models import SearchDocument, SearchSource
from core.services.analytics_service import log_result_click
from core.services.search_service import invalidate_click_signal_cache, run_search, run_search_page


class SearchEngineTests(TestCase):
    def test_seed_search_sources_creates_curated_sources(self) -> None:
        call_command("seed_search_sources")
        self.assertGreaterEqual(SearchSource.objects.count(), 20)

    def test_run_search_prefers_database_documents(self) -> None:
        source = SearchSource.objects.create(
            slug="images-test",
            name="Images Test",
            base_url="https://example.com",
            start_urls=["https://example.com"],
            allowed_domains=["example.com"],
            language_hint="ro",
            category_hint="Images",
        )
        SearchDocument.objects.create(
            source=source,
            url="https://example.com/poze-vechi",
            title="Poze vechi din anii 2000",
            summary="Galerie de imagini si fotografii istorice.",
            content="poze imagini fotografii anii 2000 colectie arhiva vizuala",
            language="ro",
            category="Images",
            tags=["poze", "imagini", "fotografii"],
            quality_score=85,
        )

        results = run_search("poze din anii 200")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["url"], "https://example.com/poze-vechi")

    @patch("core.services.search_service._read_search_index", return_value=[])
    def test_run_search_returns_empty_when_no_db_or_local_match(self, _mock_read) -> None:
        results = run_search("query fara rezultate")
        self.assertEqual(results, [])

    def test_run_search_applies_language_and_category_filters(self) -> None:
        source = SearchSource.objects.create(
            slug="news-ro",
            name="News RO",
            base_url="https://news.example.com",
            start_urls=["https://news.example.com"],
            allowed_domains=["news.example.com"],
            language_hint="ro",
            category_hint="News",
        )
        SearchDocument.objects.create(
            source=source,
            url="https://news.example.com/stiri-tech",
            title="Stiri tech azi",
            summary="noutati tehnologie si cercetare",
            content="stiri tehnologie romania",
            language="ro",
            category="News",
            tags=["stiri", "tech"],
            quality_score=80,
        )
        SearchDocument.objects.create(
            source=source,
            url="https://news.example.com/news-en",
            title="Tech news today",
            summary="technology updates",
            content="tech news",
            language="en",
            category="News",
            tags=["news", "tech"],
            quality_score=80,
        )

        ro_results = run_search("stiri tech", language="ro", category="news")
        self.assertEqual(len(ro_results), 1)
        self.assertEqual(ro_results[0]["language"], "ro")

    def test_run_search_respects_limit(self) -> None:
        source = SearchSource.objects.create(
            slug="limit-test",
            name="Limit Test",
            base_url="https://limit.example.com",
            start_urls=["https://limit.example.com"],
            allowed_domains=["limit.example.com"],
            language_hint="en",
            category_hint="Development",
        )
        for idx in range(5):
            SearchDocument.objects.create(
                source=source,
                url=f"https://limit.example.com/doc-{idx}",
                title=f"Python tutorial {idx}",
                summary="python programming guide",
                content="python code tutorial",
                language="en",
                category="Development",
                tags=["python", "tutorial"],
                quality_score=60 + idx,
            )

        results = run_search("python tutorial", limit=2)
        self.assertEqual(len(results), 2)

    def test_run_search_page_returns_pagination_metadata(self) -> None:
        source = SearchSource.objects.create(
            slug="page-test",
            name="Page Test",
            base_url="https://pages.example.com",
            start_urls=["https://pages.example.com"],
            allowed_domains=["pages.example.com"],
            language_hint="en",
            category_hint="Knowledge",
        )
        for idx in range(6):
            SearchDocument.objects.create(
                source=source,
                url=f"https://pages.example.com/item-{idx}",
                title=f"Python guide part {idx}",
                summary="python guide for developers",
                content="python guide coding",
                language="en",
                category="Knowledge",
                tags=["python", "guide"],
                quality_score=70 + idx,
            )

        payload = run_search_page("python guide", limit=2, offset=2)
        self.assertEqual(payload["total"], 6)
        self.assertEqual(payload["page"], 2)
        self.assertEqual(payload["totalPages"], 3)
        self.assertEqual(len(payload["results"]), 2)
        self.assertTrue(payload["hasNextPage"])
        self.assertTrue(payload["hasPrevPage"])

    @patch(
        "core.services.search_service._read_query_rewrite_rules",
        return_value=[
            {
                "enabled": True,
                "matchType": "exact",
                "from": "pythn",
                "to": "python",
                "reason": "common-typo",
            }
        ],
    )
    def test_run_search_page_applies_query_rewrite_rules(self, _mock_rules) -> None:
        source = SearchSource.objects.create(
            slug="rewrite-test",
            name="Rewrite Test",
            base_url="https://rewrite.example.com",
            start_urls=["https://rewrite.example.com"],
            allowed_domains=["rewrite.example.com"],
            language_hint="en",
            category_hint="Development",
        )
        SearchDocument.objects.create(
            source=source,
            url="https://rewrite.example.com/python-guide",
            title="Python guide",
            summary="python tutorial",
            content="python guide tutorial",
            language="en",
            category="Development",
            tags=["python", "tutorial"],
            quality_score=85,
        )

        payload = run_search_page("pythn")
        self.assertEqual(payload["queryUsed"], "python")
        self.assertIsInstance(payload["queryRewrite"], dict)
        self.assertEqual(payload["queryRewrite"]["reason"], "common-typo")
        self.assertEqual(payload["total"], 1)

    def test_run_search_page_returns_facets(self) -> None:
        source_ro = SearchSource.objects.create(
            slug="facet-ro",
            name="Facet RO",
            base_url="https://facet-ro.example.com",
            start_urls=["https://facet-ro.example.com"],
            allowed_domains=["facet-ro.example.com"],
            language_hint="ro",
            category_hint="News",
        )
        source_en = SearchSource.objects.create(
            slug="facet-en",
            name="Facet EN",
            base_url="https://facet-en.example.com",
            start_urls=["https://facet-en.example.com"],
            allowed_domains=["facet-en.example.com"],
            language_hint="en",
            category_hint="Development",
        )
        SearchDocument.objects.create(
            source=source_ro,
            url="https://facet-ro.example.com/doc",
            title="Stiri python zilnice",
            summary="stiri despre python",
            content="python stiri",
            language="ro",
            category="News",
            tags=["python", "stiri"],
            quality_score=80,
        )
        SearchDocument.objects.create(
            source=source_en,
            url="https://facet-en.example.com/doc",
            title="Python developer news",
            summary="python updates",
            content="python news",
            language="en",
            category="Development",
            tags=["python", "news"],
            quality_score=80,
        )

        payload = run_search_page("python")
        facets = payload["facets"]

        self.assertGreaterEqual(len(facets["languages"]), 2)
        language_values = {entry["value"] for entry in facets["languages"]}
        self.assertIn("ro", language_values)
        self.assertIn("en", language_values)

    def test_run_search_page_facets_are_contextual(self) -> None:
        source = SearchSource.objects.create(
            slug="facet-contextual",
            name="Facet Contextual",
            base_url="https://facet-context.example.com",
            start_urls=["https://facet-context.example.com"],
            allowed_domains=["facet-context.example.com"],
            language_hint="en",
            category_hint="Knowledge",
        )
        SearchDocument.objects.create(
            source=source,
            url="https://facet-context.example.com/ro",
            title="Python ghid complet",
            summary="ghid python in romana",
            content="python ghid tutorial",
            language="ro",
            category="Knowledge",
            tags=["python", "ghid"],
            quality_score=75,
        )
        SearchDocument.objects.create(
            source=source,
            url="https://facet-context.example.com/en",
            title="Python full guide",
            summary="python guide in english",
            content="python guide tutorial",
            language="en",
            category="Knowledge",
            tags=["python", "guide"],
            quality_score=75,
        )

        payload = run_search_page("python guide", language="ro")

        self.assertEqual(payload["total"], 1)
        language_values = {entry["value"] for entry in payload["facets"]["languages"]}
        self.assertIn("ro", language_values)
        self.assertIn("en", language_values)

    def test_run_search_matches_short_ai_token(self) -> None:
        source = SearchSource.objects.create(
            slug="ai-test",
            name="AI Test",
            base_url="https://ai.example.com",
            start_urls=["https://ai.example.com"],
            allowed_domains=["ai.example.com"],
            language_hint="en",
            category_hint="AI",
        )
        SearchDocument.objects.create(
            source=source,
            url="https://ai.example.com/intro",
            title="AI systems overview",
            summary="artificial intelligence and machine learning basics",
            content="ai artificial intelligence machine learning",
            language="en",
            category="AI",
            tags=["ai", "machine learning"],
            quality_score=82,
        )

        results = run_search("ai")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["url"], "https://ai.example.com/intro")

    def test_run_search_matches_python_typo(self) -> None:
        source = SearchSource.objects.create(
            slug="typo-test",
            name="Typo Test",
            base_url="https://typo.example.com",
            start_urls=["https://typo.example.com"],
            allowed_domains=["typo.example.com"],
            language_hint="en",
            category_hint="Development",
        )
        SearchDocument.objects.create(
            source=source,
            url="https://typo.example.com/python-guide",
            title="Python guide",
            summary="python programming tutorial for developers",
            content="python tutorial code",
            language="en",
            category="Development",
            tags=["python", "tutorial"],
            quality_score=78,
        )

        results = run_search("pythn")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["url"], "https://typo.example.com/python-guide")

    def test_run_search_supports_site_operator(self) -> None:
        source = SearchSource.objects.create(
            slug="site-operator",
            name="Site Operator",
            base_url="https://docs.python.org",
            start_urls=["https://docs.python.org"],
            allowed_domains=["docs.python.org"],
            language_hint="en",
            category_hint="Development",
        )
        SearchDocument.objects.create(
            source=source,
            url="https://docs.python.org/3/tutorial/",
            title="Python tutorial",
            summary="official python docs tutorial",
            content="python documentation tutorial",
            language="en",
            category="Development",
            tags=["python", "docs"],
            quality_score=88,
        )
        SearchDocument.objects.create(
            source=source,
            url="https://example.com/python-guide",
            title="Python external guide",
            summary="guide from another domain",
            content="python guide",
            language="en",
            category="Development",
            tags=["python", "guide"],
            quality_score=70,
        )

        results = run_search("site:docs.python.org python")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["url"], "https://docs.python.org/3/tutorial/")

    def test_run_search_supports_excluded_site_operator(self) -> None:
        source = SearchSource.objects.create(
            slug="exclude-site-operator",
            name="Exclude Site Operator",
            base_url="https://docs.python.org",
            start_urls=["https://docs.python.org"],
            allowed_domains=["docs.python.org"],
            language_hint="en",
            category_hint="Development",
        )
        SearchDocument.objects.create(
            source=source,
            url="https://docs.python.org/3/reference/",
            title="Python reference",
            summary="official reference docs",
            content="python reference",
            language="en",
            category="Development",
            tags=["python", "reference"],
            quality_score=84,
        )
        SearchDocument.objects.create(
            source=source,
            url="https://realpython.com/python-basics",
            title="Python basics",
            summary="python tutorial outside docs.python.org",
            content="python basics tutorial",
            language="en",
            category="Development",
            tags=["python", "tutorial"],
            quality_score=82,
        )

        results = run_search("-site:docs.python.org python")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["url"], "https://realpython.com/python-basics")

    def test_run_search_supports_intitle_operator(self) -> None:
        source = SearchSource.objects.create(
            slug="intitle-operator",
            name="Intitle Operator",
            base_url="https://intitle.example.com",
            start_urls=["https://intitle.example.com"],
            allowed_domains=["intitle.example.com"],
            language_hint="en",
            category_hint="Development",
        )
        SearchDocument.objects.create(
            source=source,
            url="https://intitle.example.com/python-docs",
            title="Python API documentation",
            summary="official guide",
            content="python docs",
            language="en",
            category="Development",
            tags=["python", "api"],
            quality_score=86,
        )
        SearchDocument.objects.create(
            source=source,
            url="https://intitle.example.com/python-blog",
            title="Python blog post",
            summary="includes api examples",
            content="python api examples",
            language="en",
            category="Development",
            tags=["python", "api"],
            quality_score=80,
        )

        results = run_search("intitle:documentation python")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["url"], "https://intitle.example.com/python-docs")

    def test_run_search_supports_inurl_operator(self) -> None:
        source = SearchSource.objects.create(
            slug="inurl-operator",
            name="Inurl Operator",
            base_url="https://inurl.example.com",
            start_urls=["https://inurl.example.com"],
            allowed_domains=["inurl.example.com"],
            language_hint="en",
            category_hint="Development",
        )
        SearchDocument.objects.create(
            source=source,
            url="https://inurl.example.com/api/python-reference",
            title="Python reference",
            summary="reference docs",
            content="python api reference",
            language="en",
            category="Development",
            tags=["python", "api"],
            quality_score=83,
        )
        SearchDocument.objects.create(
            source=source,
            url="https://inurl.example.com/tutorial/python-basics",
            title="Python basics",
            summary="tutorial",
            content="python tutorial",
            language="en",
            category="Development",
            tags=["python", "tutorial"],
            quality_score=80,
        )

        results = run_search("inurl:api python")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["url"], "https://inurl.example.com/api/python-reference")

    def test_run_search_supports_filetype_operator(self) -> None:
        source = SearchSource.objects.create(
            slug="filetype-operator",
            name="Filetype Operator",
            base_url="https://filetype.example.com",
            start_urls=["https://filetype.example.com"],
            allowed_domains=["filetype.example.com"],
            language_hint="en",
            category_hint="Development",
        )
        SearchDocument.objects.create(
            source=source,
            url="https://filetype.example.com/reports/python-ai.pdf",
            title="Python AI report",
            summary="pdf report",
            content="python ai report",
            language="en",
            category="Development",
            tags=["python", "ai"],
            quality_score=84,
        )
        SearchDocument.objects.create(
            source=source,
            url="https://filetype.example.com/reports/python-ai.html",
            title="Python AI article",
            summary="html article",
            content="python ai article",
            language="en",
            category="Development",
            tags=["python", "ai"],
            quality_score=79,
        )

        results = run_search("filetype:pdf python")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["url"], "https://filetype.example.com/reports/python-ai.pdf")

    @patch("core.services.search_service.read_analytics")
    def test_run_search_uses_click_signal_for_relevance(self, mock_read_analytics) -> None:
        invalidate_click_signal_cache()
        source = SearchSource.objects.create(
            slug="click-signal",
            name="Click Signal",
            base_url="https://click.example.com",
            start_urls=["https://click.example.com"],
            allowed_domains=["click.example.com"],
            language_hint="en",
            category_hint="Development",
        )
        SearchDocument.objects.create(
            source=source,
            url="https://click.example.com/a",
            title="Python guide alpha",
            summary="python guide",
            content="python guide",
            language="en",
            category="Development",
            tags=["python", "guide"],
            quality_score=80,
        )
        SearchDocument.objects.create(
            source=source,
            url="https://click.example.com/b",
            title="Python guide beta",
            summary="python guide",
            content="python guide",
            language="en",
            category="Development",
            tags=["python", "guide"],
            quality_score=80,
        )

        mock_read_analytics.return_value = {
            "searches": [],
            "pageViews": [],
            "resultClicks": [
                {
                    "url": "https://click.example.com/b",
                    "query": "python guide",
                    "at": "2026-03-20T12:00:00Z",
                },
                {
                    "url": "https://click.example.com/b",
                    "query": "python guide",
                    "at": "2026-03-20T12:01:00Z",
                },
            ],
        }

        results = run_search("python guide", sort="relevance")
        self.assertGreaterEqual(len(results), 2)
        self.assertEqual(results[0]["url"], "https://click.example.com/b")

    @patch("core.services.analytics_service.write_analytics")
    @patch("core.services.analytics_service.read_analytics")
    def test_log_result_click_deduplicates_recent_identical_clicks(self, mock_read_analytics, mock_write_analytics) -> None:
        mock_read_analytics.return_value = {
            "searches": [],
            "pageViews": [],
            "resultClicks": [
                {
                    "id": "c-1",
                    "url": "strong.example.com/python-reference",
                    "title": "Python reference",
                    "query": "python reference",
                    "ip": "127.0.0.1",
                    "at": "2099-03-20T12:00:00Z",
                }
            ],
        }

        with patch("core.services.analytics_service.time.time", return_value=4077681600.0):
            with patch("core.services.analytics_service.time.strftime", return_value="2099-03-20T12:00:05Z"):
                log_result_click(
                    url="https://strong.example.com/python-reference",
                    title="Python reference",
                    query="python reference",
                    ip="127.0.0.1",
                )

        mock_write_analytics.assert_not_called()

    @patch("core.services.analytics_service.write_analytics")
    @patch("core.services.analytics_service.read_analytics")
    def test_log_search_marks_zero_results(self, mock_read_analytics, mock_write_analytics) -> None:
        from core.services.analytics_service import log_search

        mock_read_analytics.return_value = {
            "searches": [],
            "pageViews": [],
            "resultClicks": [],
        }

        with patch("core.services.analytics_service.time.time", return_value=4077681600.0):
            with patch("core.services.analytics_service.time.strftime", return_value="2099-03-20T12:00:00Z"):
                log_search(query="no hits", result_count=0, ip="127.0.0.1")

        written = mock_write_analytics.call_args.args[0]
        entry = written["searches"][-1]
        self.assertEqual(entry["query"], "no hits")
        self.assertEqual(entry["normalizedQuery"], "no hits")
        self.assertEqual(entry["resultCount"], 0)
        self.assertEqual(entry["zeroResults"], True)
        self.assertIsNone(entry["reformulatesSearchId"])
        self.assertIsNone(entry["reformulationType"])

    @patch("core.services.analytics_service.write_analytics")
    @patch("core.services.analytics_service.read_analytics")
    def test_log_search_marks_zero_result_reformulation(self, mock_read_analytics, mock_write_analytics) -> None:
        from core.services.analytics_service import log_search

        mock_read_analytics.return_value = {
            "searches": [
                {
                    "id": "s-prev",
                    "query": "pythn",
                    "normalizedQuery": "pythn",
                    "resultCount": 0,
                    "zeroResults": True,
                    "ip": "127.0.0.1",
                    "at": "2099-03-20T11:55:00Z",
                }
            ],
            "pageViews": [],
            "resultClicks": [],
        }

        with patch("core.services.analytics_service.time.time", return_value=4077681600.0):
            with patch("core.services.analytics_service.time.strftime", return_value="2099-03-20T12:00:00Z"):
                log_search(query="python", result_count=5, ip="127.0.0.1")

        written = mock_write_analytics.call_args.args[0]
        entry = written["searches"][-1]
        self.assertEqual(entry["reformulatesSearchId"], "s-prev")
        self.assertEqual(entry["reformulationType"], "zero-results-refinement")

    def test_run_search_uses_source_authority_for_relevance(self) -> None:
        strong_source = SearchSource.objects.create(
            slug="authority-strong",
            name="Authority Strong",
            base_url="https://strong.example.com",
            start_urls=["https://strong.example.com"],
            allowed_domains=["strong.example.com"],
            language_hint="en",
            category_hint="Development",
            quality_score=95,
        )
        weak_source = SearchSource.objects.create(
            slug="authority-weak",
            name="Authority Weak",
            base_url="https://weak.example.com",
            start_urls=["https://weak.example.com"],
            allowed_domains=["weak.example.com"],
            language_hint="en",
            category_hint="Development",
            quality_score=20,
        )

        SearchDocument.objects.create(
            source=weak_source,
            url="https://weak.example.com/python-reference",
            title="Python reference guide",
            summary="python reference guide",
            content="python reference guide",
            language="en",
            category="Development",
            tags=["python", "reference"],
            quality_score=80,
        )
        SearchDocument.objects.create(
            source=strong_source,
            url="https://strong.example.com/python-reference",
            title="Python reference guide",
            summary="python reference guide",
            content="python reference guide",
            language="en",
            category="Development",
            tags=["python", "reference"],
            quality_score=80,
        )

        results = run_search("python reference", sort="relevance")
        self.assertGreaterEqual(len(results), 2)
        self.assertEqual(results[0]["url"], "https://strong.example.com/python-reference")

