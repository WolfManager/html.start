"""
A/B Testing Framework for Ranking Algorithm Comparison.

Manages experiment variants, rollout strategies, and win rate computation.
Supports gradual rollout with safety checks.
"""

import json
import random
import time
from pathlib import Path
from typing import Any
from datetime import datetime, timedelta

BASE_DIR = Path(__file__).resolve().parents[2]
AB_TEST_STATE_PATH = BASE_DIR.parent / "data" / "ab-test-state.json"


class ABTestVariant:
    """Represents an A/B test variant."""

    def __init__(self, name: str, traffic_fraction: float = 0.5):
        self.name = name  # "control" or "treatment"
        self.traffic_fraction = traffic_fraction  # 0.0 to 1.0
        self.created_at = datetime.utcnow().isoformat()
        self.metrics: dict[str, Any] = {
            "visits": 0,
            "clicks": 0,
            "sum_dwell_time_ms": 0,
            "avg_dwell_time_ms": 0.0,
            "ctr": 0.0,
        }

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "traffic_fraction": self.traffic_fraction,
            "created_at": self.created_at,
            "metrics": self.metrics,
        }

    @staticmethod
    def from_dict(data: dict) -> "ABTestVariant":
        v = ABTestVariant(data.get("name", "control"), data.get("traffic_fraction", 0.5))
        v.created_at = data.get("created_at", v.created_at)
        v.metrics = data.get("metrics", v.metrics)
        return v


