import json
from typing import cast
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient


class CoreApiTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()

    def _admin_token(self) -> str:
        response = self.client.post(
            "/api/auth/login",
            {"username": "admin", "password": "change-this-password"},
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

    def test_search_requires_query(self) -> None:
        response = self.client.get("/api/search")
        payload = self._json(response)

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", payload)

    @patch(
        "core.views.run_search",
        return_value=[{"title": "A", "url": "https://example.com", "summary": "S"}],
    )
    @patch("core.views.log_search")
    def test_search_returns_ranked_results(self, mock_log_search, _mock_run_search) -> None:
        response = self.client.get("/api/search?q=alpha")
        payload = self._json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload.get("engine"), "MAGNETO Core")
        self.assertEqual(payload.get("query"), "alpha")
        self.assertEqual(payload.get("total"), 1)
        self.assertEqual(len(payload.get("results") or []), 1)
        mock_log_search.assert_called_once()

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
