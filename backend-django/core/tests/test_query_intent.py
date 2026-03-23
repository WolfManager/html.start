"""Tests for Query Intent Detection Service."""

from django.test import SimpleTestCase

from core.services.query_intent import (
    QueryIntent,
    detect_query_intent,
    get_intent_ranking_boost,
)


class TestQueryIntentDetection(SimpleTestCase):
    """Test query intent detection accuracy."""

    # Navigational test cases
    NAVIGATIONAL_QUERIES = [
        "github",
        "github.com",
        "official python documentation",
        "stack overflow login",
        "reddit r/programming",
        "wikipedia machine learning",
        "google docs",
    ]

    # Informational test cases
    INFORMATIONAL_QUERIES = [
        "how to learn python",
        "what is machine learning",
        "python tutorial",
        "how do you use django?",
        "explain neural networks",
        "getting started with react",
        "why is python popular",
        "git basics",
    ]

    # Transactional test cases
    TRANSACTIONAL_QUERIES = [
        "buy python books",
        "python courses online",
        "hire python developers",
        "download python",
        "python hosting comparison",
        "best python IDE",
        "free python compiler",
        "python framework comparison",
    ]

    # Local test cases
    LOCAL_QUERIES = [
        "python meetup near me",
        "python café in new york",
        "restaurants nearby",
        "coffee in 10001",
        "closest gym",
        "what's open near me",
    ]

    def test_navigational_detection(self):
        """Test that navigational queries are correctly identified."""
        for query in self.NAVIGATIONAL_QUERIES:
            result = detect_query_intent(query)
            assert result["intent"] == QueryIntent.NAVIGATIONAL.value, \
                f"Query '{query}' not detected as navigational. Got: {result}"
            assert result["confidence"] >= 0.7, \
                f"Low confidence for navigational '{query}': {result['confidence']}"

    def test_informational_detection(self):
        """Test that informational queries are correctly identified."""
        for query in self.INFORMATIONAL_QUERIES:
            result = detect_query_intent(query)
            assert result["intent"] == QueryIntent.INFORMATIONAL.value, \
                f"Query '{query}' not detected as informational. Got: {result}"
            assert result["confidence"] >= 0.7, \
                f"Low confidence for informational '{query}': {result['confidence']}"

    def test_transactional_detection(self):
        """Test that transactional queries are correctly identified."""
        for query in self.TRANSACTIONAL_QUERIES:
            result = detect_query_intent(query)
            assert result["intent"] == QueryIntent.TRANSACTIONAL.value, \
                f"Query '{query}' not detected as transactional. Got: {result}"
            assert result["confidence"] >= 0.6, \
                f"Low confidence for transactional '{query}': {result['confidence']}"

    def test_local_detection(self):
        """Test that local queries are correctly identified."""
        for query in self.LOCAL_QUERIES:
            result = detect_query_intent(query)
            assert result["intent"] == QueryIntent.LOCAL.value, \
                f"Query '{query}' not detected as local. Got: {result}"
            assert result["confidence"] >= 0.6, \
                f"Low confidence for local '{query}': {result['confidence']}"

    def test_question_queries(self):
        """Test that question format improves informational detection."""
        questions = [
            "how to learn python?",
            "what is machine learning?",
            "why is my code broken?",
        ]
        for query in questions:
            result = detect_query_intent(query)
            assert result["intent"] == QueryIntent.INFORMATIONAL.value
            assert "question_mark" in result["signals"]

    def test_short_queries(self):
        """Test that short queries tend toward navigational."""
        short_queries = [
            "github",
            "python",
            "django",
        ]
        for query in short_queries:
            result = detect_query_intent(query)
            # Short queries with brand names should be navigational
            assert result["intent"] == QueryIntent.NAVIGATIONAL.value

    def test_mixed_intent_queries(self):
        """Test queries with mixed signals."""
        # "django tutorial" has both navigational (brand) and informational (tutorial)
        # Should resolve to one clear intent
        result = detect_query_intent("django tutorial")
        assert result["intent"] in [
            QueryIntent.NAVIGATIONAL.value,
            QueryIntent.INFORMATIONAL.value
        ]
        assert result["confidence"] < 1.0  # Mixed signals = lower confidence

    def test_ambiguous_queries(self):
        """Test that ambiguous queries still return a result."""
        ambiguous = ["python", "java", "c"]  # Language names - could be programming or other
        for query in ambiguous:
            result = detect_query_intent(query)
            assert "intent" in result
            assert "confidence" in result
            assert 0 <= result["confidence"] <= 1.0

    def test_empty_query(self):
        """Test that empty queries are handled gracefully."""
        result = detect_query_intent("")
        assert "intent" in result
        assert "confidence" in result

    def test_whitespace_handling(self):
        """Test that extra whitespace is handled correctly."""
        results = [
            detect_query_intent("  how to learn python  "),
            detect_query_intent("how to learn python"),
        ]
        assert results[0]["intent"] == results[1]["intent"]
        assert results[0]["intent"] == QueryIntent.INFORMATIONAL.value

    def test_case_insensitivity(self):
        """Test that intent detection is case-insensitive."""
        results = [
            detect_query_intent("HOW TO LEARN PYTHON"),
            detect_query_intent("how to learn python"),
            detect_query_intent("How To Learn Python"),
        ]
        assert all(r["intent"] == QueryIntent.INFORMATIONAL.value for r in results)

    def test_signals_are_populated(self):
        """Test that detected signals are reasonable."""
        result = detect_query_intent("how to learn python")
        assert "signals" in result
        assert isinstance(result["signals"], list)
        assert len(result["signals"]) > 0
        # Should have identifiable signals
        expected_signals = ["question_words", "educational_terms", "how_to_phrase"]
        for signal in expected_signals:
            assert signal in result["signals"]

    def test_scores_are_populated(self):
        """Test that all intent scores are calculated."""
        result = detect_query_intent("how to learn python")
        assert "scores" in result
        assert isinstance(result["scores"], dict)
        # All intent types should have a score
        for intent in QueryIntent:
            assert intent.value in result["scores"]
            assert isinstance(result["scores"][intent.value], float)
            assert result["scores"][intent.value] >= 0


