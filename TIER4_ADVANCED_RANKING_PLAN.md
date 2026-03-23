# Phase 2: Tier 4 Advanced Ranking - Implementation Plan

**Status:** Planning
**Target Completion:** Systematic implementation, one feature at a time
**Quality Priority:** High-quality, maintainable code over speed

---

## Overview

Tier 4 Advanced Ranking extends MAGNETO's search relevance with three major features:

1. **Query Intent Detection** - Classify queries (navigational, informational, transactional, local)
2. **Cross-Domain Relevance Signals** - Multi-source ranking improvements
3. **User Personalization Layer** - Begin learning user preferences, prepare for personalized ranking

All features integrate with existing LTR system and require no breaking changes to current code.

---

## Feature 1: Query Intent Detection

### Purpose

Understand user intent to improve ranking and suggestion relevance.

### Intent Classifications

- **Navigational** - User looking for specific website/page (e.g., "github", "python official docs")
- **Informational** - User seeking knowledge/answer (e.g., "how to learn python", "machine learning basics")
- **Transactional** - User planning action/purchase (e.g., "buy python books", "hire python developers")
- **Local** - User looking for geographic info (e.g., "python meetup near me", "restaurants in New York")

### Implementation Strategy

**Step 1.1: Intent Classifier Module**

```python
# File: backend-django/core/services/query_intent.py (NEW)
class QueryIntent:
    NAVIGATIONAL = "navigational"
    INFORMATIONAL = "informational"
    TRANSACTIONAL = "transactional"
    LOCAL = "local"

def detect_query_intent(query: str) -> dict:
    """
    Returns: {
        "intent": "informational",
        "confidence": 0.85,
        "signals": ["question_format", "educational_terms"]
    }
    """
```

**Step 1.2: Intent Signals**

- Question patterns: "how to", "what is", "why", "where", "when"
- Transactional markers: "buy", "price", "hire", "get", "download"
- Brand/domain patterns: Known site names (github, stackoverflow, linkedin)
- Location markers: "near me", "in [city]", geographic terms
- Educational terms: "learn", "tutorial", "guide", "example"

**Step 1.3: Integration with Search**

- Return intent in `/api/search` response
- Use intent to adjust ranking (e.g., boost authority for informational, boost brand sites for navigational)
- Track intent in analytics for learning

**Step 1.4: Testing**

- Test with 50+ diverse queries (10 per intent type)
- Verify accuracy ≥90% for clear cases
- Measure impact on NDCG@5

### Files to Create/Modify

- [ ] **NEW:** `backend-django/core/services/query_intent.py` (intent classifier)
- [ ] **MODIFY:** `backend-django/core/services/search_service.py` (call query intent, use in ranking)
- [ ] **NEW:** Tests for intent detection
- [ ] **MODIFY:** `/api/search` response schema (add intent field - optional)

### Effort: ~2-3 hours

### Complexity: Low

### Risk: Low (non-breaking, additive only)

---

## Feature 2: Cross-Domain Relevance Signals

### Purpose

Improve ranking by leveraging multi-source data and cross-domain indicators.

### New Signals

**Signal 2.1: Domain Cross-Reference**

- If query matches multiple domains, boost documents that reference other domains
- Example: "python frameworks" - boost docs that mention Django, Flask, FastAPI (all frameworks)
- Encourages discoverable, comprehensive content

**Signal 2.2: Entity Recognition**

- Identify named entities (programming languages, frameworks, people, organizations)
- Boost documents that rank well for multiple entities from the query
- Example: "Guido van Rossum Python" - recognize both person + language

**Signal 2.3: Query-Document Structure Match**

- Analyze document structure and query intent match
- Example: Query "python tutorial" → boost structured tutorials (step-by-step) over blog posts
- Structure types: Tutorial, Documentation, API Reference, Blog, News, Discussion

**Signal 2.4: Cross-Source Authority**

- If a document is cited/linked by high-authority sources, boost it
- Example: If arxiv paper links to github repo, boost the repo for research-related queries
- Accumulative: More citations = higher boost

**Signal 2.5: Query Topic Coherence**

- Measure if all tokens in a document are closely related to each other
- Penalize documents that coincidentally match individual tokens but aren't cohesive
- Example: Avoid ranking document about "Java coffee" for "Java programming"

### Implementation Strategy

**Step 2.1: Entity Recognition Module**

