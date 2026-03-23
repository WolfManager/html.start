"""
Query Intent Detection Service

Classifies user search queries into intent categories to improve ranking and suggestions.
Supports: Navigational, Informational, Transactional, Local

Usage:
    intent = detect_query_intent("how to learn python")
    # Returns: {
    #     "intent": "informational",
    #     "confidence": 0.92,
    #     "signals": ["question_format", "educational_terms", "how_keyword"]
    # }
"""

import re
from enum import Enum
from typing import Dict, List, Tuple


class QueryIntent(Enum):
    """Query intent classifications."""
    NAVIGATIONAL = "navigational"
    INFORMATIONAL = "informational"
    TRANSACTIONAL = "transactional"
    LOCAL = "local"


class QueryIntentDetector:
    """Detects user intent from search queries."""

    PLATFORM_BRANDS = {
        "github", "gitlab", "bitbucket", "stackoverflow", "stack overflow",
        "reddit", "wikipedia", "youtube", "google", "amazon", "apple", "microsoft",
    }

    TECH_TOPICS = {
        "python", "django", "react", "vue", "node", "java",
        "javascript", "typescript", "golang", "rust", "c++", "fastapi", "flask",
    }

    # Intent signal keywords and patterns
    QUESTION_MARKERS = {
        "how", "what", "why", "when", "where", "which", "who",
        "is", "are", "do", "does", "can", "could", "should"
    }

    EDUCATIONAL_KEYWORDS = {
        "learn", "tutorial", "guide", "example", "introduction",
        "basics", "getting started", "documentation", "reference",
        "course", "lesson", "training", "explain", "understand"
    }

    EDUCATIONAL_PHRASES = {
        "getting started", "step by step", "how to", "how do", "how does",
    }

    TRANSACTIONAL_KEYWORDS = {
        "buy", "purchase", "price", "cost", "free", "download",
        "hire", "get", "install", "setup", "license", "subscription",
        "trial", "compare", "comparison", "review", "best", "books",
        "courses", "hosting", "online"
    }

    LOCAL_KEYWORDS = {
        "near me", "nearby", "location", "in", "address", "hours",
        "phone", "contact", "map", "directions", "find"
    }

    LOCAL_PATTERNS = [
        r'\bnear\s+(me|us|you)\b',
        r'\bin\s+\w+(?:\s+\w+)?$',  # "in [city]" or "in [city, state]"
        r'\b(?:closest|nearest|local)\b',
        r'(what\'?s|what\s+is)\s+nearby',
    ]

    BRAND_PATTERNS = [
        r'\b(?:github|gitlab|bitbucket|stack\s*overflow|reddit|wikipedia|youtube|google|amazon)\b',
        r'\b(?:official|docs?|documentation|api)\b',
        r'site:[\w.]+\.(?:com|org|io|dev)',
    ]

    @staticmethod
    def detect_intent(query: str) -> Dict:
        """
        Detect the intent of a search query.

        Args:
            query: The search query string

        Returns:
            Dictionary with keys:
            - intent: One of QueryIntent enum values
            - confidence: Float 0-1 indicating confidence level
            - signals: List of signal names that contributed to the decision
        """
        query_lower = query.lower().strip()

        # Detect each intent type
        nav_score, nav_signals = QueryIntentDetector._score_navigational(query_lower)
        info_score, info_signals = QueryIntentDetector._score_informational(query_lower)
        trans_score, trans_signals = QueryIntentDetector._score_transactional(query_lower)
        local_score, local_signals = QueryIntentDetector._score_local(query_lower)

        scores = {
            QueryIntent.NAVIGATIONAL: (nav_score, nav_signals),
            QueryIntent.INFORMATIONAL: (info_score, info_signals),
            QueryIntent.TRANSACTIONAL: (trans_score, trans_signals),
            QueryIntent.LOCAL: (local_score, local_signals),
        }

        # Find highest scoring intent
        ordered_scores = sorted(
            ((intent, values[0]) for intent, values in scores.items()),
            key=lambda item: item[1],
            reverse=True,
        )
        detected_intent = ordered_scores[0][0]
        score, signals = scores[detected_intent]
        second_score = ordered_scores[1][1] if len(ordered_scores) > 1 else 0.0

        if score <= 0:
            confidence = 0.0
        else:
            confidence = min(
                1.0,
                0.35 + (0.35 * (score / (score + second_score or 1.0))) + (0.25 * min(score / 5.0, 1.0)),
            )

        return {
            "intent": detected_intent.value,
            "confidence": round(confidence, 2),
            "signals": signals,
            "scores": {
                k.value: round(scores[k][0], 1) for k in scores
            }
        }

    @staticmethod
    def _score_navigational(query: str) -> Tuple[float, List[str]]:
        """
        Score likelihood of navigational intent.
        Navigational: Looking for a specific website/page.
        """
        score = 0.0
        signals = []

        # Known platform/site names
        if QueryIntentDetector._contains_platform_brand(query):
            score += 4.0
            signals.append("brand_mention")

        if QueryIntentDetector._has_domain_pattern(query):
            score += 3.0
            signals.append("domain_pattern")

        # Short, direct queries often navigational
        query_words = len(query.split())
        if query_words <= 2:
            score += 0.75
            signals.append("short_query")

        if query_words <= 2 and query.strip() in QueryIntentDetector.TECH_TOPICS:
            score += 1.5
            signals.append("tech_topic_lookup")

        # Known site operators
        if "site:" in query:
            score += 4.0
            signals.append("site_operator")

        # Official/docs keywords
        if any(word in query for word in ["official", "docs", "documentation", "api"]):
            score += 4.0
            signals.append("official_keyword")

        return score, signals

    @staticmethod
    def _score_informational(query: str) -> Tuple[float, List[str]]:
        """
        Score likelihood of informational intent.
        Informational: Seeking knowledge, answers, explanations.
        """
        score = 0.0
        signals = []

        # Question format
        if query.endswith("?"):
            score += 3.0
            signals.append("question_mark")

        # Question words
        query_words = set(query.split())
        question_words = QueryIntentDetector.QUESTION_MARKERS & query_words
        if question_words:
            score += 2.5 * len(question_words)  # Multiple question words boost
            signals.append("question_words")

        # Educational keywords
        educational_words = QueryIntentDetector.EDUCATIONAL_KEYWORDS & query_words
        if educational_words:
            score += 2.0 * len(educational_words)
            signals.append("educational_terms")

        if any(word in query_words for word in {"tutorial", "guide", "reference", "documentation"}):
            score += 1.0
            signals.append("resource_keyword")

        phrase_matches = [phrase for phrase in QueryIntentDetector.EDUCATIONAL_PHRASES if phrase in query]
        if phrase_matches:
            score += 2.0 * len(phrase_matches)
            signals.append("educational_phrases")

        # "How to" is strongly informational
        if "how to" in query or "how do" in query:
            score += 2.5
            signals.append("how_to_phrase")

        # Research/academic terms
        if any(word in query for word in ["study", "research", "academic", "thesis", "paper"]):
            score += 1.5
            signals.append("academic_terms")

        # Explanation keywords
        if any(word in query for word in ["explain", "definition", "meaning", "difference"]):
            score += 1.5
            signals.append("explanation_keywords")

        return score, signals

    @staticmethod
    def _score_transactional(query: str) -> Tuple[float, List[str]]:
        """
        Score likelihood of transactional intent.
        Transactional: Buy, sell, perform action, download, etc.
        """
        score = 0.0
        signals = []

        # Transactional keywords
        query_words = set(query.split())
        trans_words = QueryIntentDetector.TRANSACTIONAL_KEYWORDS & query_words
        if trans_words:
            score += 2.5 * len(trans_words)
            signals.append("transactional_keywords")

        # Commerce-related patterns
        if any(word in query for word in ["price", "cost", "free", "subscription", "license"]):
            score += 2.0
            signals.append("commerce_terms")

        # Action words
        if any(word in query for word in ["best", "top", "cheapest", "fastest", "easiest", "comparison", "compare"]):
            score += 1.5
            signals.append("comparison_keywords")

        # Download/install intent
        if any(word in query for word in ["download", "install", "setup", "configure"]):
            score += 2.5
            signals.append("install_keywords")

        # Product/service indicators
        if "+" in query or "vs" in query or " or " in query:
            score += 1.0
            signals.append("comparison_operator")

        return score, signals

    @staticmethod
    def _score_local(query: str) -> Tuple[float, List[str]]:
        """
        Score likelihood of local intent.
        Local: Geographic/location-based information.
        """
        score = 0.0
        signals = []

        # "Near me" is strongest local signal
        if "near me" in query or "nearby" in query:
            score += 4.0
            signals.append("near_me")

        # Local patterns
        for pattern in QueryIntentDetector.LOCAL_PATTERNS:
            if re.search(pattern, query, re.IGNORECASE):
                score += 2.0
                signals.append("local_pattern")
                break

        # Local keywords
        local_words = QueryIntentDetector.LOCAL_KEYWORDS & set(query.split())
        if local_words:
            score += 1.5 * len(local_words)
            signals.append("local_keywords")

        # City/state patterns (common locale names)
        if re.search(r'\b(?:New York|Los Angeles|Chicago|Houston|Phoenix|Philadelphia|San Antonio|San Diego|Dallas|San Jose)\b', query, re.IGNORECASE):
            score += 2.0
            signals.append("city_name")

        # Postal code
        if re.search(r'\b\d{5}\b', query):
            score += 2.0
            signals.append("postal_code")

        return score, signals

    @staticmethod
    def _contains_platform_brand(query: str) -> bool:
        """Check if query contains known platform brands."""
        return bool(QueryIntentDetector._find_platform_brands(query))

    @staticmethod
    def _find_platform_brands(query: str) -> List[str]:
        """Find known platform brands in query."""
        found = [brand for brand in QueryIntentDetector.PLATFORM_BRANDS if brand in query.lower()]
        return found

    @staticmethod
    def _has_domain_pattern(query: str) -> bool:
        """Check if query has domain-like pattern."""
        return bool(re.search(r'[\w-]+\.(?:com|org|io|dev|net|co)', query, re.IGNORECASE))