class TestIntentRankingBoost(SimpleTestCase):
    """Test intent-based ranking boost factors."""

    def test_navigational_boost_for_brands(self):
        """Test that navigational intent boosts brand sites."""
        github_boost = get_intent_ranking_boost(QueryIntent.NAVIGATIONAL.value, "github.com")
        default_boost = get_intent_ranking_boost(QueryIntent.NAVIGATIONAL.value)

        assert github_boost > default_boost
        assert github_boost > 1.0

    def test_informational_boost_for_docs(self):
        """Test that informational intent uses different boosts."""
        info_boost = get_intent_ranking_boost(QueryIntent.INFORMATIONAL.value)
        assert info_boost >= 1.0

    def test_unknown_intent_returns_default(self):
        """Test that unknown intents return default boost."""
        boost = get_intent_ranking_boost("unknown_intent")
        assert boost == 1.0

    def test_boost_is_positive(self):
        """Test that all boosts are positive multipliers."""
        for intent in QueryIntent:
            boost = get_intent_ranking_boost(intent.value)
            assert boost > 0


class TestEdgeCases(SimpleTestCase):
    """Test edge cases and special scenarios."""

    def test_special_characters(self):
        """Test queries with special characters."""
        queries = [
            "c++ programming",
            "c# basics",
            "node.js tutorial",
            "python2 vs python3",
        ]
        for query in queries:
            result = detect_query_intent(query)
            assert "intent" in result

    def test_very_long_query(self):
        """Test with very long query strings."""
        long_query = " ".join(["word"] * 100)
        result = detect_query_intent(long_query)
        assert "intent" in result
        assert result["confidence"] <= 1.0

    def test_urls_in_query(self):
        """Test queries that contain URLs."""
        result = detect_query_intent("site:github.com python")
        assert result["intent"] == QueryIntent.NAVIGATIONAL.value

    def test_multiple_intents_in_one_query(self):
        """Test queries with signals from multiple intent types."""
        # "how to buy python books" = informational + transactional
        result = detect_query_intent("how to buy python books")
        assert "intent" in result
        # Should resolve to one intent (even if signals mixed)
        assert result["intent"] in [i.value for i in QueryIntent]

    def test_typos_and_misspellings(self):
        """Test that minor typos don't break detection."""
        # Misspelled but still detectable
        result = detect_query_intent("how too lern phyton")
        # Even with typos, should attempt detection
        assert "intent" in result


class TestPerformance(SimpleTestCase):
    """Test performance of intent detection."""

    def test_detection_is_fast(self):
        """Test that intent detection completes quickly."""
        import time

        query = "how to learn python"
        start = time.time()
        for _ in range(1000):
            detect_query_intent(query)
        elapsed = time.time() - start

        # Should complete 1000 detections in < 1 second
        assert elapsed < 1.0, f"Detection too slow: {elapsed}s for 1000 queries"


class TestIntegration(SimpleTestCase):
    """Test integration with other services."""

    def test_result_structure(self):
        """Test that result structure is consistent."""
        result = detect_query_intent("test query")

        required_keys = ["intent", "confidence", "signals"]
        for key in required_keys:
            assert key in result, f"Missing required key: {key}"

    def test_confidence_is_normalized(self):
        """Test that confidence is always between 0 and 1."""
        test_queries = [
            "test",
            "how to learn python",
            "github",
            "buy python books",
            "near me",
        ]

        for query in test_queries:
            result = detect_query_intent(query)
            assert 0 <= result["confidence"] <= 1.0, \
                f"Confidence out of range for '{query}': {result['confidence']}"


# Accuracy summary test
class TestAccuracySummary(SimpleTestCase):
    """Summary of overall detection accuracy."""

    def test_accuracy_summary(self):
        """Print summary of detection accuracy."""
        all_tests = [
            (TestQueryIntentDetection.NAVIGATIONAL_QUERIES, QueryIntent.NAVIGATIONAL.value),
            (TestQueryIntentDetection.INFORMATIONAL_QUERIES, QueryIntent.INFORMATIONAL.value),
            (TestQueryIntentDetection.TRANSACTIONAL_QUERIES, QueryIntent.TRANSACTIONAL.value),
            (TestQueryIntentDetection.LOCAL_QUERIES, QueryIntent.LOCAL.value),
        ]

        print("\n\n=== QUERY INTENT DETECTION ACCURACY ===\n")

        total_correct = 0
        total_queries = 0

        for queries, expected_intent in all_tests:
            correct = 0
            for query in queries:
                result = detect_query_intent(query)
                if result["intent"] == expected_intent:
                    correct += 1
                else:
                    print(f"MISS: '{query}' -> {result['intent']} (expected {expected_intent})")

            accuracy = (correct / len(queries) * 100) if queries else 0
            print(f"{expected_intent.upper():20} {correct:2}/{len(queries):2} queries correct ({accuracy:5.1f}%)")

            total_correct += correct
            total_queries += len(queries)

        overall_accuracy = (total_correct / total_queries * 100) if total_queries else 0
        print(f"\n{'OVERALL ACCURACY':20} {total_correct:2}/{total_queries:2} queries correct ({overall_accuracy:5.1f}%)")
        print()

        # Assert minimum accuracy standard
        assert overall_accuracy >= 90.0, f"Overall accuracy {overall_accuracy}% below 90% threshold"