class ABTest:
    """A/B test experiment manager."""

    def __init__(self, test_id: str, control_name: str = "control", treatment_name: str = "treatment"):
        self.test_id = test_id
        self.created_at = datetime.utcnow().isoformat()
        self.status = "active"  # active, paused, completed
        self.is_statistically_significant = False
        self.winner: str | None = None

        self.variants = {
            control_name: ABTestVariant(control_name, traffic_fraction=0.5),
            treatment_name: ABTestVariant(treatment_name, traffic_fraction=0.5),
        }

    def assign_variant(self, user_id: str) -> str:
        """Consistently assign user to variant based on user_id."""
        # Use deterministic hash for consistency
        hash_val = hash(f"{self.test_id}_{user_id}") % 1000
        fraction_val = hash_val / 1000.0

        cumulative = 0.0
        for variant_name, variant in self.variants.items():
            cumulative += variant.traffic_fraction
            if fraction_val < cumulative:
                return variant_name

        # Fallback (shouldn't happen)
        return list(self.variants.keys())[0]

    def record_interaction(
        self,
        variant_name: str,
        clicked: bool = False,
        dwell_time_ms: int = 0,
    ) -> None:
        """Record user interaction for variant."""
        if variant_name not in self.variants:
            return

        variant = self.variants[variant_name]
        variant.metrics["visits"] += 1
        if clicked:
            variant.metrics["clicks"] += 1
        variant.metrics["sum_dwell_time_ms"] += dwell_time_ms

        # Update CTR and avg dwell time
        visits = max(1, variant.metrics["visits"])
        variant.metrics["ctr"] = variant.metrics["clicks"] / visits
        variant.metrics["avg_dwell_time_ms"] = variant.metrics["sum_dwell_time_ms"] / visits

    def compute_win_rate(self) -> dict[str, float]:
        """Compute win probability for each variant (simplified Bayesian)."""
        win_rates: dict[str, float] = {}

        # Use CTR as primary metric
        variants = list(self.variants.values())
        if len(variants) != 2:
            return {}

        v1, v2 = variants[0], variants[1]
        ctr1 = v1.metrics.get("ctr", 0.0)
        ctr2 = v2.metrics.get("ctr", 0.0)

        # Compute win rate (higher CTR = higher win rate)
        total = ctr1 + ctr2
        if total > 0:
            win_rates[v1.name] = ctr1 / total
            win_rates[v2.name] = ctr2 / total
        else:
            win_rates[v1.name] = 0.5
            win_rates[v2.name] = 0.5

        return win_rates

    def check_statistical_significance(self, threshold: float = 0.95) -> bool:
        """Check if winner is statistically significant (simplified)."""
        win_rates = self.compute_win_rate()
        if not win_rates:
            return False

        # Significant if one variant has >95% win probability
        max_win_rate = max(win_rates.values())
        self.is_statistically_significant = max_win_rate >= threshold

        # Determine winner
        if self.is_statistically_significant:
            self.winner = max(win_rates.keys(), key=lambda k: win_rates[k])

        return self.is_statistically_significant

    def compute_chi_square_pvalue(self) -> float:
        """Compute chi-square p-value for CTR difference (2x2 contingency table)."""
        variants = list(self.variants.values())
        if len(variants) != 2:
            return 1.0

        v1, v2 = variants[0], variants[1]
        clicks1 = v1.metrics.get("clicks", 0)
        visits1 = v1.metrics.get("visits", 1)
        clicks2 = v2.metrics.get("clicks", 0)
        visits2 = v2.metrics.get("visits", 1)

        # 2x2 contingency table: [[clicks1, non_clicks1], [clicks2, non_clicks2]]
        non_clicks1 = visits1 - clicks1
        non_clicks2 = visits2 - clicks2

        # Chi-square statistic: (n*(ad - bc)^2) / ((a+b)(c+d)(a+c)(b+d))
        n = visits1 + visits2
        a, b = clicks1, non_clicks1
        c, d = clicks2, non_clicks2

        denominator = (a + b) * (c + d) * (a + c) * (b + d)
        if denominator == 0:
            return 1.0

        chi2 = (n * (a * d - b * c) ** 2) / denominator

        # Approximate p-value using chi-square distribution
        # For df=1, use approximation: p ≈ erfc(sqrt(chi2 / 2)) / 2
        # We'll use a simpler approach: return probability based on chi2
        # Critical value for 95% confidence (df=1) is ~3.84
        if chi2 > 3.84:
            return max(0.001, 1.0 - (chi2 - 3.84) / 10.0)  # Approximate p-value
        else:
            return 1.0

    def compute_confidence_interval(self, confidence: float = 0.95) -> dict[str, dict[str, float]]:
        """Compute 95% CI for CTR using normal approximation for proportions."""
        intervals = {}
        z = 1.96  # 95% confidence z-score

        for name, variant in self.variants.items():
            clicks = variant.metrics.get("clicks", 0)
            visits = variant.metrics.get("visits", 1)
            ctr = variant.metrics.get("ctr", 0.0)

            if visits < 30:  # Normal approximation validity threshold
                se = 0.0
                ci_lower = 0.0
                ci_upper = 0.0
            else:
                # Standard error for proportion: sqrt(p(1-p)/n)
                se = (ctr * (1 - ctr) / visits) ** 0.5
                margin = z * se
                ci_lower = max(0.0, ctr - margin)
                ci_upper = min(1.0, ctr + margin)

            intervals[name] = {
                "ctr": ctr,
                "se": round(se, 6),
                "ci_lower": round(ci_lower, 6),
                "ci_upper": round(ci_upper, 6),
                "margin": round(z * se, 6),
            }

        return intervals

    def compute_sample_adequacy(self, min_sample_per_variant: int = 100) -> dict[str, Any]:
        """Check if sample sizes meet adequacy threshold."""
        adequacy = {}

        for name, variant in self.variants.items():
            visits = variant.metrics.get("visits", 0)
            clicks = variant.metrics.get("clicks", 0)
            is_adequate = visits >= min_sample_per_variant

            adequacy[name] = {
                "visits": visits,
                "min_required": min_sample_per_variant,
                "is_adequate": is_adequate,
                "percent_of_required": round((visits / min_sample_per_variant * 100), 1) if min_sample_per_variant > 0 else 100,
            }

        return adequacy

    def get_test_duration(self) -> dict[str, Any]:
        """Get test duration and readiness indicators."""
        try:
            start_time = datetime.fromisoformat(self.created_at)
            elapsed = datetime.utcnow() - start_time
            days = elapsed.days
            hours = elapsed.seconds // 3600
            minutes = (elapsed.seconds % 3600) // 60

            # Minimum test duration: 7 days (typical statistical requirement)
            min_days = 7
            is_duration_adequate = days >= min_days
            days_remaining = max(0, min_days - days)

            return {
                "created_at": self.created_at,
                "elapsed_days": days,
                "elapsed_hours": hours,
                "elapsed_minutes": minutes,
                "min_required_days": min_days,
                "is_duration_adequate": is_duration_adequate,
                "days_remaining": days_remaining,
                "formatted": f"{days}d {hours}h {minutes}m",
            }
        except Exception:
            return {
                "created_at": self.created_at,
                "elapsed_days": 0,
                "elapsed_hours": 0,
                "elapsed_minutes": 0,
                "min_required_days": 7,
                "is_duration_adequate": False,
                "days_remaining": 7,
                "formatted": "calculating...",
            }

    def to_dict(self) -> dict[str, Any]:
        return {
            "test_id": self.test_id,
            "created_at": self.created_at,
            "status": self.status,
            "is_statistically_significant": self.is_statistically_significant,
            "winner": self.winner,
            "variants": {
                name: variant.to_dict() for name, variant in self.variants.items()
            },
        }

    @staticmethod
    def from_dict(data: dict) -> "ABTest":
        test_id = data.get("test_id", "unknown")
        # Infer variant names from data
        variant_names = list(data.get("variants", {}).keys())
        control = variant_names[0] if len(variant_names) > 0 else "control"
        treatment = variant_names[1] if len(variant_names) > 1 else "treatment"

        test = ABTest(test_id, control, treatment)
        test.created_at = data.get("created_at", test.created_at)
        test.status = data.get("status", "active")
        test.is_statistically_significant = data.get("is_statistically_significant", False)
        test.winner = data.get("winner")

        # Load variants
        for name, vdata in data.get("variants", {}).items():
            test.variants[name] = ABTestVariant.from_dict(vdata)

        return test


