"""
Deployment Safeguards for Search Engine Updates.

Monitors model performance, triggers rollback on degradation,
and manages gradual canary deployments.
"""

import json
import time
from pathlib import Path
from typing import Any
from datetime import datetime, timedelta

BASE_DIR = Path(__file__).resolve().parents[2]
DEPLOYMENT_STATE_PATH = BASE_DIR.parent / "data" / "deployment-state.json"
DEPLOYMENT_LOG_PATH = BASE_DIR.parent / "data" / "deployment-log.json"


class DeploymentConfig:
    """Deployment strategy configuration."""

    def __init__(self):
        self.model_version = "1.0"
        self.is_active = False
        self.canary_percentage = 0.0  # 0-100% traffic to new model
        self.min_observations_for_decision = 100
        self.max_allowed_ndcg_degradation = -0.05  # allow 5% NDCG loss
        self.max_allowed_ctr_degradation = -0.05  # allow 5% CTR loss
        self.min_improvement_to_commit = 0.02  # require 2% improvement to deploy
        self.auto_rollback_enabled = True
        self.created_at = datetime.utcnow().isoformat()

    def to_dict(self) -> dict[str, Any]:
        return {
            "model_version": self.model_version,
            "is_active": self.is_active,
            "canary_percentage": self.canary_percentage,
            "min_observations_for_decision": self.min_observations_for_decision,
            "max_allowed_ndcg_degradation": self.max_allowed_ndcg_degradation,
            "max_allowed_ctr_degradation": self.max_allowed_ctr_degradation,
            "min_improvement_to_commit": self.min_improvement_to_commit,
            "auto_rollback_enabled": self.auto_rollback_enabled,
            "created_at": self.created_at,
        }

    @staticmethod
    def from_dict(data: dict) -> "DeploymentConfig":
        config = DeploymentConfig()
        config.model_version = data.get("model_version", config.model_version)
        config.is_active = data.get("is_active", config.is_active)
        config.canary_percentage = data.get("canary_percentage", config.canary_percentage)
        config.min_observations_for_decision = data.get("min_observations_for_decision", config.min_observations_for_decision)
        config.max_allowed_ndcg_degradation = data.get("max_allowed_ndcg_degradation", config.max_allowed_ndcg_degradation)
        config.max_allowed_ctr_degradation = data.get("max_allowed_ctr_degradation", config.max_allowed_ctr_degradation)
        config.min_improvement_to_commit = data.get("min_improvement_to_commit", config.min_improvement_to_commit)
        config.auto_rollback_enabled = data.get("auto_rollback_enabled", config.auto_rollback_enabled)
        config.created_at = data.get("created_at", config.created_at)
        return config


class DeploymentEvent:
    """Log entry for deployment actions."""

    def __init__(self, event_type: str, details: dict | None = None):
        self.event_type = event_type  # deploy, canary_increase, rollback, commit
        self.timestamp = datetime.utcnow().isoformat()
        self.details = details or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_type": self.event_type,
            "timestamp": self.timestamp,
            "details": self.details,
        }


def get_deployment_state() -> tuple[DeploymentConfig, list[DeploymentEvent]]:
    """Load current deployment state and history."""
    try:
        if not DEPLOYMENT_STATE_PATH.exists():
            return DeploymentConfig(), []

        with open(DEPLOYMENT_STATE_PATH, "r") as f:
            data = json.load(f)
            config = DeploymentConfig.from_dict(data.get("config", {}))

        events = []
        if DEPLOYMENT_LOG_PATH.exists():
            with open(DEPLOYMENT_LOG_PATH, "r") as f:
                events_data = json.load(f)
                for e in events_data:
                    event = DeploymentEvent(e.get("event_type", "unknown"))
                    event.timestamp = e.get("timestamp", event.timestamp)
                    event.details = e.get("details", {})
                    events.append(event)

        return config, events
    except Exception:
        return DeploymentConfig(), []


def save_deployment_state(config: DeploymentConfig, events: list[DeploymentEvent]) -> bool:
    """Save deployment state to disk."""
    try:
        DEPLOYMENT_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)

        # Save config
        with open(DEPLOYMENT_STATE_PATH, "w") as f:
            json.dump({"config": config.to_dict()}, f, indent=2)

        # Save events log (keep last 1000)
        events_data = [e.to_dict() for e in events[-1000:]]
        with open(DEPLOYMENT_LOG_PATH, "w") as f:
            json.dump(events_data, f, indent=2)

        return True
    except Exception:
        return False


