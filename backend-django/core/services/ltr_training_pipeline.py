"""
Live Model Training Pipeline for TIER 3 Phase 2B.

Continuously trains LTR models from collected user interactions with:
- Periodic training triggers
- Model performance tracking
- Feature importance evolution
- Live quality metrics
"""

import json
import time
from pathlib import Path
from typing import Any
from datetime import datetime, timedelta

from .ltr_model_trainer import train_ltr_model, save_model, load_model, compute_ndcg, compute_average_precision

BASE_DIR = Path(__file__).resolve().parents[2]
METRICS_PATH = BASE_DIR.parent / "data" / "ltr-metrics.json"
TRAINING_LOG_PATH = BASE_DIR.parent / "data" / "ltr-training-log.json"


class ModelMetrics:
    """Tracks LTR model performance metrics over time."""

    def __init__(self):
        self.model_id = ""
        self.created_at = datetime.utcnow().isoformat()
        self.training_samples_used = 0
        self.ndcg_5 = 0.0
        self.map_score = 0.0
        self.positive_ratio = 0.0
        self.avg_query_length = 0.0
        self.model_size_kb = 0.0
        self.training_duration_seconds = 0.0
        self.inference_latency_ms = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "model_id": self.model_id,
            "created_at": self.created_at,
            "training_samples_used": self.training_samples_used,
            "ndcg_5": self.ndcg_5,
            "map_score": self.map_score,
            "positive_ratio": self.positive_ratio,
            "avg_query_length": self.avg_query_length,
            "model_size_kb": self.model_size_kb,
            "training_duration_seconds": self.training_duration_seconds,
            "inference_latency_ms": self.inference_latency_ms,
        }

    @staticmethod
    def from_dict(data: dict) -> "ModelMetrics":
        m = ModelMetrics()
        m.model_id = data.get("model_id", "")
        m.created_at = data.get("created_at", m.created_at)
        m.training_samples_used = data.get("training_samples_used", 0)
        m.ndcg_5 = data.get("ndcg_5", 0.0)
        m.map_score = data.get("map_score", 0.0)
        m.positive_ratio = data.get("positive_ratio", 0.0)
        m.avg_query_length = data.get("avg_query_length", 0.0)
        m.model_size_kb = data.get("model_size_kb", 0.0)
        m.training_duration_seconds = data.get("training_duration_seconds", 0.0)
        m.inference_latency_ms = data.get("inference_latency_ms", 0.0)
        return m


class TrainingRecord:
    """Single training run record with outcome."""

    def __init__(self, training_run_id: str):
        self.training_run_id = training_run_id
        self.timestamp = datetime.utcnow().isoformat()
        self.status = "pending"  # pending, success, failed
        self.previous_model_id: str | None = None
        self.new_model_id: str | None = None
        self.samples_collected = 0
        self.training_seconds = 0.0
        self.improvement_ndcg = 0.0
        self.improvement_map = 0.0
        self.promoted_to_ab_test = False
        self.error_message: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "training_run_id": self.training_run_id,
            "timestamp": self.timestamp,
            "status": self.status,
            "previous_model_id": self.previous_model_id,
            "new_model_id": self.new_model_id,
            "samples_collected": self.samples_collected,
            "training_seconds": self.training_seconds,
            "improvement_ndcg": self.improvement_ndcg,
            "improvement_map": self.improvement_map,
            "promoted_to_ab_test": self.promoted_to_ab_test,
            "error_message": self.error_message,
        }

    @staticmethod
    def from_dict(data: dict) -> "TrainingRecord":
        rec = TrainingRecord(data.get("training_run_id", "unknown"))
        rec.timestamp = data.get("timestamp", rec.timestamp)
        rec.status = data.get("status", "pending")
        rec.previous_model_id = data.get("previous_model_id")
        rec.new_model_id = data.get("new_model_id")
        rec.samples_collected = data.get("samples_collected", 0)
        rec.training_seconds = data.get("training_seconds", 0.0)
        rec.improvement_ndcg = data.get("improvement_ndcg", 0.0)
        rec.improvement_map = data.get("improvement_map", 0.0)
        rec.promoted_to_ab_test = data.get("promoted_to_ab_test", False)
        rec.error_message = data.get("error_message")
        return rec


