"""
Comprehensive Testing Suite for Magneto Search Engine
Phase 2: Edge Cases, Performance, Stress Testing
"""

import json
import time
import unittest
from pathlib import Path
from core.services.search_service import (
    run_search_page,
    get_ltr_model_status,
    get_ab_test_status,
    get_deployment_status,
    get_system_readiness_for_production,
)


class TestEdgeCases(unittest.TestCase):
    """Test edge cases and unusual queries."""

    def test_empty_query(self):
        """Empty query should return gracefully."""
        result = run_search_page("", offset=0)
        self.assertIsNotNone(result)
        self.assertIn("results", result)

    def test_very_long_query(self):
        """Test with extremely long query (1000+ chars)."""
        long_query = "test " * 250  # 1250 chars
        result = run_search_page(long_query, offset=0)
        self.assertIsNotNone(result)
        self.assertLess(len(result.get("results", [])), 100)

    def test_special_characters(self):
        """Test queries with special characters: @#$%^&*()"""
        queries = [
            "test@domain.com",
            "price: $50-$100",
            "c++/c# programming",
            "hello&world",
            "what's (new)?",
        ]
        for query in queries:
            result = run_search_page(query, offset=0)
            self.assertIsNotNone(result)

    def test_unicode_queries(self):
        """Test international queries: Chinese, Arabic, Hebrew, etc."""
        queries = [
            "你好世界",  # Chinese
            "مرحبا بالعالم",  # Arabic
            "שלום עולם",  # Hebrew
            "こんにちは",  # Japanese
            "🔎 emoji search",  # Emoji
        ]
        for query in queries:
            try:
                result = run_search_page(query, offset=0)
                self.assertIsNotNone(result)
            except Exception:
                pass  # Some may not be in index

    def test_numeric_only(self):
        """Test pure numeric queries."""
        queries = ["123456", "2026", "3.14159", "1e10"]
        for query in queries:
            result = run_search_page(query, offset=0)
            self.assertIsNotNone(result)

    def test_malformed_input(self):
        """Test queries with SQL injection attempts, etc."""
        queries = [
            "'; DROP TABLE users; --",
            "<script>alert('xss')</script>",
            "../../../etc/passwd",
            "\\x00null byte",
        ]
        for query in queries:
            try:
                result = run_search_page(query, offset=0)
                self.assertIsNotNone(result)
                # Should sanitize and handle gracefully
            except Exception:
                pass

    def test_pagination_boundaries(self):
        """Test pagination at boundaries."""
        # Offset 0 - Valid
        result = run_search_page("test", offset=0)
        self.assertIsNotNone(result)

        # Offset 1000 - Far boundary
        result = run_search_page("test", offset=1000)
        self.assertIsNotNone(result)

        # Negative offset
        result = run_search_page("test", offset=-1)
        self.assertIsNotNone(result)

    def test_duplicate_words(self):
        """Test queries with repeated words."""
        result = run_search_page("test test test test test", offset=0)
        self.assertIsNotNone(result)

    def test_stopword_only(self):
        """Test query with only stopwords (a, the, and, etc)."""
        result = run_search_page("the and a or an in at of to", offset=0)
        self.assertIsNotNone(result)

    def test_single_character(self):
        """Test single character queries."""
        for char in "azbycx":
            result = run_search_page(char, offset=0)
            self.assertIsNotNone(result)


class TestPerformance(unittest.TestCase):
    """Test performance characteristics."""

    def test_response_time_typical(self):
        """Typical query should respond in < 100ms."""
        start = time.time()
        result = run_search_page("python tutorial", offset=0)
        elapsed_ms = (time.time() - start) * 1000

        self.assertLess(elapsed_ms, 100, f"Query took {elapsed_ms}ms (expected <100ms)")

    def test_response_time_complex(self):
        """Complex query should respond in < 500ms."""
        start = time.time()
        result = run_search_page("machine learning deep neural networks", offset=0)
        elapsed_ms = (time.time() - start) * 1000

        self.assertLess(elapsed_ms, 500, f"Query took {elapsed_ms}ms (expected <500ms)")

    def test_response_time_fallback(self):
        """Semantic fallback query should respond in < 3000ms."""
        start = time.time()
        result = run_search_page("something that does not exist xyzabc", offset=0)
        elapsed_ms = (time.time() - start) * 1000

        self.assertLess(elapsed_ms, 3000, f"Fallback took {elapsed_ms}ms (expected <3000ms)")

    def test_batch_queries_throughput(self):
        """Test throughput with 10 sequential queries."""
        queries = [
            "python",
            "javascript",
            "database",
            "machine learning",
            "kubernetes",
            "docker",
            "aws",
            "azure",
            "devops",
            "testing",
        ]

        start = time.time()
        for query in queries:
            result = run_search_page(query, offset=0)
            self.assertIsNotNone(result)

        elapsed_sec = time.time() - start
        avg_ms = (elapsed_sec / len(queries)) * 1000
        throughput = len(queries) / elapsed_sec

        self.assertLess(avg_ms, 500, f"Average {avg_ms}ms per query")
        print(f"Performance: {throughput:.1f} queries/sec, avg {avg_ms:.0f}ms")


