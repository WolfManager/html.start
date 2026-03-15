from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from core.models import SearchDocument, SearchSource
from core.services.search_service import run_search, run_search_page


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
