"""
Learning-to-Rank (LTR) Model Training & Evaluation.

Trains models from collected interaction data, evaluates ranking quality,
and manages model versioning and deployment.
"""

import json
import math
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parents[2]
LTR_MODEL_PATH = BASE_DIR.parent / "data" / "ltr-model.json"
LTR_MODEL_HISTORY_PATH = BASE_DIR.parent / "data" / "ltr-model-history.json"


class LTRModel:
    """Simple gradient boosting-inspired LTR model."""

    def __init__(self):
        self.model_id = f"ltr_{int(time.time())}"
        self.created_at = datetime.utcnow().isoformat()
        self.version = "1.0"
        self.feature_weights: dict[str, float] = {}
        self.bias = 0.0
        self.feature_importance: dict[str, float] = {}
        self.training_metrics: dict[str, Any] = {}
        self.is_active = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "model_id": self.model_id,
            "created_at": self.created_at,
            "version": self.version,
            "feature_weights": self.feature_weights,
            "bias": self.bias,
            "feature_importance": self.feature_importance,
            "training_metrics": self.training_metrics,
            "is_active": self.is_active,
        }

    @staticmethod
    def from_dict(data: dict) -> "LTRModel":
        model = LTRModel()
        model.model_id = data.get("model_id", model.model_id)
        model.created_at = data.get("created_at", model.created_at)
        model.version = data.get("version", model.version)
        model.feature_weights = data.get("feature_weights", {})
        model.bias = data.get("bias", 0.0)
        model.feature_importance = data.get("feature_importance", {})
        model.training_metrics = data.get("training_metrics", {})
        model.is_active = data.get("is_active", False)
        return model

    def predict(self, features: dict[str, float]) -> float:
        """Predict relevance score (0-1) from features."""
        score = self.bias
        for feature_name, weight in self.feature_weights.items():
            if feature_name in features:
                score += weight * features[feature_name]
        # Sigmoid to squash to 0-1
        return 1.0 / (1.0 + math.exp(-score))

    def predict_ranking(self, docs_with_features: list[dict]) -> list[float]:
        """Predict scores for multiple documents."""
        return [self.predict(doc.get("features", {})) for doc in docs_with_features]


def train_ltr_model(
    training_samples: list[dict], min_samples: int = 100
) -> LTRModel | None:
    """
    Train LTR model from interaction samples.

    Each sample: {features: dict, label: int (1=clicked, 0=not), timestamp: float}
    Returns trained model or None if insufficient data.
    """
    if not training_samples or len(training_samples) < min_samples:
        return None

    model = LTRModel()

    # Extract features and labels
    features_list = []
    labels = []
    for sample in training_samples:
        try:
            features_list.append(sample.get("features", {}))
            labels.append(sample.get("label", 0))
        except Exception:
            continue

    if len(features_list) < min_samples:
        return None

    # Initialize feature weights uniformly
    all_feature_names = set()
    for f in features_list:
        all_feature_names.update(f.keys())

    # Simple learning: gradient boosting-inspired weight updates
    # For each feature, compute its correlation with labels
    feature_scores: dict[str, list[float]] = {fname: [] for fname in all_feature_names}

    for features, label in zip(features_list, labels):
        for fname in all_feature_names:
            feature_val = features.get(fname, 0.0)
            # Weight by label to compute feature importance
            feature_scores[fname].append(feature_val * (2 * label - 1))

    # Compute feature importance (correlation with labels)
    model.feature_importance = {}
    total_importance = 0.0
    for fname, scores in feature_scores.items():
        if not scores:
            continue
        importance = abs(sum(scores) / len(scores))
        model.feature_importance[fname] = importance
        total_importance += importance

    # Normalize importance
    if total_importance > 0:
        model.feature_importance = {
            k: v / total_importance for k, v in model.feature_importance.items()
        }

    # Set weights from importance
    # Bias important features (0.1-0.5 range)
    model.feature_weights = {fname: imp * 0.3 for fname, imp in model.feature_importance.items()}
    model.bias = 0.1  # slight positive bias

    # Compute training metrics
    predictions = model.predict_ranking(
        [{"features": f} for f in features_list]
    )
    ndcg = compute_ndcg(predictions, labels, k=5)
    ap = compute_average_precision(predictions, labels)

    model.training_metrics = {
        "ndcg@5": ndcg,
        "map": ap,
        "sample_count": len(features_list),
        "positive_ratio": sum(labels) / len(labels) if labels else 0,
    }

    return model


