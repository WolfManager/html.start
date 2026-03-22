import json
import os
from typing import cast
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient


class CoreApiTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()

    def _admin_token(self) -> str:
        admin_password = str(os.getenv("ADMIN_PASSWORD", "change-this-password"))
        response = self.client.post(
            "/api/auth/login",
            {"username": "admin", "password": admin_password},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        payload = self._json(response)
        token = payload.get("token")
        self.assertTrue(isinstance(token, str) and token)
        return cast(str, token)

    def _json(self, response) -> dict:
        try:
            return json.loads(response.content.decode("utf-8"))
        except Exception:
            return {}

    def test_health_endpoint_returns_runtime_and_headers(self) -> None:
        response = self.client.get("/api/health")
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("status"), "ok")
        self.assertEqual(payload.get("service"), "magneto-django")
        self.assertIn("X-Request-ID", response)
        self.assertIn("X-Response-Time-Ms", response)

    def test_runtime_metrics_requires_admin_auth(self) -> None:
        response = self.client.get("/api/admin/runtime-metrics")
        self.assertEqual(response.status_code, 401)

    def test_auth_login_rejects_invalid_credentials(self) -> None:
        response = self.client.post(
            "/api/auth/login",
            {"username": "admin", "password": "wrong-password"},
            format="json",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 401)
        self.assertIn("error", payload)

    def test_admin_overview_requires_admin_auth(self) -> None:
        response = self.client.get("/api/admin/overview?range=7d")
        self.assertEqual(response.status_code, 401)

    def test_admin_overview_returns_expected_shape_for_admin(self) -> None:
        token = self._admin_token()
        response = self.client.get(
            "/api/admin/overview?range=invalid",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("range"), "all")
        self.assertIn("generatedAt", payload)
        self.assertIn("totals", payload)
        self.assertIn("topQueries", payload)
        self.assertIn("trafficByPage", payload)
        self.assertIn("latestSearches", payload)
        self.assertIn("trends", payload)

    def test_admin_assistant_status_requires_admin_auth(self) -> None:
        response = self.client.get("/api/admin/assistant-status")
        self.assertEqual(response.status_code, 401)

    def test_admin_assistant_status_returns_expected_shape_for_admin(self) -> None:
        token = self._admin_token()
        response = self.client.get(
            "/api/admin/assistant-status",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertIn("generatedAt", payload)
        assistant = payload.get("assistant") or {}
        self.assertIn("providers", assistant)
        self.assertIn("limits", assistant)
        self.assertIn("metrics", assistant)
        self.assertIn("cache", assistant)
        self.assertIn("memory", assistant)
        self.assertIn("billing", assistant)

    def test_admin_click_signal_reset_requires_admin_auth(self) -> None:
        response = self.client.post("/api/admin/click-signal/reset", {}, format="json")
        self.assertEqual(response.status_code, 401)

    @patch(
        "core.views.set_click_signal_telemetry",
    )
    @patch(
        "core.views.create_click_signal_telemetry_state",
        return_value={
            "searchesEvaluated": 0,
            "docsEvaluated": 0,
            "boostApplied": 0,
            "suppressedMinBase": 0,
            "suppressedNoSignal": 0,
            "cappedByGuardrail": 0,
            "totalBoost": 0,
            "lastUpdatedAt": "",
            "lastRun": None,
        },
    )
    def test_admin_click_signal_reset_returns_expected_shape(
        self,
        mock_create_click_signal_telemetry_state,
        mock_set_click_signal_telemetry,
    ) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/click-signal/reset",
            {},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("ok"), True)
        self.assertIn("generatedAt", payload)
        telemetry = payload.get("clickSignalTelemetry") or {}
        self.assertEqual(telemetry.get("searchesEvaluated"), 0)
        self.assertIsNone(telemetry.get("lastRun"))
        mock_create_click_signal_telemetry_state.assert_called_once()
        mock_set_click_signal_telemetry.assert_called_once()

    def test_admin_click_signal_snapshot_reset_requires_admin_auth(self) -> None:
        response = self.client.post("/api/admin/click-signal/snapshot-reset", {}, format="json")
        self.assertEqual(response.status_code, 401)

    @patch(
        "core.views.set_click_signal_telemetry",
    )
    @patch(
        "core.views.create_click_signal_telemetry_state",
        return_value={
            "searchesEvaluated": 0,
            "docsEvaluated": 0,
            "boostApplied": 0,
            "suppressedMinBase": 0,
            "suppressedNoSignal": 0,
            "cappedByGuardrail": 0,
            "totalBoost": 0,
            "lastUpdatedAt": "",
            "lastRun": None,
        },
    )
    @patch(
        "core.views.get_click_signal_telemetry",
        return_value={
            "searchesEvaluated": 3,
            "docsEvaluated": 30,
            "boostApplied": 4,
            "suppressedMinBase": 1,
            "suppressedNoSignal": 2,
            "cappedByGuardrail": 1,
            "totalBoost": 6.5,
            "lastUpdatedAt": "2026-03-22T09:00:00Z",
            "lastRun": None,
        },
    )
    def test_admin_click_signal_snapshot_reset_returns_snapshot_and_reset_payload(
        self,
        mock_get_click_signal_telemetry,
        mock_create_click_signal_telemetry_state,
        mock_set_click_signal_telemetry,
    ) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/click-signal/snapshot-reset",
            {},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("ok"), True)
        self.assertIn("generatedAt", payload)
        self.assertIn("snapshot", payload)
        snapshot = payload.get("snapshot") or {}
        self.assertIn("generatedAt", snapshot)
        self.assertIn("clickSignalConfig", snapshot)
        self.assertIn("clickSignalTelemetry", snapshot)
        self.assertEqual(snapshot["clickSignalTelemetry"].get("searchesEvaluated"), 3)
        self.assertEqual((payload.get("clickSignalTelemetry") or {}).get("searchesEvaluated"), 0)
        mock_get_click_signal_telemetry.assert_called_once()
        mock_create_click_signal_telemetry_state.assert_called_once()
        mock_set_click_signal_telemetry.assert_called_once()

    def test_search_requires_query(self) -> None:
        response = self.client.get("/api/search")
        payload = self._json(response)

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", payload)

    @patch(
        "core.views.run_search_page",
        return_value={
            "queryUsed": "alpha",
            "appliedOperators": {
                "site": [],
                "excludedSite": [],
                "filetype": [],
                "inurl": [],
                "intitle": [],
                "cleanedQuery": "alpha",
            },
            "queryRewrite": None,
            "queryCorrection": None,
            "querySuggestion": None,
            "results": [{"title": "A", "url": "https://example.com", "summary": "S"}],
            "total": 1,
            "limit": 20,
            "offset": 0,
            "page": 1,
            "totalPages": 1,
            "hasNextPage": False,
            "hasPrevPage": False,
            "facets": {"languages": [], "categories": [], "sources": []},
        },
    )
    @patch("core.views.get_related_queries", return_value=["beta"])
    @patch("core.views.log_search")
    def test_search_returns_ranked_results(
        self,
        mock_log_search,
        mock_get_related_queries,
        _mock_run_search_page,
    ) -> None:
        response = self.client.get("/api/search?q=alpha")
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("engine"), "MAGNETO Core")
        self.assertEqual(payload.get("query"), "alpha")
        self.assertEqual(payload.get("queryUsed"), "alpha")
        self.assertEqual((payload.get("appliedOperators") or {}).get("cleanedQuery"), "alpha")
        self.assertIsNone(payload.get("queryRewrite"))
        self.assertIsNone(payload.get("queryCorrection"))
        self.assertIsNone(payload.get("querySuggestion"))
        self.assertEqual(payload.get("suggestions"), [])
        self.assertEqual(payload.get("relatedQueries"), ["beta"])
        self.assertEqual(payload.get("servedBy"), "django")
        self.assertEqual(payload.get("total"), 1)
        self.assertEqual(len(payload.get("results") or []), 1)
        mock_log_search.assert_called_once()
        mock_get_related_queries.assert_called_once_with("alpha", 6)

    @patch(
        "core.views.get_trending_searches_payload",
        return_value={
            "ok": True,
            "generatedAt": "2026-03-22T09:05:33Z",
            "period": "weekly",
            "windowDays": 7,
            "total": 1,
            "items": [
                {
                    "query": "api documentation",
                    "hits": 3,
                    "positiveHits": 3,
                    "avgResults": 12.5,
                    "firstSeen": "2026-03-20T10:00:00Z",
                    "lastSeen": "2026-03-22T10:00:00Z",
                    "trendScore": 24.5,
                    "buckets": [
                        {"bucket": "2026-03-22", "count": 3, "positiveHits": 3}
                    ],
                }
            ],
            "buckets": [
                {
                    "bucket": "2026-03-22",
                    "totalSearches": 3,
                    "positiveSearches": 3,
                    "uniqueQueries": 1,
                }
            ],
        },
    )
    def test_search_trending_returns_expected_shape(self, mock_get_trending_searches_payload) -> None:
        response = self.client.get("/api/search/trending?period=weekly&limit=3&includeZero=true&q=api")
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("ok"), True)
        self.assertEqual(payload.get("servedBy"), "django")
        self.assertEqual(payload.get("period"), "weekly")
        self.assertEqual(payload.get("total"), 1)
        self.assertEqual((payload.get("items") or [])[0].get("query"), "api documentation")
        mock_get_trending_searches_payload.assert_called_once_with(
            period="weekly",
            limit=3,
            include_zero=True,
            query="api",
        )

    def test_search_related_requires_query(self) -> None:
        response = self.client.get("/api/search/related")
        payload = self._json(response)

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", payload)

    @patch("core.views.get_related_queries", return_value=["contract-test", "test"])
    def test_search_related_returns_expected_shape(self, mock_get_related_queries) -> None:
        response = self.client.get("/api/search/related?q=api%20documentation&limit=4")
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("ok"), True)
        self.assertEqual(payload.get("query"), "api documentation")
        self.assertEqual(payload.get("related"), ["contract-test", "test"])
        self.assertEqual(payload.get("servedBy"), "django")
        mock_get_related_queries.assert_called_once_with("api documentation", 4)

    @patch(
        "core.views.get_popular_searches_payload",
        return_value={
            "ok": True,
            "queries": ["api documentation", "test"],
            "generatedAt": "2026-03-22T09:05:48Z",
        },
    )
    def test_popular_searches_returns_expected_shape(self, mock_get_popular_searches_payload) -> None:
        response = self.client.get("/api/analytics/popular-searches")
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("ok"), True)
        self.assertEqual(payload.get("queries"), ["api documentation", "test"])
        self.assertIn("generatedAt", payload)
        mock_get_popular_searches_payload.assert_called_once_with()

    @patch("core.views.log_page_view")
    def test_page_view_event_returns_ok(self, mock_log_page_view) -> None:
        response = self.client.post(
            "/api/events/page-view",
            {"page": "index.html"},
            format="json",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("ok"), True)
        mock_log_page_view.assert_called_once()

    @patch("core.views.invalidate_click_signal_cache")
    @patch("core.views.log_result_click")
    def test_result_click_event_returns_ok(self, mock_log_result_click, mock_invalidate_click_signal_cache) -> None:
        response = self.client.post(
            "/api/events/result-click",
            {
                "url": "https://example.com/docs",
                "title": "Example Docs",
                "query": "example docs",
            },
            format="json",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("ok"), True)
        mock_log_result_click.assert_called_once()
        mock_invalidate_click_signal_cache.assert_called_once()

    def test_result_click_requires_url_and_query(self) -> None:
        response = self.client.post(
            "/api/events/result-click",
            {"title": "Missing fields"},
            format="json",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", payload)

    def test_admin_search_rewrite_rules_requires_admin_auth(self) -> None:
        response = self.client.get("/api/admin/search/rewrite-rules")
        self.assertEqual(response.status_code, 401)

    def test_admin_search_rewrite_rule_suggestions_requires_admin_auth(self) -> None:
        response = self.client.get("/api/admin/search/rewrite-rules/suggestions")
        self.assertEqual(response.status_code, 401)

    @patch(
        "core.views._build_rewrite_rule_suggestions",
        return_value=[
            {
                "enabled": True,
                "matchType": "exact",
                "from": "opnai",
                "to": "openai",
                "reason": "telemetry-suggested",
                "signals": {"reformulations": 3, "maxImprovement": 10, "confidence": 0.85},
            }
        ],
    )
    def test_admin_search_rewrite_rule_suggestions_returns_items_for_admin(
        self,
        mock_build_rewrite_rule_suggestions,
    ) -> None:
        token = self._admin_token()
        response = self.client.get(
            "/api/admin/search/rewrite-rules/suggestions?limit=5&minConfidence=0.70",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("total"), 1)
        self.assertEqual(payload["suggestions"][0]["to"], "openai")
        self.assertEqual(payload.get("minConfidence"), 0.7)
        mock_build_rewrite_rule_suggestions.assert_called_once_with(
            limit=5,
            min_confidence=0.7,
        )

    def test_admin_search_rewrite_rule_suggestions_reject_invalid_min_confidence(self) -> None:
        token = self._admin_token()
        response = self.client.get(
            "/api/admin/search/rewrite-rules/suggestions?minConfidence=abc",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 400)
        self.assertIn("minConfidence", payload.get("error", ""))

    @patch("core.views.read_analytics")
    @patch("core.views.get_query_rewrite_rules", return_value=[])
    def test_admin_search_rewrite_rule_suggestions_derive_from_telemetry(
        self,
        _mock_get_query_rewrite_rules,
        mock_read_analytics,
    ) -> None:
        mock_read_analytics.return_value = {
            "searches": [
                {
                    "id": "s-1",
                    "query": "opnai",
                    "resultCount": 0,
                    "reformulatesSearchId": None,
                    "reformulationType": None,
                },
                {
                    "id": "s-2",
                    "query": "openai",
                    "resultCount": 15,
                    "reformulatesSearchId": "s-1",
                    "reformulationType": "zero-results-refinement",
                },
            ],
            "pageViews": [],
            "resultClicks": [],
        }

        token = self._admin_token()
        response = self.client.get(
            "/api/admin/search/rewrite-rules/suggestions?limit=10",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("total"), 1)
        suggestion = payload["suggestions"][0]
        self.assertEqual(suggestion["from"], "opnai")
        self.assertEqual(suggestion["to"], "openai")
        self.assertEqual(suggestion["reason"], "telemetry-suggested")
        self.assertEqual(suggestion["signals"]["reformulations"], 1)

    @patch("core.views.read_analytics")
    @patch("core.views.get_query_rewrite_rules", return_value=[])
    def test_admin_search_rewrite_rule_suggestions_skip_short_and_operator_queries(
        self,
        _mock_get_query_rewrite_rules,
        mock_read_analytics,
    ) -> None:
        mock_read_analytics.return_value = {
            "searches": [
                {
                    "id": "s-1",
                    "query": "ai",
                    "resultCount": 0,
                    "reformulatesSearchId": None,
                    "reformulationType": None,
                },
                {
                    "id": "s-2",
                    "query": "openai",
                    "resultCount": 10,
                    "reformulatesSearchId": "s-1",
                    "reformulationType": "zero-results-refinement",
                },
                {
                    "id": "s-3",
                    "query": "site:openai.com ai",
                    "resultCount": 0,
                    "reformulatesSearchId": None,
                    "reformulationType": None,
                },
                {
                    "id": "s-4",
                    "query": "openai",
                    "resultCount": 9,
                    "reformulatesSearchId": "s-3",
                    "reformulationType": "zero-results-refinement",
                },
            ],
            "pageViews": [],
            "resultClicks": [],
        }

        token = self._admin_token()
        response = self.client.get(
            "/api/admin/search/rewrite-rules/suggestions?limit=10",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("total"), 0)

    @patch(
        "core.views.get_query_rewrite_rules",
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
    def test_admin_search_rewrite_rules_returns_rules_for_admin(
        self,
        _mock_get_query_rewrite_rules,
    ) -> None:
        token = self._admin_token()
        response = self.client.get(
            "/api/admin/search/rewrite-rules",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(payload.get("rewriteRules") or []), 1)
        self.assertEqual(payload["rewriteRules"][0]["to"], "python")

    @patch(
        "core.views.write_query_rewrite_rules",
        return_value=[
            {
                "enabled": True,
                "matchType": "contains",
                "from": "opnai",
                "to": "openai",
                "reason": "common-typo",
            }
        ],
    )
    def test_admin_search_rewrite_rules_update_saves_rules(
        self,
        mock_write_query_rewrite_rules,
    ) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/search/rewrite-rules/update",
            {
                "rewriteRules": [
                    {
                        "enabled": True,
                        "matchType": "contains",
                        "from": "opnai",
                        "to": "openai",
                        "reason": "common-typo",
                    }
                ]
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["rewriteRules"][0]["matchType"], "contains")
        mock_write_query_rewrite_rules.assert_called_once()

    @patch(
        "core.views.reset_query_rewrite_rules",
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
    def test_admin_search_rewrite_rules_update_supports_reset(
        self,
        mock_reset_query_rewrite_rules,
    ) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/search/rewrite-rules/update",
            {"reset": True},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["rewriteRules"][0]["from"], "pythn")
        mock_reset_query_rewrite_rules.assert_called_once()

    @patch(
        "core.views.write_query_rewrite_rules",
        side_effect=ValueError("Rule 1 is missing a from value."),
    )
    def test_admin_search_rewrite_rules_update_returns_400_for_invalid_rules(
        self,
        _mock_write_query_rewrite_rules,
    ) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/search/rewrite-rules/update",
            {"rewriteRules": [{"to": "python"}]},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", payload)

    @patch(
        "core.views.execute_seed_sync",
        return_value={
            "summary": {
                "durationMs": 10,
                "reason": "seed",
                "source": "all",
                "status": "indexed",
                "updatedSince": "",
                "nextUpdatedSince": "2026-03-22T08:30:00Z",
                "pagesFetched": 1,
                "maxPages": 50,
                "pageSize": 200,
                "djangoReportedTotal": 2,
                "fetchedDocuments": 2,
                "importedDocuments": 2,
                "uniqueUrlCount": 2,
                "pageSummaries": [{"page": 1, "fetched": 2, "hasNextPage": False}],
            },
            "refresh": {
                "beforeCount": 2,
                "afterCount": 2,
                "removedInvalid": 0,
                "deduplicated": 0,
                "backupFile": None,
                "artifacts": {"docCount": 2, "vocabularySize": 10, "tokenDfSize": 10},
            },
            "index": {
                "totalDocs": 2,
                "file": {"path": "data/search-index.json", "sizeBytes": 1000, "mtime": ""},
                "topLanguages": [],
                "topCategories": [],
                "topSources": [],
            },
        },
    )
    def test_admin_search_seed_returns_node_parity_payload(self, mock_execute_seed_sync) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/search/seed",
            {},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("ok"), True)
        self.assertIn("generatedAt", payload)
        self.assertIn("seed", payload)
        self.assertIn("refresh", payload)
        self.assertIn("index", payload)
        self.assertEqual(payload.get("seed", {}).get("reason"), "seed")
        mock_execute_seed_sync.assert_called_once_with(authorization_header=f"Bearer {token}")

    @patch(
        "core.views.execute_seed_sync",
        side_effect=ValueError(
            "Missing Django auth token. Set DJANGO_ADMIN_TOKEN or provide Authorization header."
        ),
    )
    def test_admin_search_seed_returns_400_when_sync_token_missing(
        self,
        _mock_execute_seed_sync,
    ) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/search/seed",
            {},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", payload)

    @patch(
        "core.views.execute_crawl_sync",
        return_value={
            "summary": {
                "durationMs": 12,
                "reason": "crawl",
                "source": "all",
                "status": "indexed",
                "updatedSince": "",
                "nextUpdatedSince": "2026-03-22T08:35:00Z",
                "pagesFetched": 2,
                "maxPages": 25,
                "pageSize": 200,
                "djangoReportedTotal": 20,
                "fetchedDocuments": 20,
                "importedDocuments": 20,
                "uniqueUrlCount": 20,
                "pageSummaries": [
                    {"page": 1, "fetched": 10, "hasNextPage": True},
                    {"page": 2, "fetched": 10, "hasNextPage": False},
                ],
            },
            "refresh": {
                "beforeCount": 20,
                "afterCount": 20,
                "removedInvalid": 0,
                "deduplicated": 0,
                "backupFile": None,
                "artifacts": {"docCount": 20, "vocabularySize": 50, "tokenDfSize": 50},
            },
            "index": {
                "totalDocs": 20,
                "file": {"path": "data/search-index.json", "sizeBytes": 3000, "mtime": ""},
                "topLanguages": [],
                "topCategories": [],
                "topSources": [],
            },
        },
    )
    def test_admin_search_crawl_returns_node_parity_payload(self, mock_execute_crawl_sync) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/search/crawl",
            {"maxPages": 25},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("ok"), True)
        self.assertIn("generatedAt", payload)
        self.assertIn("crawl", payload)
        self.assertIn("refresh", payload)
        self.assertIn("index", payload)
        self.assertEqual(payload.get("crawl", {}).get("reason"), "crawl")
        mock_execute_crawl_sync.assert_called_once_with(
            authorization_header=f"Bearer {token}",
            max_pages_value=25,
        )

    @patch(
        "core.views.execute_crawl_sync",
        side_effect=RuntimeError("A sync operation is already in progress."),
    )
    def test_admin_search_crawl_returns_502_on_sync_failure(
        self,
        _mock_execute_crawl_sync,
    ) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/search/crawl",
            {"maxPages": 5},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 502)
        self.assertIn("error", payload)

    @patch(
        "core.views.resolve_approx_location",
        return_value={
            "latitude": 44.4268,
            "longitude": 26.1025,
            "city": "Bucharest",
            "country": "Romania",
            "source": "ipwho.is",
        },
    )
    def test_location_auto_returns_coordinates(self, _mock_location) -> None:
        response = self.client.get("/api/location/auto")
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("city"), "Bucharest")
        self.assertEqual(payload.get("country"), "Romania")
        self.assertEqual(payload.get("source"), "ipwho.is")
        self.assertIn("latitude", payload)
        self.assertIn("longitude", payload)

    @patch("core.views.resolve_approx_location", side_effect=RuntimeError("unavailable"))
    def test_location_auto_returns_503_when_providers_fail(self, _mock_location) -> None:
        response = self.client.get("/api/location/auto")
        payload = self._json(response)

        self.assertEqual(response.status_code, 503)
        self.assertIn("error", payload)

    def test_admin_backups_requires_admin_auth(self) -> None:
        response = self.client.get("/api/admin/backups?reason=all")
        self.assertEqual(response.status_code, 401)

    def test_admin_backups_rejects_invalid_reason(self) -> None:
        token = self._admin_token()
        response = self.client.get(
            "/api/admin/backups?reason=invalid-reason",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", payload)

    @patch(
        "core.views.list_backups",
        return_value=[
            {
                "fileName": "analytics-2026-03-09T10-00-00-000Z-manual.json",
                "sizeBytes": 123,
                "createdAt": "2026-03-09T10:00:00Z",
                "reason": "manual",
            }
        ],
    )
    def test_admin_backups_returns_list_for_admin(self, _mock_list_backups) -> None:
        token = self._admin_token()
        response = self.client.get(
            "/api/admin/backups?reason=manual",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("reason"), "manual")
        self.assertEqual(len(payload.get("backups") or []), 1)

    @patch("core.views.create_backup")
    @patch("core.views.list_backups", return_value=[])
    def test_admin_backups_create_returns_ok_payload(
        self,
        _mock_list_backups,
        _mock_create_backup,
    ) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/backups/create",
            {},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("ok"), True)
        self.assertIn("backups", payload)

    @patch("core.views.sanitize_backup_file_name", return_value="analytics-missing.json")
    @patch("core.views.restore_backup", side_effect=FileNotFoundError("not found"))
    def test_admin_backups_restore_returns_404_when_backup_missing(
        self,
        _mock_restore,
        _mock_sanitize,
    ) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/backups/restore",
            {"fileName": "analytics-missing.json"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 404)
        self.assertIn("error", payload)

    def test_admin_backups_download_rejects_invalid_file_name(self) -> None:
        token = self._admin_token()
        response = self.client.get(
            "/api/admin/backups/download?fileName=../bad.json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", payload)

    def test_admin_index_restore_requires_admin_auth(self) -> None:
        response = self.client.post(
            "/api/admin/index/restore",
            {"fileName": "search-index-sample.json"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_admin_index_restore_rejects_invalid_file_name(self) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/index/restore",
            {"fileName": "../bad.json"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", payload)

    @patch(
        "core.views.sanitize_search_index_backup_file_name",
        return_value="search-index-missing.json",
    )
    @patch(
        "core.views.restore_search_index_from_backup",
        side_effect=FileNotFoundError("Search-index backup file not found."),
    )
    def test_admin_index_restore_returns_404_when_backup_missing(
        self,
        _mock_restore,
        _mock_sanitize,
    ) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/index/restore",
            {"fileName": "search-index-missing.json", "createBackup": False},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 404)
        self.assertIn("error", payload)

    @patch(
        "core.views.build_index_status_payload",
        return_value={
            "index": {
                "totalDocs": 1,
                "file": {
                    "path": "D:/Visual Studio Code/data/search-index.json",
                    "sizeBytes": 123,
                    "mtime": "2026-03-21T00:00:00Z",
                },
                "topLanguages": [{"value": "en", "count": 1}],
                "topCategories": [{"value": "Development", "count": 1}],
                "topSources": [{"value": "example.com", "count": 1}],
            }
        },
    )
    @patch(
        "core.views.restore_search_index_from_backup",
        return_value={
            "restoredFrom": "search-index-sample.json",
            "preRestoreBackup": "search-index-pre-restore.json",
        },
    )
    @patch(
        "core.views.sanitize_search_index_backup_file_name",
        return_value="search-index-sample.json",
    )
    def test_admin_index_restore_returns_ok_payload(
        self,
        _mock_sanitize,
        _mock_restore,
        _mock_index_status,
    ) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/index/restore",
            {"fileName": "search-index-sample.json", "createBackup": False},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("ok"), True)
        self.assertIn("restore", payload)
        self.assertIn("index", payload)

    def test_admin_index_refresh_requires_admin_auth(self) -> None:
        response = self.client.post(
            "/api/admin/index/refresh",
            {},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_admin_index_refresh_rejects_too_many_merge_docs(self) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/index/refresh",
            {"mergeDocs": list(range(2001))},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", payload)

    @patch(
        "core.views.build_index_status_payload",
        return_value={
            "index": {
                "totalDocs": 2,
                "file": {
                    "path": "D:/Visual Studio Code/data/search-index.json",
                    "sizeBytes": 256,
                    "mtime": "2026-03-21T00:00:00Z",
                },
                "topLanguages": [{"value": "en", "count": 2}],
                "topCategories": [{"value": "Development", "count": 2}],
                "topSources": [{"value": "example.com", "count": 2}],
            }
        },
    )
    @patch(
        "core.views.rebuild_search_index",
        return_value={
            "beforeCount": 2,
            "afterCount": 2,
            "removedInvalid": 0,
            "deduplicated": 0,
            "backupFile": None,
            "artifacts": {
                "docCount": 2,
                "vocabularySize": 10,
                "tokenDfSize": 8,
            },
        },
    )
    def test_admin_index_refresh_returns_ok_payload(
        self,
        _mock_refresh,
        _mock_index_status,
    ) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/index/refresh",
            {"mergeDocs": [], "createBackup": False},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("ok"), True)
        self.assertIn("refresh", payload)
        self.assertIn("index", payload)

    def test_admin_export_csv_requires_admin_auth(self) -> None:
        response = self.client.get("/api/admin/export.csv?range=7d")
        self.assertEqual(response.status_code, 401)

    @patch(
        "core.views.build_export_csv",
        return_value="rowType,timestamp\nsearch,2026-03-09T00:00:00Z\n",
    )
    def test_admin_export_csv_returns_csv_for_admin(self, _mock_build_export_csv) -> None:
        token = self._admin_token()
        response = self.client.get(
            "/api/admin/export.csv?range=7d",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        content_type = str(response.get("Content-Type") or "")
        disposition = str(response.get("Content-Disposition") or "")
        body = response.content.decode("utf-8")

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", content_type)
        self.assertIn("magneto-analytics.csv", disposition)
        self.assertIn("rowType,timestamp", body)

    @patch("core.views.check_rate_limit", return_value=(False, 7))
    def test_assistant_chat_returns_429_when_rate_limited(self, _mock_rate_limit) -> None:
        response = self.client.post(
            "/api/assistant/chat",
            {"message": "hello"},
            format="json",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 429)
        self.assertEqual(payload.get("retryAfterSeconds"), 7)
        self.assertIn("error", payload)

    @patch("core.views.check_rate_limit", return_value=(True, 0))
    @patch("core.views.get_cache_entry", return_value=None)
    def test_assistant_chat_rejects_empty_message(
        self,
        _mock_cache,
        _mock_rate_limit,
    ) -> None:
        response = self.client.post(
            "/api/assistant/chat",
            {"message": "   "},
            format="json",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", payload)

    @patch("core.views.check_rate_limit", return_value=(True, 0))
    @patch("core.views.get_cache_entry", return_value=None)
    @patch("core.views.store_memory")
    @patch(
        "core.views.generate_assistant_response",
        return_value={
            "ok": True,
            "provider": "openai",
            "model": "gpt-test",
            "helper": "general",
            "reply": "Mocked assistant reply",
            "suggestions": ["s1", "s2"],
        },
    )
    def test_assistant_chat_returns_provider_payload(
        self,
        _mock_generate,
        _mock_store_memory,
        _mock_cache,
        _mock_rate_limit,
    ) -> None:
        response = self.client.post(
            "/api/assistant/chat",
            {"message": "How to plan my day?"},
            format="json",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("provider"), "openai")
        self.assertEqual(payload.get("model"), "gpt-test")
        self.assertEqual(payload.get("reply"), "Mocked assistant reply")

    def test_runtime_metrics_returns_expected_shape_for_admin(self) -> None:
        token = self._admin_token()

        # Generate traffic so runtime metrics have a non-empty sample.
        self.client.get("/api/health")

        response = self.client.get(
            "/api/admin/runtime-metrics",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertIn("generatedAt", payload)

        runtime = payload.get("runtime") or {}
        requests = runtime.get("requests") or {}
        latency = runtime.get("latencyMs") or {}
        health = runtime.get("health") or {}

        self.assertIn("startedAt", runtime)
        self.assertIn("uptimeSeconds", runtime)
        self.assertGreaterEqual(int(requests.get("apiTotal", 0)), 1)
        self.assertIn("ratePerMinute", requests)
        self.assertIn("p95", latency)
        self.assertIn("level", health)
        self.assertIn(health.get("level"), {"ok", "warning", "critical"})

    def test_admin_search_status_requires_admin_auth(self) -> None:
        response = self.client.get("/api/admin/search/status")
        self.assertEqual(response.status_code, 401)

    def test_admin_search_status_returns_expected_shape_for_admin(self) -> None:
        token = self._admin_token()
        response = self.client.get(
            "/api/admin/search/status",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("ok"), True)
        self.assertIn("generatedAt", payload)

        search = payload.get("search") or {}
        self.assertIn("sources", search)
        self.assertIn("documents", search)
        self.assertIn("blockRules", search)
        self.assertIn("latestRun", search)
        self.assertIn("recentRuns", search)
        self.assertIn("rankingConfig", search)
        self.assertIn("rewriteRules", search)

        # Verify nested structure
        sources = search.get("sources") or {}
        self.assertIn("active", sources)
        self.assertIn("total", sources)

        docs = search.get("documents") or {}
        self.assertIn("indexed", docs)
        self.assertIn("blocked", docs)
        self.assertIn("errors", docs)

    def test_admin_index_sync_reset_watermark_requires_admin_auth(self) -> None:
        response = self.client.post(
            "/api/admin/index/sync-reset-watermark",
            {},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_admin_index_sync_reset_watermark_clears_error_for_admin(self) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/index/sync-reset-watermark",
            {"updatedSince": ""},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("ok"), True)
        self.assertIn("generatedAt", payload)

        state = payload.get("state") or {}
        self.assertIn("updatedSince", state)
        self.assertIn("lastRunAt", state)
        self.assertIn("lastSuccessAt", state)
        self.assertIn("lastError", state)
        self.assertEqual(state.get("lastError"), "")

    def test_admin_index_sync_reset_watermark_rejects_invalid_datetime(self) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/index/sync-reset-watermark",
            {"updatedSince": "invalid-date"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", payload)

    def test_admin_overview_with_range_parameter_for_admin(self) -> None:
        token = self._admin_token()
        response = self.client.get(
            "/api/admin/overview?range=24h",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("range"), "24h")
        self.assertIn("generatedAt", payload)
        self.assertIn("comparison", payload)
        self.assertIn("totals", payload)
        self.assertIn("topQueries", payload)
        self.assertIn("trafficByPage", payload)
        self.assertIn("latestSearches", payload)

        totals = payload.get("totals") or {}
        self.assertIn("totalSearches", totals)
        self.assertIn("totalPageViews", totals)
        self.assertIn("uniqueQueries", totals)

    # ── Routing Control ────────────────────────────────────────────────────────

    def test_admin_routing_requires_admin_auth(self) -> None:
        response = self.client.get("/api/admin/routing")
        self.assertEqual(response.status_code, 401)

    def test_admin_routing_get_returns_expected_shape(self) -> None:
        token = self._admin_token()
        response = self.client.get(
            "/api/admin/routing",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload.get("ok"))
        self.assertIn("generatedAt", payload)
        routing = payload.get("routing") or {}
        self.assertIn("activeBackend", routing)
        self.assertIn("canaryPercent", routing)
        self.assertIn("djangoUrl", routing)
        self.assertIn("note", routing)
        self.assertIn("updatedAt", routing)

    def test_admin_routing_post_switches_backend(self) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/routing",
            {"activeBackend": "django", "canaryPercent": 10, "note": "Test canary"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        routing = payload.get("routing") or {}
        self.assertEqual(routing.get("activeBackend"), "django")
        self.assertEqual(routing.get("canaryPercent"), 10)
        self.assertEqual(routing.get("note"), "Test canary")

        # Rollback to node
        self.client.post(
            "/api/admin/routing",
            {"activeBackend": "node", "canaryPercent": 100},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

    def test_admin_routing_post_rejects_invalid_backend(self) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/routing",
            {"activeBackend": "unknown-service"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(response.status_code, 400)

    def test_admin_routing_post_rejects_invalid_canary(self) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/routing",
            {"canaryPercent": 77},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(response.status_code, 400)

    def test_admin_routing_verify_requires_admin_auth(self) -> None:
        response = self.client.post("/api/admin/routing/verify")
        self.assertEqual(response.status_code, 401)

    def test_admin_routing_verify_returns_expected_shape(self) -> None:
        token = self._admin_token()
        response = self.client.post(
            "/api/admin/routing/verify",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertIn("ok", payload)
        self.assertIn("generatedAt", payload)
        self.assertIn("checks", payload)
        self.assertIsInstance(payload.get("checks"), list)
        self.assertIn("routing", payload)
        for check in payload["checks"]:
            self.assertIn("backend", check)
            self.assertIn("ok", check)
            self.assertIn("latencyMs", check)