def collect_model_metrics(model, training_samples: list[dict]) -> ModelMetrics:
    """Compute comprehensive metrics for trained model."""
    metrics = ModelMetrics()
    metrics.model_id = model.model_id
    metrics.training_samples_used = len(training_samples)

    # Compute ranking metrics
    if training_samples:
        features_list = [s.get("features", {}) for s in training_samples]
        labels = [s.get("label", 0) for s in training_samples]

        predictions = model.predict_ranking([{"features": f} for f in features_list])
        metrics.ndcg_5 = compute_ndcg(predictions, labels, k=5)
        metrics.map_score = compute_average_precision(predictions, labels)
        metrics.positive_ratio = sum(labels) / len(labels) if labels else 0.0

        # Average samples stats
        query_lengths = []
        for sample in training_samples:
            features = sample.get("features", {})
            if "query_length" in features:
                query_lengths.append(features["query_length"])
        if query_lengths:
            metrics.avg_query_length = sum(query_lengths) / len(query_lengths)

    # Model size estimation
    try:
        model_dict = model.to_dict()
        model_json = json.dumps(model_dict)
        metrics.model_size_kb = len(model_json.encode()) / 1024.0
    except Exception:
        metrics.model_size_kb = 0.0

    return metrics


def get_model_metrics() -> list[ModelMetrics]:
    """Load model metrics history."""
    try:
        if not METRICS_PATH.exists():
            return []

        with open(METRICS_PATH, "r") as f:
            data = json.load(f)
            return [ModelMetrics.from_dict(m) for m in data.get("metrics", [])]
    except Exception:
        return []


def save_model_metrics(metrics_list: list[ModelMetrics]) -> bool:
    """Save model metrics to disk (keep last 100)."""
    try:
        METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "updated_at": datetime.utcnow().isoformat(),
            "metrics": [m.to_dict() for m in metrics_list[-100:]],
        }
        with open(METRICS_PATH, "w") as f:
            json.dump(data, f, indent=2)
        return True
    except Exception:
        return False


def get_training_log() -> list[TrainingRecord]:
    """Load training records."""
    try:
        if not TRAINING_LOG_PATH.exists():
            return []

        with open(TRAINING_LOG_PATH, "r") as f:
            data = json.load(f)
            return [TrainingRecord.from_dict(r) for r in data.get("records", [])]
    except Exception:
        return []


def save_training_log(records: list[TrainingRecord]) -> bool:
    """Save training records (keep last 200)."""
    try:
        TRAINING_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "updated_at": datetime.utcnow().isoformat(),
            "records": [r.to_dict() for r in records[-200:]],
        }
        with open(TRAINING_LOG_PATH, "w") as f:
            json.dump(data, f, indent=2)
        return True
    except Exception:
        return False


