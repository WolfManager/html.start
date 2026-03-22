"""
Continuous Deployment & Monitoring for TIER 3 Phase 2B.

Monitors A/B test performance, triggers model promotions,
manages traffic shifts, and maintains system health.
"""

import json
import time
from pathlib import Path
from typing import Any
from datetime import datetime, timedelta

from .ltr_training_pipeline import get_training_summary, run_training_cycle
from .ab_testing import get_current_ab_test, save_ab_test, update_traffic_split, should_rollout_to_100_percent
from .deployment_safeguards import (
    get_deployment_state,
    should_increase_canary_traffic,
    should_rollback,
    increase_canary_traffic,
    rollback_deployment,
    commit_deployment,
)

BASE_DIR = Path(__file__).resolve().parents[2]
DEPLOYMENT_MONITOR_PATH = BASE_DIR.parent / "data" / "deployment-monitor.json"


class DeploymentMonitor:
    """Continuous deployment orchestrator."""

    def __init__(self):
        self.last_check = None
        self.check_interval_seconds = 300  # Check every 5 minutes
        self.auto_promote_enabled = True
        self.auto_traffic_shift_enabled = True
        self.min_ab_test_samples = 500
        self.traffic_shift_increment = 10.0  # 10% increase at a time

    def should_check_now(self) -> bool:
        """Determine if health check should run."""
        if not self.last_check:
            return True
        elapsed = time.time() - self.last_check
        return elapsed >= self.check_interval_seconds

    def perform_health_check(self) -> dict[str, Any]:
        """
        Perform comprehensive system health check.

        Returns:
        - Current A/B test status
        - Deployment canary status
        - Training pipeline status
        - Recommended actions
        """
        result = {
            "timestamp": datetime.utcnow().isoformat(),
            "ab_test_status": None,
            "deployment_status": None,
            "training_status": None,
            "recommended_actions": [],
            "errors": [],
        }

        try:
            # Check A/B test
            test = get_current_ab_test()
            if test:
                test.check_statistical_significance()
                control_metrics = self._extract_variant_metrics(test.variants.get("control"))
                treatment_metrics = self._extract_variant_metrics(test.variants.get("treatment"))
                result["ab_test_status"] = {
                    "active": test.status == "active",
                    "test_id": test.test_id,
                    "control": control_metrics,
                    "treatment": treatment_metrics,
                    "winner": test.winner,
                    "is_significant": test.is_statistically_significant,
                }
        except Exception as e:
            result["errors"].append(f"ab_test_check_failed: {str(e)[:100]}")

        try:
            # Check deployment
            config, _events = get_deployment_state()
            result["deployment_status"] = {
                "model_version": config.model_version,
                "is_active": config.is_active,
                "canary_percentage": config.canary_percentage,
                "auto_rollback_enabled": config.auto_rollback_enabled,
            }
        except Exception as e:
            result["errors"].append(f"deployment_check_failed: {str(e)[:100]}")

        try:
            # Check training pipeline
            training_summary = get_training_summary()
            result["training_status"] = {
                "total_runs": training_summary.get("total_training_runs", 0),
                "successful_runs": training_summary.get("successful_runs", 0),
                "latest_run": training_summary.get("latest_run"),
                "ndcg_trend": training_summary.get("ndcg_trend", []),
            }
        except Exception as e:
            result["errors"].append(f"training_check_failed: {str(e)[:100]}")

        # Generate recommendations
        try:
            recommendations = self._generate_recommendations(result)
            result["recommended_actions"] = recommendations
        except Exception as e:
            result["errors"].append(f"recommendation_generation_failed: {str(e)[:100]}")

        self.last_check = time.time()
        return result

    def _extract_variant_metrics(self, variant: Any) -> dict[str, Any]:
        """Return metrics for a variant represented either as object or dictionary."""
        if variant is None:
            return {}
        if isinstance(variant, dict):
            metrics = variant.get("metrics")
            return metrics if isinstance(metrics, dict) else {}
        metrics = getattr(variant, "metrics", None)
        return metrics if isinstance(metrics, dict) else {}

    def _generate_recommendations(self, health_check: dict[str, Any]) -> list[str]:
        """Generate recommended actions based on health check."""
        recommendations = []

        ab_test = health_check.get("ab_test_status") or {}
        deployment = health_check.get("deployment_status") or {}
        training = health_check.get("training_status") or {}

        # If A/B test shows winner, recommend rollout
        if ab_test.get("is_significant") and ab_test.get("winner") == "treatment":
            if deployment.get("canary_percentage", 0) < 100:
                recommendations.append("INCREASE_CANARY_TRAFFIC")

        # If treatment is winning but canary is low, gradually increase
        if ab_test.get("active") and deployment.get("is_active", False):
            control_metrics = ab_test.get("control") or {}
            treatment_metrics = ab_test.get("treatment") or {}

            treatment_ctr = treatment_metrics.get("ctr", 0.0)
            control_ctr = control_metrics.get("ctr", 0.0)

            if treatment_ctr > control_ctr * 1.05 and deployment.get("canary_percentage", 0) < 50:
                recommendations.append("INCREASE_CANARY_TRAFFIC_GRADUAL")

        # If canary is at 100%, commit the deployment
        if deployment.get("canary_percentage") == 100 and deployment.get("is_active"):
            recommendations.append("COMMIT_DEPLOYMENT")

        # If training has successful run, recommend promoting to A/B test
        if self.auto_promote_enabled:
            latest = training.get("latest_run") or {}
            if latest.get("status") == "success" and not deployment.get("is_active"):
                recommendations.append("START_AB_TEST_FOR_NEW_MODEL")

        return recommendations

    def execute_recommendations(self, recommendations: list[str]) -> dict[str, Any]:
        """Execute recommended actions."""
        results = {
            "timestamp": datetime.utcnow().isoformat(),
            "executed": [],
            "skipped": [],
            "errors": [],
        }

        for action in recommendations:
            try:
                if action == "INCREASE_CANARY_TRAFFIC":
                    increase_canary_traffic(percentage=self.traffic_shift_increment)
                    results["executed"].append(action)

                elif action == "INCREASE_CANARY_TRAFFIC_GRADUAL":
                    increase_canary_traffic(percentage=5.0)
                    results["executed"].append(action)

                elif action == "COMMIT_DEPLOYMENT":
                    commit_deployment()
                    results["executed"].append(action)

                elif action == "START_AB_TEST_FOR_NEW_MODEL":
                    # This would be handled by the app layer
                    results["skipped"].append(action)

                else:
                    results["skipped"].append(action)

            except Exception as e:
                results["errors"].append(f"{action}: {str(e)[:100]}")

        return results