```python
# File: backend-django/core/services/entity_recognition.py (NEW)
class EntityRecognizer:
    @staticmethod
    def extract_entities(text: str) -> dict:
        """
        Returns entities found in text:
        {
            "programming_languages": ["python", "javascript"],
            "frameworks": ["django", "react"],
            "people": ["Guido van Rossum"],
            "organizations": ["google"]
        }
        """
```

**Step 2.2: Document Structure Analyzer**

```python
# File: backend-django/core/services/doc_structure.py (NEW)
def analyze_document_structure(doc: SearchDocument) -> str:
    """
    Returns: "tutorial" | "documentation" | "api_reference" | "blog" | "news" | "discussion" | "other"

    Uses heuristics:
    - Tutorial: "step", "guide", "learn", numbered sections, code examples
    - Documentation: "API", "reference", formal structure
    - Blog: Author info, date prominent, narrative tone
    - News: Publication date, news keywords
    """
```

**Step 2.3: Cross-Reference Scoring**

```python
# File: backend-django/core/services/cross_reference.py (NEW)
class CrossReferenceScorer:
    def score_cross_references(doc: SearchDocument, query_entities: list) -> float:
        """
        Score: 0-5 based on how many query entities are mentioned in the document
        """
```

**Step 2.4: Integration with Search**

- Calculate all signals per document during search
- Add signals to LTR feature tracking
- Model learns weights automatically with existing LTR system
- No changes to API contract

### Files to Create/Modify

- [ ] **NEW:** `backend-django/core/services/entity_recognition.py`
- [ ] **NEW:** `backend-django/core/services/doc_structure.py`
- [ ] **NEW:** `backend-django/core/services/cross_reference.py`
- [ ] **NEW:** Entity/structure databases (domains, entities, keywords)
- [ ] **MODIFY:** `search_service.py` (integrate new signals into scoring)
- [ ] **NEW:** Tests for each signal type

### Effort: ~4-5 hours

### Complexity: Medium

### Risk: Low (LTR learns weights, can disable signals if harmful)

---

## Feature 3: User Personalization Layer

### Purpose

Begin learning user preferences and prepare infrastructure for personalized ranking.

### Personalization Data to Collect

**Implicit Signals (Non-PII):**

- Query topics (NLP categorization)
- Document types clicked (tutorials vs blogs vs academic)
- Domains clicked (preferred sources)
- Dwell time distribution (time spent per domain type)
- Session context (related queries)

### Implementation Strategy

**Step 3.1: User Preference Tracking**

```python
# File: backend-django/core/models.py (MODIFY)
class UserSearchPreference(models.Model):
    """Track user's search preferences and behavior"""
    user_hash = CharField()  # Anonymous hash, not real user ID
    preferred_domains = JSONField()  # {"github.com": 15, "docs.python.org": 12}
    preferred_doc_types = JSONField()  # {"tutorial": 8, "blog": 3, "api": 10}
    preferred_languages = JSONField()  # {"python": 20, "javascript": 5}
    topic_distribution = JSONField()  # {topic: count}
    average_dwell_time_ms = IntegerField()
    session_count = IntegerField()
    last_updated = DateTimeField()
```

**Step 3.2: Preference Aggregation Service**

```python
# File: backend-django/core/services/user_preferences.py (NEW)
class UserPreferenceService:
    @staticmethod
    def extract_search_topic(query: str) -> str:
        """Categorize query: programming, data_science, ml, web, mobile, devops, etc."""

    @staticmethod
    def aggregate_preferences(user_hash: str) -> dict:
        """Build user preference profile from interactions"""

    @staticmethod
    def apply_personalization(ranking_scores: list, user_hash: str) -> list:
        """Adjust ranking based on user preferences"""
```

**Step 3.3: Personalization Scoring**

```python
# Personalization bonus:
# - User's preferred domains: +2.0
# - User's preferred doc types: +1.5
# - User's topic area: +1.0
# - Against user's dislikes: -0.5
```

**Step 3.4: Privacy-First Design**

- No PII stored (use hash of session/IP, not user ID)
- Preferences reset on browser clear
- No cross-site tracking
- Transparent: Display "ranked for you" indicator when personalization applied
- Opt-out available: "Show results without personalization"

**Step 3.5: A/B Testing**

- Cohort 1: Control (no personalization)
- Cohort 2: Personalization on
- Track: NDCG@5, click-through rate, dwell time