def compare_model_quality(
    new_model_metrics: ModelMetrics,
    baseline_metrics: ModelMetrics | None = None,
) -> dict[str, Any]:
    """
    Compare new model to baseline.

    Returns improvement scores and recommendation.
    """
    if not baseline_metrics:
        # First model - no baseline
        return {
            "has_baseline": False,
            "improvement_ndcg": 0.0,
            "improvement_map": 0.0,
            "recommendation": "accept",
            "reason": "first_model",
        }

    # Compute percentage improvements
    ndcg_improvement = (
        (new_model_metrics.ndcg_5 - baseline_metrics.ndcg_5)
        / max(0.001, baseline_metrics.ndcg_5)
        * 100
    )
    map_improvement = (
        (new_model_metrics.map_score - baseline_metrics.map_score)
        / max(0.001, baseline_metrics.map_score)
        * 100
    )

    # Decision logic
    min_improvement_percent = 1.0  # require 1% improvement
    if ndcg_improvement < -5.0:  # Allow up to 5% degradation
        recommendation = "reject"
        reason = "ndcg_degradation"
    elif map_improvement < -5.0:
        recommendation = "reject"
        reason = "map_degradation"
    elif ndcg_improvement >= min_improvement_percent or map_improvement >= min_improvement_percent:
        recommendation = "accept"
        reason = "improvement_detected"
    else:
        recommendation = "accept"
        reason = "stable"

    return {
        "has_baseline": True,
        "improvement_ndcg": ndcg_improvement,
        "improvement_map": map_improvement,
        "recommendation": recommendation,
        "reason": reason,
    }


def run_training_cycle(
    training_samples: list[dict],
    force: bool = False,
) -> TrainingRecord | None:
    """
    Execute full training cycle: train, evaluate, compare, decide.

    Returns TrainingRecord with outcome, or None if training skipped.
    """
    run_id = f"train_{int(time.time())}"
    record = TrainingRecord(run_id)

    try:
        # Check minimum samples
        if len(training_samples) < 1000 and not force:
            return None  # Skip - insufficient data

        record.samples_collected = len(training_samples)
        previous_model = load_model()
        record.previous_model_id = previous_model.model_id if previous_model else None

        # Train model
        start_time = time.time()
        new_model = train_ltr_model(training_samples, min_samples=500)
        record.training_seconds = time.time() - start_time

        if not new_model:
            record.status = "failed"
            record.error_message = "training_failed"
            return record

        # Collect metrics
        new_metrics = collect_model_metrics(new_model, training_samples)
        new_metrics.training_duration_seconds = record.training_seconds

        # Load baseline metrics (from previous model)
        all_metrics = get_model_metrics()
        baseline_metrics = all_metrics[-1] if all_metrics else None

        # Compare quality
        comparison = compare_model_quality(new_metrics, baseline_metrics)
        record.improvement_ndcg = comparison["improvement_ndcg"]
        record.improvement_map = comparison["improvement_map"]

        # Decide: accept and save if recommendation is "accept"
        if comparison["recommendation"] == "accept":
            save_model(new_model)
            record.new_model_id = new_model.model_id
            record.status = "success"

            # Update metrics
            updated_metrics = get_model_metrics()
            updated_metrics.append(new_metrics)
            save_model_metrics(updated_metrics)

            record.promoted_to_ab_test = True  # Auto-promote accepted models
        else:
            record.status = "rejected"
            record.error_message = f"rejected_{comparison['reason']}"

        return record

    except Exception as e:
        record.status = "failed"
        record.error_message = str(e)[:100]
        return record


def get_training_summary() -> dict[str, Any]:
    """Get summary of recent training activity."""
    try:
        log = get_training_log()
        metrics = get_model_metrics()

        if not log:
            return {
                "total_training_runs": 0,
                "successful_runs": 0,
                "latest_run": None,
                "current_model_metrics": None,
                "ndcg_trend": [],
            }

        successful = [r for r in log if r.status == "success"]
        latest = log[-1] if log else None
        current_metrics = metrics[-1] if metrics else None

        # NDCG trend (last 10 successful trainings)
        ndcg_trend = [m.ndcg_5 for m in metrics[-10:]]

        return {
            "total_training_runs": len(log),
            "successful_runs": len(successful),
            "latest_run": latest.to_dict() if latest else None,
            "current_model_metrics": current_metrics.to_dict() if current_metrics else None,
            "ndcg_trend": ndcg_trend,
            "avg_training_duration_seconds": (
                sum(r.training_seconds for r in successful) / len(successful)
                if successful
                else 0.0
            ),
        }
    except Exception:
        return {}