def get_monitor_status() -> dict[str, Any]:
    """Get current monitor status."""
    try:
        if not DEPLOYMENT_MONITOR_PATH.exists():
            return {"initialized": False, "status": "not_started"}

        with open(DEPLOYMENT_MONITOR_PATH, "r") as f:
            return json.load(f)
    except Exception:
        return {"initialized": False, "error": "read_failed"}


def save_monitor_status(status: dict[str, Any]) -> bool:
    """Save monitor status."""
    try:
        DEPLOYMENT_MONITOR_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(DEPLOYMENT_MONITOR_PATH, "w") as f:
            json.dump(status, f, indent=2)
        return True
    except Exception:
        return False


def run_continuous_deployment_cycle(
    training_samples: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Execute full continuous deployment cycle:
    1. Check system health
    2. Run training if samples available
    3. Generate recommendations
    4. Execute safe actions

    Returns complete cycle result.
    """
    monitor = DeploymentMonitor()
    cycle_result = {
        "timestamp": datetime.utcnow().isoformat(),
        "health_check": None,
        "training_result": None,
        "recommendations": [],
        "executed_actions": [],
        "errors": [],
    }

    # Step 1: Health check
    try:
        health = monitor.perform_health_check()
        cycle_result["health_check"] = health
    except Exception as e:
        cycle_result["errors"].append(f"health_check_failed: {str(e)[:100]}")

    # Step 2: Training (if samples available)
    if training_samples:
        try:
            training_rec = run_training_cycle(training_samples, force=False)
            if training_rec:
                cycle_result["training_result"] = training_rec.to_dict()
        except Exception as e:
            cycle_result["errors"].append(f"training_cycle_failed: {str(e)[:100]}")

    # Step 3: Generate recommendations
    if cycle_result["health_check"]:
        try:
            recommendations = cycle_result["health_check"].get("recommended_actions", [])
            cycle_result["recommendations"] = recommendations
        except Exception as e:
            cycle_result["errors"].append(f"recommendation_failed: {str(e)[:100]}")

    # Step 4: Execute safe actions
    try:
        if cycle_result.get("recommendations"):
            actions = monitor.execute_recommendations(cycle_result["recommendations"])
            cycle_result["executed_actions"] = actions.get("executed", [])
            if actions.get("errors"):
                cycle_result["errors"].extend(actions["errors"])
    except Exception as e:
        cycle_result["errors"].append(f"execution_failed: {str(e)[:100]}")

    # Save status
    try:
        save_monitor_status(cycle_result)
    except Exception:
        pass

    return cycle_result


def get_deployment_readiness() -> dict[str, Any]:
    """
    Check if system is ready for production deployment.

    Returns:
    - is_ready: bool
    - checks: list of check results
    """
    checks = {}

    try:
        # Check A/B test status
        test = get_current_ab_test()
        if test and test.status == "active":
            test.check_statistical_significance()
            checks["ab_test_significant"] = test.is_statistically_significant
            checks["ab_test_winner"] = test.winner
        else:
            checks["ab_test_active"] = False

        # Check deployment status
        config, _events = get_deployment_state()
        checks["canary_at_100"] = config.canary_percentage == 100
        checks["deployment_active"] = config.is_active

        # Check model quality
        training_summary = get_training_summary()
        successful_runs = training_summary.get("successful_runs", 0)
        checks["has_successful_training"] = successful_runs > 0

        if training_summary.get("current_model_metrics"):
            ndcg = training_summary["current_model_metrics"].get("ndcg_5", 0)
            checks["model_ndcg_acceptable"] = ndcg >= 0.65

        # Overall readiness
        is_ready = all([
            checks.get("ab_test_significant", False) or checks.get("canary_at_100", False),
            checks.get("has_successful_training", False),
            checks.get("model_ndcg_acceptable", ndcg >= 0.65),
        ])

        return {
            "is_ready": is_ready,
            "checks": checks,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        return {
            "is_ready": False,
            "checks": {"error": str(e)[:100]},
            "timestamp": datetime.utcnow().isoformat(),
        }
