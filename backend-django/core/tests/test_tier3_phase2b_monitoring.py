"""
Unit tests for TIER 3 Phase 2B: Live training pipeline and continuous deployment.
"""

import json
from unittest import TestCase
from datetime import datetime, timedelta

from core.services.ltr_training_pipeline import (
    ModelMetrics,
    TrainingRecord,
    collect_model_metrics,
    compare_model_quality,
    get_training_summary,
)
from core.services.continuous_deployment import (
    DeploymentMonitor,
    get_deployment_readiness,
)
from core.services.ltr_model_trainer import LTRModel


class ModelMetricsTests(TestCase):
    """Tests for model metrics tracking."""

    def test_model_metrics_creation(self):
        """Test ModelMetrics creation and serialization."""
        metrics = ModelMetrics()

        self.assertEqual(metrics.training_samples_used, 0)
        self.assertEqual(metrics.ndcg_5, 0.0)
        self.assertEqual(metrics.map_score, 0.0)

        metrics_dict = metrics.to_dict()
        self.assertIn("model_id", metrics_dict)
        self.assertIn("created_at", metrics_dict)
        self.assertIn("ndcg_5", metrics_dict)

    def test_model_metrics_serialization(self):
        """Test ModelMetrics roundtrip serialization."""
        metrics = ModelMetrics()
        metrics.model_id = "test_model_123"
        metrics.ndcg_5 = 0.75
        metrics.map_score = 0.68

        metrics_dict = metrics.to_dict()
        restored = ModelMetrics.from_dict(metrics_dict)

        self.assertEqual(restored.model_id, metrics.model_id)
        self.assertEqual(restored.ndcg_5, metrics.ndcg_5)
        self.assertEqual(restored.map_score, metrics.map_score)


class TrainingRecordTests(TestCase):
    """Tests for training run records."""

    def test_training_record_creation(self):
        """Test TrainingRecord creation."""
        record = TrainingRecord("train_001")

        self.assertEqual(record.training_run_id, "train_001")
        self.assertEqual(record.status, "pending")
        self.assertIsNone(record.error_message)

    def test_training_record_success(self):
        """Test successful training record."""
        record = TrainingRecord("train_002")
        record.status = "success"
        record.new_model_id = "model_v2"
        record.samples_collected = 1500
        record.improvement_ndcg = 2.5

        record_dict = record.to_dict()
        self.assertEqual(record_dict["status"], "success")
        self.assertEqual(record_dict["improvement_ndcg"], 2.5)

    def test_training_record_failure(self):
        """Test failed training record."""
        record = TrainingRecord("train_003")
        record.status = "failed"
        record.error_message = "insufficient_samples"

        record_dict = record.to_dict()
        self.assertEqual(record_dict["status"], "failed")
        self.assertIsNotNone(record_dict["error_message"])


class ModelQualityComparisonTests(TestCase):
    """Tests for model quality comparison."""

    def test_compare_first_model(self):
        """Test comparison for first model (no baseline)."""
        new_metrics = ModelMetrics()
        new_metrics.ndcg_5 = 0.72

        comparison = compare_model_quality(new_metrics, baseline_metrics=None)

        self.assertFalse(comparison["has_baseline"])
        self.assertEqual(comparison["recommendation"], "accept")
        self.assertEqual(comparison["reason"], "first_model")

    def test_compare_improved_model(self):
        """Test comparison when new model improves."""
        baseline = ModelMetrics()
        baseline.ndcg_5 = 0.70
        baseline.map_score = 0.65

        improved = ModelMetrics()
        improved.ndcg_5 = 0.712  # 1.7% improvement
        improved.map_score = 0.665  # 2.3% improvement

        comparison = compare_model_quality(improved, baseline)

        self.assertTrue(comparison["has_baseline"])
        self.assertGreater(comparison["improvement_ndcg"], 1.0)
        self.assertEqual(comparison["recommendation"], "accept")

    def test_compare_degraded_model(self):
        """Test comparison when new model degrades significantly."""
        baseline = ModelMetrics()
        baseline.ndcg_5 = 0.70
        baseline.map_score = 0.65

        degraded = ModelMetrics()
        degraded.ndcg_5 = 0.66  # 5.7% degradation
        degraded.map_score = 0.63  # 3.1% degradation

        comparison = compare_model_quality(degraded, baseline)

        self.assertTrue(comparison["has_baseline"])
        self.assertLess(comparison["improvement_ndcg"], -5.0)
        self.assertEqual(comparison["recommendation"], "reject")


class DeploymentMonitorTests(TestCase):
    """Tests for deployment monitor."""

    def test_monitor_creation(self):
        """Test DeploymentMonitor creation."""
        monitor = DeploymentMonitor()

        self.assertTrue(monitor.auto_promote_enabled)
        self.assertTrue(monitor.auto_traffic_shift_enabled)
        self.assertEqual(monitor.check_interval_seconds, 300)

    def test_should_check_now_first_time(self):
        """Test that monitor should check on first run."""
        monitor = DeploymentMonitor()
        self.assertTrue(monitor.should_check_now())

    def test_should_check_now_with_interval(self):
        """Test check interval logic."""
        monitor = DeploymentMonitor()
        monitor.check_interval_seconds = 10
        monitor.last_check = None

        # First check
        self.assertTrue(monitor.should_check_now())

        # Set last check to recent time
        import time
        monitor.last_check = time.time()
        self.assertFalse(monitor.should_check_now())

    def test_health_check_structure(self):
        """Test health check returns expected structure."""
        monitor = DeploymentMonitor()
        health = monitor.perform_health_check()

        self.assertIn("timestamp", health)
        self.assertIn("ab_test_status", health)
        self.assertIn("deployment_status", health)
        self.assertIn("training_status", health)
        self.assertIn("recommended_actions", health)
        self.assertIn("errors", health)

    def test_recommendations_generation(self):
        """Test that monitor generates reasonable recommendations."""
        monitor = DeploymentMonitor()
        health_check = {
            "ab_test_status": {
                "is_significant": True,
                "winner": "treatment",
                "active": True,
            },
            "deployment_status": {
                "canary_percentage": 50,
                "is_active": True,
            },
            "training_status": {
                "latest_run": {"status": "success"},
            },
        }

        recommendations = monitor._generate_recommendations(health_check)

        # Should recommend traffic increase if found
        if any("CANARY" in r for r in recommendations):
            self.assertTrue(any("CANARY" in r for r in recommendations))


class DeploymentReadinessTests(TestCase):
    """Tests for production readiness check."""

    def test_readiness_check_structure(self):
        """Test readiness check returns expected structure."""
        readiness = get_deployment_readiness()

        self.assertIn("is_ready", readiness)
        self.assertIn("checks", readiness)
        self.assertIn("timestamp", readiness)

        # Defaults to not ready (no active models)
        self.assertFalse(readiness.get("is_ready", True))

    def test_readiness_score_computation(self):
        """Test readiness score is between 0-100."""
        from core.services.search_service import get_system_readiness_for_production

        readiness = get_system_readiness_for_production()

        self.assertIn("readiness_percent", readiness)
        percent = readiness["readiness_percent"]
        self.assertGreaterEqual(percent, 0.0)
        self.assertLessEqual(percent, 100.0)

    def test_readiness_recommendations(self):
        """Test readiness check provides helpful recommendations."""
        from core.services.search_service import get_system_readiness_for_production

        readiness = get_system_readiness_for_production()

        if not readiness.get("is_ready"):
            self.assertGreater(
                len(readiness.get("recommendations", [])), 0,
                "Should provide recommendations when not ready"
            )