def compute_ndcg(predictions: list[float], labels: list[int], k: int = 5) -> float:
    """
    Compute Normalized Discounted Cumulative Gain @ k.

    Higher is better (1.0 is perfect ranking).
    """
    if not predictions or not labels:
        return 0.0

    # Truncate to k elements
    preds = predictions[:k]
    labs = labels[:k]

    if not preds:
        return 0.0

    # Sort indices by prediction score (descending)
    indices = sorted(range(len(preds)), key=lambda i: preds[i], reverse=True)

    # Compute DCG
    dcg = 0.0
    for i, idx in enumerate(indices):
        if i < len(labs):
            dcg += labs[idx] / math.log2(i + 2)  # log2(position+1)

    # Compute ideal DCG (if all positives ranked first)
    ideal_labs = sorted(labs, reverse=True)
    idcg = 0.0
    for i, label in enumerate(ideal_labs):
        idcg += label / math.log2(i + 2)

    # Normalize
    return dcg / idcg if idcg > 0 else 0.0


def compute_average_precision(predictions: list[float], labels: list[int]) -> float:
    """
    Compute Mean Average Precision.

    Measures ranking quality: how early relevant items appear.
    """
    if not predictions or not labels:
        return 0.0

    # Sort indices by prediction score (descending)
    indices = sorted(range(len(predictions)), key=lambda i: predictions[i], reverse=True)

    ap = 0.0
    num_relevant = sum(labels)
    if num_relevant == 0:
        return 0.0

    num_retrieved_relevant = 0
    for rank, idx in enumerate(indices):
        if idx < len(labels) and labels[idx] == 1:
            num_retrieved_relevant += 1
            precision_at_k = num_retrieved_relevant / (rank + 1)
            ap += precision_at_k

    return ap / num_relevant if num_relevant > 0 else 0.0


def save_model(model: LTRModel) -> bool:
    """
    Save trained model to disk.
    Archives previous models in history.
    """
    try:
        # Load history
        history = []
        if LTR_MODEL_HISTORY_PATH.exists():
            try:
                with open(LTR_MODEL_HISTORY_PATH, "r") as f:
                    history = json.load(f)
            except Exception:
                history = []

        # Archive previous active model
        if LTR_MODEL_PATH.exists():
            try:
                with open(LTR_MODEL_PATH, "r") as f:
                    prev_model = json.load(f)
                    if prev_model not in history:
                        history.append(prev_model)
            except Exception:
                pass

        # Keep last 10 models in history
        history = history[-9:]

        # Save new model as active
        model_dict = model.to_dict()
        model_dict["is_active"] = True

        with open(LTR_MODEL_PATH, "w") as f:
            json.dump(model_dict, f, indent=2)

        # Update history
        history.append(model_dict)
        with open(LTR_MODEL_HISTORY_PATH, "w") as f:
            json.dump(history, f, indent=2)

        return True
    except Exception:
        return False


def load_model() -> LTRModel | None:
    """Load active LTR model from disk."""
    try:
        if not LTR_MODEL_PATH.exists():
            return None

        with open(LTR_MODEL_PATH, "r") as f:
            data = json.load(f)
            return LTRModel.from_dict(data)
    except Exception:
        return None


def get_model_history(limit: int = 5) -> list[dict]:
    """Get history of trained models."""
    try:
        if not LTR_MODEL_HISTORY_PATH.exists():
            return []

        with open(LTR_MODEL_HISTORY_PATH, "r") as f:
            history = json.load(f)
            return history[-limit:] if limit > 0 else history
    except Exception:
        return []