### Files to Create/Modify

- [ ] **NEW:** `backend-django/core/models.py` - Add UserSearchPreference model
- [ ] **NEW:** `backend-django/core/services/user_preferences.py`
- [ ] **NEW:** Preference migration script (if deploying to existing data)
- [ ] **MODIFY:** `search_service.py` (call preference service)
- [ ] **MODIFY:** `/api/search` response (add "personalized" flag)
- [ ] **MODIFY:** `admin.html` (show personalization status)
- [ ] **NEW:** Settings for personalization enable/disable

### Effort: ~5-6 hours

### Complexity: Medium-High

### Risk: Medium (need careful A/B testing to ensure improvement)

---

## Implementation Timeline

Working systematically, "one by one":

### Week 1: Query Intent Detection

- Day 1: Implement intent classifier + tests
- Day 2: Integrate with search endpoint
- Day 3: Test & validate accuracy
- Day 4: Deploy to staging, run A/B test

### Week 2: Cross-Domain Signals

- Day 1: Implement entity recognition + structure analyzer
- Day 2: Implement cross-reference scorer
- Day 3: Integrate all signals with LTR
- Day 4: Test & validate signal importance

### Week 3: User Personalization

- Day 1: Add database models + migration
- Day 2: Implement preference aggregation service
- Day 3: Integrate personalization into ranking
- Day 4: A/B test, validate improvement

### Week 4: Refinement & Deployment

- Day 1: Analyze metrics from all features
- Day 2: Tune signals and thresholds
- Day 3: Update analytics dashboard with new metrics
- Day 4: Full deployment with monitoring

---

## Success Criteria

### Query Intent Detection

- ✅ Accuracy ≥90% on test queries (50+ queries)
- ✅ Intent correctly influences ranking (informational queries rank docs vs brand sites appropriately)
- ✅ No performance degradation (<5ms added per query)

### Cross-Domain Signals

- ✅ LTR model learns signal weights successfully
- ✅ NDCG@5 improvement ≥2% in A/B test
- ✅ No removal of relevant results
- ✅ Signals properly tracked for learning

### User Personalization

- ✅ Preference profile builds correctly (verified manually)
- ✅ A/B test shows ≥3% improvement in NDCG@5 or CTR
- ✅ Privacy controls working (opt-out, preference reset)
- ✅ No performance degradation

---

## Testing Strategy

### Unit Tests

- Intent detection accuracy
- Entity recognition correctness
- Structure classification accuracy
- Preference aggregation logic

### Integration Tests

- Signals flow through to LTR correctly
- Personalization doesn't break existing ranking
- No SQL injection in user preference queries

### A/B Tests

- Query intent detection: 60/40 split, measure NDCG@5
- Cross-domain signals: Disabled vs enabled, 10,000+ queries
- Personalization: Control vs personalized, 10,000+ queries

### Manual Testing

- 50+ diverse queries, verify ranking sanity
- Check for unexpected boosting/burying of relevant docs
- Verify performance metrics (p95 latency <2s)

---

## Documentation Needed

- [ ] Query Intent Architecture doc
- [ ] Entity Recognition API doc
- [ ] User Preferences Model doc
- [ ] Personalization Settings doc
- [ ] Analytics Dashboard updates doc
- [ ] A/B Testing results summary

---

## Rollback Plan

Each feature can be independently disabled:

```python
# In settings or feature flags:
FEATURES = {
    "query_intent_detection": True,      # Can disable independently
    "cross_domain_signals": True,         # Can disable independently
    "user_personalization": False,        # Start disabled, enable after testing
}
```

If NDCG@5 degrades >1% after any feature deployment:

1. Disable feature immediately
2. Investigate root cause
3. Fix and re-test
4. Deploy with monitoring

---

## Next Steps

Ready to start implementation:

1. **Option A:** Begin Feature 1 - Query Intent Detection (recommended - lowest risk, foundation for others)
2. **Option B:** Begin Feature 2 - Cross-Domain Signals (can be done in parallel)
3. **Option C:** Begin Feature 3 - User Personalization (depends on Feature 1)

**Recommendation:** Start with Feature 1, which provides foundation and lowest risk. Then proceed to 2 and 3 in order.

---

_Last Updated: 2026-03-23_
_Quality Target: Production-grade, maintainable code_
_Timeline: Systematic, no rush_