def get_current_ab_test() -> ABTest | None:
    """Load current active A/B test."""
    try:
        if not AB_TEST_STATE_PATH.exists():
            return None

        with open(AB_TEST_STATE_PATH, "r") as f:
            data = json.load(f)
            return ABTest.from_dict(data)
    except Exception:
        return None


def save_ab_test(test: ABTest) -> bool:
    """Save A/B test state."""
    try:
        AB_TEST_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(AB_TEST_STATE_PATH, "w") as f:
            json.dump(test.to_dict(), f, indent=2)
        return True
    except Exception:
        return False


def start_ab_test(
    test_id: str,
    control_traffic: float = 0.5,
    treatment_traffic: float = 0.5,
) -> ABTest:
    """Start new A/B test with specified traffic split."""
    test = ABTest(test_id, "control", "treatment")
    test.variants["control"].traffic_fraction = control_traffic
    test.variants["treatment"].traffic_fraction = treatment_traffic
    save_ab_test(test)
    return test


def update_traffic_split(test: ABTest, control_fraction: float) -> bool:
    """
    Update traffic split for gradual rollout.

    Increases treatment traffic as control shows better results.
    """
    if control_fraction < 0 or control_fraction > 1.0:
        return False

    test.variants["control"].traffic_fraction = control_fraction
    test.variants["treatment"].traffic_fraction = 1.0 - control_fraction
    return save_ab_test(test)


def should_rollout_to_100_percent(test: ABTest) -> bool:
    """
    Determine if treatment should be rolled out to 100%.

    Checks:
    1. Statistical significance achieved
    2. Treatment has higher CTR than control
    3. Min sample size in both variants
    """
    if test.status != "active":
        return False

    # Check statistical significance
    if not test.check_statistical_significance(threshold=0.95):
        return False

    # Check if treatment won
    if test.winner != "treatment":
        return False

    # Minimum sample size check
    min_samples = 500
    for variant in test.variants.values():
        if variant.metrics.get("visits", 0) < min_samples:
            return False

    return True