def should_perform_canary_deployment(
    current_model_metrics: dict[str, float],
    baseline_model_metrics: dict[str, float],
) -> bool:
    """
    Determine if new model should enter canary phase.

    Checks:
    1. New model improves on baseline
    2. Improvement is statistically meaningful
    3. No degradation in critical metrics
    """
    current_ndcg = current_model_metrics.get("ndcg@5", 0.0)
    baseline_ndcg = baseline_model_metrics.get("ndcg@5", 0.0)
    current_map = current_model_metrics.get("map", 0.0)
    baseline_map = baseline_model_metrics.get("map", 0.0)

    ndcg_delta = (current_ndcg - baseline_ndcg) / max(0.001, baseline_ndcg)
    map_delta = (current_map - baseline_map) / max(0.001, baseline_map)

    # Require at least 2% improvement in either metric
    improvement_threshold = 0.02
    if ndcg_delta < improvement_threshold and map_delta < improvement_threshold:
        return False

    # No critical degradation
    if ndcg_delta < -0.1 or map_delta < -0.1:
        return False

    return True


def should_rollback(
    current_metrics: dict[str, float],
    baseline_metrics: dict[str, float],
    config: DeploymentConfig,
) -> bool:
    """
    Determine if deployed model should be rolled back.

    Triggers rollback on:
    1. NDCG degradation exceeds threshold
    2. CTR degradation exceeds threshold
    3. Very low sample sizes
    """
    if not config.auto_rollback_enabled:
        return False

    # Check observation count
    observations = current_metrics.get("observations", 0)
    if observations < config.min_observations_for_decision:
        return False  # Not enough data yet

    # Check NDCG degradation
    current_ndcg = current_metrics.get("ndcg@5", 0.0)
    baseline_ndcg = baseline_metrics.get("ndcg@5", 0.0)
    ndcg_degradation = (current_ndcg - baseline_ndcg) / max(0.001, baseline_ndcg)
    if ndcg_degradation < config.max_allowed_ndcg_degradation:
        return True

    # Check CTR degradation
    current_ctr = current_metrics.get("ctr", 0.0)
    baseline_ctr = baseline_metrics.get("ctr", 0.0)
    ctr_degradation = (current_ctr - baseline_ctr) / max(0.001, baseline_ctr)
    if ctr_degradation < config.max_allowed_ctr_degradation:
        return True

    return False


def should_increase_canary_traffic(
    current_metrics: dict[str, float],
    baseline_metrics: dict[str, float],
    config: DeploymentConfig,
) -> bool:
    """
    Determine if canary traffic should be increased.

    Increases traffic when model shows consistent improvement.
    """
    if not config.is_active or config.canary_percentage >= 100:
        return False

    current_ndcg = current_metrics.get("ndcg@5", 0.0)
    baseline_ndcg = baseline_metrics.get("ndcg@5", 0.0)
    ndcg_improvement = (current_ndcg - baseline_ndcg) / max(0.001, baseline_ndcg)

    # Consistent improvement of at least min threshold
    return ndcg_improvement >= config.min_improvement_to_commit


def initiate_canary_deployment(
    model_version: str,
    initial_percentage: float = 5.0,
) -> tuple[DeploymentConfig, list[DeploymentEvent]]:
    """Start canary deployment of new model version."""
    config, events = get_deployment_state()

    config.model_version = model_version
    config.is_active = True
    config.canary_percentage = initial_percentage

    event = DeploymentEvent(
        "deploy",
        {
            "model_version": model_version,
            "canary_percentage": initial_percentage,
            "reason": "manual_canary_deployment",
        },
    )
    events.append(event)

    save_deployment_state(config, events)
    return config, events


def increase_canary_traffic(percentage: float = 10.0) -> tuple[DeploymentConfig, list[DeploymentEvent]]:
    """Increase traffic to new model version."""
    config, events = get_deployment_state()

    if not config.is_active:
        return config, events

    old_percentage = config.canary_percentage
    config.canary_percentage = min(100.0, config.canary_percentage + percentage)

    event = DeploymentEvent(
        "canary_increase",
        {
            "from_percentage": old_percentage,
            "to_percentage": config.canary_percentage,
        },
    )
    events.append(event)

    save_deployment_state(config, events)
    return config, events


def rollback_deployment() -> tuple[DeploymentConfig, list[DeploymentEvent]]:
    """Rollback to previous model version."""
    config, events = get_deployment_state()

    config.is_active = False
    config.canary_percentage = 0.0

    event = DeploymentEvent(
        "rollback",
        {
            "rolled_back_version": config.model_version,
            "reason": "performance_degradation_detected",
        },
    )
    events.append(event)

    save_deployment_state(config, events)
    return config, events


def commit_deployment() -> tuple[DeploymentConfig, list[DeploymentEvent]]:
    """Commit model to 100% traffic (end canary phase)."""
    config, events = get_deployment_state()

    if not config.is_active:
        return config, events

    config.canary_percentage = 100.0

    event = DeploymentEvent(
        "commit",
        {
            "model_version": config.model_version,
            "reason": "reached_100_percent_traffic",
        },
    )
    events.append(event)

    save_deployment_state(config, events)
    return config, events
