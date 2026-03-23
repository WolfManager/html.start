from unittest.mock import patch

from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIRequestFactory

from core.models import SearchDocument, SearchSource
from core.services.personalization_service import (
    apply_personalization,
    build_personalization_stats,
    build_personalization_profile,
    invalidate_personalization_profile_cache,
    resolve_user_hash,
)
from core.services.search_service import run_search_page
from core.views import admin_personalization_stats


class PersonalizationUtilityTests(SimpleTestCase):
    def tearDown(self) -> None:
        invalidate_personalization_profile_cache()

    def test_resolve_user_hash_is_stable(self) -> None:
        self.assertEqual(
            resolve_user_hash(session_key="session-1", ip="127.0.0.1"),
            resolve_user_hash(session_key="session-1", ip="127.0.0.1"),
        )

    @patch("core.services.personalization_service.read_analytics")
    def test_build_personalization_profile_uses_click_history(self, mock_read_analytics) -> None:
        user_hash = resolve_user_hash(session_key="session-1")
        mock_read_analytics.return_value = {
            "searches": [],
            "pageViews": [],
            "resultClicks": [
                {"userHash": user_hash, "url": "docs.python.org/tutorial", "category": "Development", "sourceSlug": "python-docs"},
                {"userHash": user_hash, "url": "docs.python.org/reference", "category": "Development", "sourceSlug": "python-docs"},
            ],
        }

        profile = build_personalization_profile(user_hash)

        self.assertTrue(profile["enabled"])
        self.assertEqual(profile["clickCount"], 2)
        self.assertEqual(profile["preferredDomains"][0][0], "docs.python.org")

    @patch("core.services.personalization_service.read_analytics")
    def test_apply_personalization_promotes_preferred_domain(self, mock_read_analytics) -> None:
        user_hash = resolve_user_hash(session_key="session-2")
        mock_read_analytics.return_value = {
            "searches": [],
            "pageViews": [],
            "resultClicks": [
                {"userHash": user_hash, "url": "docs.python.org/tutorial", "category": "Development", "sourceSlug": "python-docs"},
                {"userHash": user_hash, "url": "docs.python.org/reference", "category": "Development", "sourceSlug": "python-docs"},
            ],
        }
        results = [
            {"url": "github.com/org/repo", "category": "Development", "sourceSlug": "github", "title": "Repo"},
            {"url": "docs.python.org/3/tutorial", "category": "Development", "sourceSlug": "python-docs", "title": "Docs"},
        ]

        personalized = apply_personalization(results, user_hash=user_hash, query="python docs")

        self.assertEqual(personalized[0]["url"], "docs.python.org/3/tutorial")

    @patch("core.services.personalization_service.read_analytics")
    def test_build_personalization_stats_returns_expected_summary(self, mock_read_analytics) -> None:
        user_hash = resolve_user_hash(session_key="session-stats")
        mock_read_analytics.return_value = {
            "searches": [
                {"userHash": user_hash, "query": "python tutorial"},
                {"userHash": user_hash, "query": "python docs"},
            ],
            "pageViews": [],
            "resultClicks": [
                {"userHash": user_hash, "url": "docs.python.org/tutorial", "category": "Development", "sourceSlug": "python-docs"},
                {"userHash": user_hash, "url": "docs.python.org/reference", "category": "Development", "sourceSlug": "python-docs"},
                {"userHash": user_hash, "url": "github.com/org/repo", "category": "Development", "sourceSlug": "github"},
            ],
        }

        stats = build_personalization_stats(limit_users=5)

        self.assertEqual(stats["summary"]["searchEvents"], 2)
        self.assertEqual(stats["summary"]["clickEvents"], 3)
        self.assertEqual(stats["summary"]["eligibleUsers"], 1)
        self.assertEqual(stats["topDomains"][0]["domain"], "docs.python.org")

    @patch("core.views.build_personalization_stats")
    @patch("core.views._admin_auth_error", return_value=None)
    def test_admin_personalization_stats_endpoint_shape(self, _mock_auth, mock_stats) -> None:
        mock_stats.return_value = {
            "summary": {"clickEvents": 0},
            "topDomains": [],
            "topCategories": [],
            "topSources": [],
            "topUsers": [],
        }
        request = APIRequestFactory().get("/api/admin/personalization/stats?limit=5")

        response = admin_personalization_stats(request)

        self.assertEqual(response.status_code, 200)
        self.assertIn("generatedAt", response.data)
        self.assertIn("personalization", response.data)
        self.assertIn("summary", response.data["personalization"])


class PersonalizationIntegrationTests(TestCase):
    def tearDown(self) -> None:
        invalidate_personalization_profile_cache()

    @patch("core.services.personalization_service.read_analytics")
    def test_run_search_page_applies_personalization_reranking(self, mock_read_analytics) -> None:
        preferred_source = SearchSource.objects.create(
            slug="python-docs",
            name="Python Docs",
            base_url="https://docs.python.org",
            start_urls=["https://docs.python.org"],
            allowed_domains=["docs.python.org"],
            language_hint="en",
            category_hint="Development",
        )
        other_source = SearchSource.objects.create(
            slug="github",
            name="GitHub",
            base_url="https://github.com",
            start_urls=["https://github.com"],
            allowed_domains=["github.com"],
            language_hint="en",
            category_hint="Development",
        )
        SearchDocument.objects.create(
            source=other_source,
            url="https://github.com/org/python-tutorial",
            title="Python Tutorial Repository",
            summary="Python tutorial and examples",
            content="Python tutorial examples and guide",
            language="en",
            category="Development",
            tags=["python", "tutorial"],
            quality_score=92,
        )
        SearchDocument.objects.create(
            source=preferred_source,
            url="https://docs.python.org/3/tutorial/index.html",
            title="Python Tutorial",
            summary="Official Python tutorial",
            content="Python tutorial official documentation",
            language="en",
            category="Development",
            tags=["python", "tutorial"],
            quality_score=82,
        )

        user_hash = resolve_user_hash(session_key="session-3")
        mock_read_analytics.return_value = {
            "searches": [],
            "pageViews": [],
            "resultClicks": [
                {"userHash": user_hash, "url": "docs.python.org/tutorial", "category": "Development", "sourceSlug": "python-docs"},
                {"userHash": user_hash, "url": "docs.python.org/reference", "category": "Development", "sourceSlug": "python-docs"},
            ],
        }

        payload = run_search_page("python tutorial", user_id=user_hash)

        self.assertEqual(payload["results"][0]["sourceSlug"], "python-docs")