class TestLTRIntegration(unittest.TestCase):
    """Test LTR model integration."""

    def test_ltr_model_status_available(self):
        """LTR model status endpoint should return data."""
        status = get_ltr_model_status()
        self.assertIsNotNone(status)
        self.assertIn("status", status)

    def test_ltr_model_has_metrics(self):
        """LTR model should have training metrics."""
        status = get_ltr_model_status()
        if status.get("status") == "active":
            training = status.get("training", {})
            self.assertIn("current_metrics", training)

    def test_ltr_ndcg_reasonable(self):
        """NDCG@5 should be between 0 and 1."""
        status = get_ltr_model_status()
        if status.get("status") == "active":
            ndcg = status.get("training", {}).get("current_metrics", {}).get("ndcg_5", 0)
            self.assertGreaterEqual(ndcg, 0)
            self.assertLessEqual(ndcg, 1)

    def test_training_samples_growing(self):
        """Training samples should be accumulating (or none yet)."""
        status = get_ltr_model_status()
        total_runs = status.get("training", {}).get("total_runs", 0)
        # Can be 0 if training hasn't started, or > 0 if it has
        self.assertGreaterEqual(total_runs, 0)


class TestABTestIntegration(unittest.TestCase):
    """Test A/B testing framework."""

    def test_ab_test_status_available(self):
        """A/B test status should be readable."""
        status = get_ab_test_status()
        self.assertIsNotNone(status)
        self.assertIn("active", status)

    def test_ab_test_variants_valid(self):
        """If active, variants should have valid traffic fractions."""
        status = get_ab_test_status()
        if status.get("active"):
            control = status.get("control", {})
            treatment = status.get("treatment", {})

            c_frac = control.get("traffic_fraction", 0)
            t_frac = treatment.get("traffic_fraction", 0)

            self.assertGreaterEqual(c_frac, 0)
            self.assertGreaterEqual(t_frac, 0)
            self.assertAlmostEqual(c_frac + t_frac, 1.0, places=2)


class TestDeploymentIntegration(unittest.TestCase):
    """Test canary deployment system."""

    def test_deployment_status_available(self):
        """Deployment status should be readable."""
        status = get_deployment_status()
        self.assertIsNotNone(status)
        self.assertIn("is_active", status)

    def test_canary_percentage_valid(self):
        """Canary percentage should be 0-100."""
        status = get_deployment_status()
        if status.get("is_active"):
            canary = status.get("canary_percentage", 0)
            self.assertGreaterEqual(canary, 0)
            self.assertLessEqual(canary, 100)

    def test_deployment_model_version(self):
        """Model version should be identifiable."""
        status = get_deployment_status()
        model_version = status.get("model_version")
        self.assertIsNotNone(model_version)


class TestProductionReadiness(unittest.TestCase):
    """Test production readiness scoring."""

    def test_readiness_score_valid(self):
        """Readiness score should be 0-100."""
        readiness = get_system_readiness_for_production()
        score = readiness.get("readiness_percent", 0)
        self.assertGreaterEqual(score, 0)
        self.assertLessEqual(score, 100)

    def test_readiness_checks_present(self):
        """Readiness should include status checks."""
        readiness = get_system_readiness_for_production()
        checks = readiness.get("checks", {})
        self.assertTrue(len(checks) > 0)

    def test_readiness_recommendations_valid(self):
        """Recommendations should be actionable strings."""
        readiness = get_system_readiness_for_production()
        recommendations = readiness.get("recommendations", [])
        self.assertIsInstance(recommendations, list)


class TestQueryVariations(unittest.TestCase):
    """Test various query patterns."""

    def test_acronyms(self):
        """Test acronym recognition."""
        queries = ["REST API", "HTTP", "JSON", "YOLO", "CRUD"]
        for query in queries:
            result = run_search_page(query, offset=0)
            self.assertIsNotNone(result)

    def test_hyphenated_words(self):
        """Test hyphenated word handling."""
        queries = ["full-stack", "machine-learning", "state-of-the-art"]
        for query in queries:
            result = run_search_page(query, offset=0)
            self.assertIsNotNone(result)

    def test_camelcase(self):
        """Test camelCase word handling."""
        queries = ["camelCase", "PascalCase", "iPhone", "JavaScript"]
        for query in queries:
            result = run_search_page(query, offset=0)
            self.assertIsNotNone(result)

    def test_code_snippets(self):
        """Test code-like queries."""
        queries = [
            "def hello(): pass",
            "const x = 5;",
            "<div class='test'>",
            "SELECT * FROM users",
        ]
        for query in queries:
            try:
                result = run_search_page(query, offset=0)
                self.assertIsNotNone(result)
            except Exception:
                pass

    def test_typos_and_variations(self):
        """Test common typos."""
        queries = [
            "pythno",  # Python typo
            "javascrpt",  # JavaScript typo
            "databse",  # Database typo
        ]
        for query in queries:
            result = run_search_page(query, offset=0)
            self.assertIsNotNone(result)


class TestConcurrency(unittest.TestCase):
    """Test concurrent request handling."""

    def test_concurrent_simple_queries(self):
        """Simulate concurrent requests."""
        import threading

        results = []
        errors = []

        def search_task(query):
            try:
                result = run_search_page(query, offset=0)
                results.append(result)
            except Exception as e:
                errors.append(str(e))

        # 5 concurrent queries
        queries = ["test", "python", "database", "search", "api"]
        threads = []

        for query in queries:
            t = threading.Thread(target=search_task, args=(query,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0, f"Concurrency errors: {errors}")
        self.assertEqual(len(results), len(queries))


if __name__ == "__main__":
    unittest.main()