def detect_query_intent(query: str) -> Dict:
    """
    Convenience function to detect query intent.

    Args:
        query: The search query string

    Returns:
        Dictionary with intent classification and signals
    """
    return QueryIntentDetector.detect_intent(query)


# Intent-specific ranking adjustments
def get_intent_ranking_boost(intent: str, domain: str | None = None) -> float:
    """
    Get ranking boost factor based on intent and optionally domain.

    Returns:
        Float multiplier for ranking score (1.0 = no boost)
    """
    boost_map = {
        QueryIntent.NAVIGATIONAL.value: {
            "default": 1.0,
            "github.com": 1.5,
            "stackoverflow.com": 1.3,
            "wikipedia.org": 1.2,
        },
        QueryIntent.INFORMATIONAL.value: {
            "default": 1.0,
            "docs": 1.4,
            "tutorial": 1.3,
            "guide": 1.2,
        },
        QueryIntent.TRANSACTIONAL.value: {
            "default": 1.0,
        },
        QueryIntent.LOCAL.value: {
            "default": 1.0,
        },
    }

    if intent not in boost_map:
        return 1.0

    intent_boosts = boost_map[intent]
    if domain:
        domain_boost = intent_boosts.get(domain, intent_boosts.get("default", 1.0))
    else:
        domain_boost = intent_boosts.get("default", 1.0)

    return domain_boost
