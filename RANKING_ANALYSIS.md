# MAGNETO Search Ranking Analysis

## Executive Summary

The MAGNETO search engine implements a **multi-layered hybrid ranking system** combining:

- **Lexical relevance scoring** (token matching with weights)
- **Authority & freshness signals** (source quality, document age)
- **Click-through rate signals** (user behavior feedback)
- **Learning-to-Rank (LTR) model** (machine learning optimization)
- **A/B testing framework** (experiment management)

The system is designed with extensibility in mind, allowing for future integration of stronger ranking signals and a personal AI agent/server.

---

## 1. Current Ranking Algorithm Overview

### Algorithm Architecture

The ranking pipeline consists of three main phases:

```
Query Input
    ↓
Query Processing (Rewrite, Parse Operators, Correct)
    ↓
Search Execution (DB or Index)
    ↓
Core Scoring (Token Relevance)
    ↓
Signal Enhancement (Authority, Freshness, Click, Language)
    ↓
Optional LTR Reranking (ML-based)
    ↓
Final Ranking (Sort & Return)
```

### Core Scoring Function: `compute_score()`

**Location:** [backend-django/core/services/search_service.py](backend-django/core/services/search_service.py#L1195)

**Scoring Approach:** Token-based relevance with field-weighted matching

```python
def compute_score(doc: dict, tokens: list[str], raw_query: str = "") -> int:
    # Multi-field relevance scoring
    score = 0

    # For each query token, score against different document fields
    for token in expanded_tokens:
        # Title: Most important (exact=6, prefix=3, fuzzy=2, substring=1)
        score += _score_token_against_field(token, title_tokens,
                                            exact=6, prefix=3, substring=1, fuzzy=2)
        # Tags: High importance (exact=4, prefix=2, fuzzy=1)
        score += _score_token_against_field(token, tags,
                                            exact=4, prefix=2, substring=1, fuzzy=1)
        # Summary: Medium (exact=3, prefix=1, fuzzy=1)
        score += _score_token_against_field(token, summary_tokens,
                                            exact=3, prefix=1, substring=0, fuzzy=1)
        # Category & URL: Lower (exact=2, prefix=1)
        score += _score_token_against_field(token, category_tokens,
                                            exact=2, prefix=1, substring=0, fuzzy=0)
        score += _score_token_against_field(token, url_tokens,
                                            exact=2, prefix=1, substring=0, fuzzy=0)
```

### Scoring Components

The final ranking score is composed of:

```
total_score = base_relevance_score
            + quality_bonus                    # 0-10 (quality_score/10)
            + freshness_bonus                  # 0-4 (based on fetch date)
            + language_bonus                   # 0-3 (query language match)
            + authority_bonus                  # 0-3 (source authority)
            + click_boost                      # 0-10 (CTR signal)
```

---

## 2. Data Structures for Scoring

### Search Index (JSON-based)

**Location:** [data/search-index.json](data/search-index.json)

**Document Structure:**

```json
{
  "id": "doc-95",
  "title": "Airbnb Travel Accommodation",
  "url": "https://www.airbnb.com/",
  "summary": "Online marketplace for short-term home rentals...",
  "tags": ["travel", "accommodation", "rental", "vacation"],
  "category": "Travel",
  "sourceName": "airbnb.com",
  "sourceSlug": "airbnb-com",
  "language": "en",
  "qualityScore": 81,
  "fetchedAt": "2026-02-16T17:45:51.522Z",
  "freshnessScore": 73
}
```

**Available Metadata for Ranking:**

- `title` - Highest weighted field
- `summary` - Main content representation
- `tags` - Categorical signals
- `category` - Content classification
- `url` - Domain/path signals
- `qualityScore` - Document quality (0-100)
- `language` - Language identifier
- `fetchedAt` - Freshness signal
- `freshnessScore` - Computed freshness metric

### Database Model: SearchDocument

**Location:** [backend-django/core/models.py](backend-django/core/models.py#L94)

```python
class SearchDocument(models.Model):
    source = ForeignKey(SearchSource)        # Authority source
    url = URLField(unique=True)              # Document URL
    title = CharField(max_length=300)        # Display title
    summary = TextField()                    # Content summary
    content = TextField()                    # Full content (not ranked)
    language = CharField(max_length=16)      # Language code
    category = CharField(max_length=64)      # Content category
    tags = JSONField()                       # Categorical tags
    quality_score = FloatField(default=0)    # Quality metric (0-100)
    content_hash = CharField(max_length=64)  # Deduplication
    fetched_at = DateTimeField()             # Freshness signal
    indexed_at = DateTimeField()             # Indexing timestamp

    class Meta:
        ordering = ["-quality_score", "title"]
```

### SearchSource (Authority)

```python
class SearchSource(models.Model):
    slug = SlugField()
    name = CharField()
    quality_score = FloatField()             # Authority score (0-100)
    category_hint = CharField()              # Default category
    language_hint = CharField()              # Default language
```

---

## 3. Key Files and Functions

### Core Ranking Pipeline

| File                                                                      | Function                    | Purpose                   |
| ------------------------------------------------------------------------- | --------------------------- | ------------------------- |
| [search_service.py](backend-django/core/services/search_service.py)       | `run_search_page()`         | Main search entry point   |
| [search_service.py](backend-django/core/services/search_service.py#L1195) | `compute_score()`           | Token relevance scoring   |
| [search_service.py](backend-django/core/services/search_service.py#L1274) | `_run_db_search()`          | Database search execution |
| [search_service.py](backend-django/core/services/search_service.py#L1357) | `_run_local_index_search()` | JSON index search         |
| [search_service.py](backend-django/core/services/search_service.py)       | `_get_result_click_boost()` | Click signal aggregation  |

### Query Processing

| Function                       | Purpose                               |
| ------------------------------ | ------------------------------------- |
| `_apply_query_rewrite_rules()` | Typo correction & synonyms            |
| `_parse_search_operators()`    | Extract site:, filetype:, etc.        |
| `_suggest_query_correction()`  | Spelling suggestions (Levenshtein)    |
| `tokenize()`                   | Text normalization & stopword removal |
| `_expand_query_tokens()`       | Synonym expansion, stemming           |
| `detect_query_language()`      | Language detection (EN/RO)            |

### Signal Functions

| Function                      | Purpose               | Range  |
| ----------------------------- | --------------------- | ------ |
| `_document_freshness_bonus()` | Document age signal   | 0-4    |
| `_source_authority_bonus()`   | Source quality signal | 0-3.0  |
| `_get_result_click_boost()`   | CTR-weighted boost    | 0-10.0 |

---

## 4. Current Ranking Features (Scoring Factors)

### A. Lexical Relevance (60-70% of score)

**Function:** `compute_score()` → `_score_token_against_field()`

**Token Matching Types:**

1. **Exact match** - Token exactly matches field token
   - Title: +6 points
   - Tags: +4 points
   - Summary: +3 points
   - Category/URL: +2 points

2. **Prefix match** - Field token starts with query token
   - Title: +3 points
   - Tags: +2 points
   - Summary: +1 point

3. **Fuzzy match** - One edit distance away (Levenshtein)
   - Title: +2 points
   - Tags: +1 point
   - Summary: +1 point

4. **Substring match** - Query token contained in field
   - Title: +1 point
   - Tags: +1 point

5. **Phrase matching** - Raw query as substring
   - In title: +8 bonus
   - In summary: +4 bonus

6. **Multi-token bonus** - All tokens appear in title prefix
   - +5 bonus

**Query Expansion:**

- Synonym mapping (e.g., "ai" → "artificial intelligence")
- Stemming (e.g., "running" → "run")
- Morphological variants (e.g., plural to singular)

### B. Source Authority (5-10% of score)

**Location:** [search_ranking_config_service.py](backend-django/core/services/search_ranking_config_service.py)

**Authority Boosts by Domain:**

- High Authority (6x): arxiv.org, developer.mozilla.org, docs.python.org, github.com, nature.com, learn.microsoft.com, pubmed.ncbi.nlm.nih.gov
- Medium-High (5x): nodejs.org, pytorch.org, python.org, react.dev, reuters.com
- Medium (4x): bbc.com, github.com, openai.com, stackoverflow.com, wikipedia.org
- Lower (3x): kaggle.com, theguardian.com

**Calculation:**

```python
authority_bonus = (source.quality_score / 100.0) * 3.0
```

This bounds authority influence so lexical relevance remains primary factor.

**Configuration File:** [data/search-ranking-config.json](data/search-ranking-config.json)

### C. Freshness Bonus (0-4 points)

```python
def _document_freshness_bonus(document):
    if fetched_at >= now - 3 days:   return 4
    if fetched_at >= now - 14 days:  return 2
    if fetched_at >= now - 45 days:  return 1
    return 0
```

### D. Language Match (0-3 points)

```python
language_bonus = 3 if doc_language == query_language else 0
```

- Detects Romanian (ă, â, î, ș, ț) vs English automatically

### E. Click-Through Rate (CTR) Signal (0-10.0 points)

**Location:** [search_service.py](backend-django/core/services/search_service.py#L530) - `_get_result_click_boost()`

**Data Source:** [data/analytics.json](data/analytics.json) → `resultClicks` array

**Signals Combined:**

```python
pair_boost = log2(1 + exact_pair_clicks) * 2.5      # Query-URL pair clicks
url_boost = log2(1 + url_clicks) * 0.8              # URL popularity
ctr_boost = (exact_pair_clicks / query_clicks) * 3.0 # CTR percentage
```

**Guardrails:**

- Only applied if base_score >= 12.0 (minimum quality threshold)
- Click boost capped at 30% of base score
- Maximum boost: 10.0 points
- Decay: Exponential halflife of 14 days

**Window:** Last 30 days of click data

---

## 5. Personalization Currently Stored

### Current State: **Limited/No Persistent Personalization**

The system has infrastructure for future personalization but minimal current implementation:

### What IS Being Tracked:

1. **Analytics (IP/User-based, not persistent):**
   - Search queries and timestamps
   - Click events (URL, query, time)
   - Dwell times on results
   - Reformulation chains
   - A/B test variant assignment

   **Storage:** [data/analytics.json](data/analytics.json)

2. **Assistant Conversation Memory (Chat-based):**
   - Chat messages and responses
   - Provider used (OpenAI, local-hybrid)
   - Timestamp and IP

   **Storage:** [data/assistant-memory.json](data/assistant-memory.json)

3. **A/B Test Variant Assignment (per session):**
   - User ID → Variant mapping (control/treatment)
   - Deterministic hashing ensures consistency

   **Storage:** [data/ab-test-state.json](data/ab-test-state.json)

### What is NOT Being Persisted:

- ❌ User profiles or long-term preferences
- ❌ Search history tied to user ID
- ❌ Topic interests or intent models
- ❌ Personalized ranking weights per user
- ❌ User feedback (ratings, flags)

### Architecture for Future Personalization:

**Ready-to-extend hooks:**

```python
def run_search_page(query, user_id=""):
    # LTR ranking considers user_id for A/B testing
    if user_id and _should_use_ltr_ranking(user_id):
        all_results = _apply_ltr_ranking_adjustment(all_results, model, query)
```

**Future expansion points:**

- Store user interaction history in DB
- Extract topic interests from search patterns
- Implement user preference vectors
- Apply collaborative filtering
- Build user-specific ranking models

---

## 6. Search Index Structure

### Index Organization

**Format:** JSON array of document objects
**Location:** [data/search-index.json](data/search-index.json)
**Size:** ~10,000-100,000 documents
**Update Frequency:** Crawler-driven (async crawl runs)

### Metadata Available for Ranking

| Field            | Type       | Used In                         | Purpose                        |
| ---------------- | ---------- | ------------------------------- | ------------------------------ |
| `id`             | string     | Dedup                           | Unique identifier              |
| `title`          | string     | Title field scoring (weight: 6) | Primary relevance signal       |
| `url`            | string     | URL field scoring, operators    | Domain authority, path signals |
| `summary`        | string     | Summary scoring (weight: 3)     | Content relevance              |
| `tags`           | array      | Tag field scoring (weight: 4)   | Category signals               |
| `category`       | string     | Category scoring, filtering     | Content type classification    |
| `sourceName`     | string     | Filtering, facets               | Source name (human-readable)   |
| `sourceSlug`     | string     | Filtering, facets               | Source slug (normalized)       |
| `language`       | string     | Language filtering, bonus       | Language match signal          |
| `qualityScore`   | float      | Not currently used in ranking   | Future quality ranking factor  |
| `fetchedAt`      | ISO string | Freshness scoring               | Document recency               |
| `freshnessScore` | float      | Not currently used              | Pre-computed freshness         |

### Search Execution Path

```
Query →
  1. DB Search (preferred if populated)
     - SearchDocument ORM query with relationships
     - 1200 documents fetched by quality_score
     - Filtered by language/category/source
     - Scored and ranked
  ↓ (if no DB results)
  2. Local Index Search (fallback)
     - JSON file parsing
     - Same scoring algorithm
     - Same filtering logic
```

### Index Metadata Not Currently Leveraged

- `qualityScore` - Could weight documents (currently ignored during search)
- `freshnessScore` - Pre-computed metric (freshness_bonus computed on-the-fly)
- Full `content` field (in DB model) - Never used for ranking

---

## 7. Learning-to-Rank (LTR) System

### Architecture

**Status:** Production-ready but optional (A/B tested)

**Location:**

- Model trainer: [backend-django/core/services/ltr_model_trainer.py](backend-django/core/services/ltr_model_trainer.py)
- Training pipeline: [backend-django/core/services/ltr_training_pipeline.py](backend-django/core/services/ltr_training_pipeline.py)
- Integration: [backend-django/core/services/search_service.py](backend-django/core/services/search_service.py#L195)

### Features Tracked for LTR

**Collected Features:**

```python
LTR_FEATURES_TO_TRACK = [
    "query_length",         # Number of query tokens
    "has_operators",        # Whether query has site: etc.
    "result_count",         # Total results for query
    "click_count",          # Clicks on this result
    "ctr_signal",           # Click-through rate
    "doc_position",         # Position in original ranking
    "doc_score",            # Base relevance score
    "dwell_time_ms",        # Time spent on clicked result
]
```

**Data Collection:**

```python
def _collect_ltr_training_sample(query, doc_url, doc_score, position, clicked, dwell_time_ms):
    # Collected after user interaction
    features = {
        "query_length": len(tokenize(query)),
        "has_operators": bool(parse_search_operators(query)[1].get("sites")),
        "doc_score": float(doc_score),
        "position": int(position),
        "dwell_time_ms": int(dwell_time_ms),
    }
    label = 1 if clicked else 0  # Relevant vs. not relevant

    # Stored in cache (TTL: 2 hours, min samples: 1000)
    _ltr_feature_cache["training_samples"].append({
        "features": features,
        "label": label,
        "timestamp": now
    })
```

### Training & Deployment

**Training Trigger:**

- Minimum 1000 interaction samples collected
- Model refreshes weekly (if older than 7 days)
- Command: `train_ltr_model_from_collected_data()`

**Model Storage:** [data/ltr-model.json](data/ltr-model.json) (versioned)

**Deployment Strategy:** Canary rollout with A/B testing

- Control: Traditional ranking (60% traffic)
- Treatment: LTR-enhanced ranking (40% traffic)
- Monitoring: NDCG@5, MAP (Mean Average Precision)
- Rollout: Gradual increase if metrics improve
- Rollback: Automatic if degradation detected

**Metrics Tracked:**

```python
class ModelMetrics:
    ndcg_5: float              # Ranking quality (top 5)
    map_score: float           # Mean Average Precision
    positive_ratio: float      # Label distribution
    training_duration_seconds: float
    inference_latency_ms: float
```

---

## 8. Query Analysis & Intent Detection

### Query Operators (Advanced Search)

**Supported Operators:**

```
site:domain.com          - Limit to specific domain
-site:domain.com         - Exclude domain
filetype:pdf             - Filter by file type
inurl:keyword            - Match in URL
intitle:keyword          - Match in title
```

**Parsing:** [search_service.py](backend-django/core/services/search_service.py#L750) - `_parse_search_operators()`

### Query Rewriting

**Location:** [data/query-rewrite-rules.json](data/query-rewrite-rules.json)

**Default Rules:**

```python
DEFAULT_QUERY_REWRITE_RULES = [
    {"enabled": True, "matchType": "exact", "from": "pythn", "to": "python"},
    {"enabled": True, "matchType": "exact", "from": "opnai", "to": "openai"},
]
```

**Match Types:**

- `exact` - Exact token match
- `contains` - Substring match

### Query Correction & Suggestions

**Spelling Correction:**

- Algorithm: Bounded Levenshtein distance
- Adaptive thresholds:
  - ≤4 chars: distance ≤1 (strict)
  - 5-8 chars: distance ≤2 (balanced)
  - > 8 chars: distance ≤3 (generous)
- Vocabulary built from index (1-hour cache)

**Related Queries:**

- Based on analytics (search history)
- Session-based context (same IP, 10-min window)
- Reformulation chains tracked

**Query Expansion:** [search_service.py](backend-django/core/services/search_service.py#L366) - `_expand_query_tokens()`

```python
QUERY_SYNONYMS = {
    "ai": ["artificial", "intelligence", "machine", "learning", "llm"],
    "ml": ["machine", "learning"],
    "js": ["javascript"],
    # ... more mappings
}
```

### Language Detection

**Supported Languages:** English (en), Romanian (ro)

**Detection Logic:**

1. Check for Romanian diacritics (ă, â, î, ș, ț)
2. Check for Romanian keywords (care, poze, imagini, etc.)
3. Default to English

**Effect:** Language-matched results get +3 bonus

### Semantic Fallback (LLM Integration)

**Trigger:** <2 results returned
**Provider:** OpenAI or Anthropic (configurable)
**Purpose:** Generate alternative query suggestions
**Timeout:** 3 seconds
**Graceful Degradation:** Silent failure if LLM unavailable

---

## 9. Architecture for Extending Ranking

### Adding New Ranking Signals

**Pattern 1: Static Signal Function**

```python
def _new_signal_bonus(document: SearchDocument) -> float:
    # Extract signal from document
    # Return bonus value (0.0 - X)
    pass

# Then integrate in _run_db_search():
total_score = (
    score
    + quality_bonus
    + freshness_bonus
    + language_bonus
    + authority_bonus
    + click_boost
    + _new_signal_bonus(document)  # ← Add here
)
```

**Pattern 2: LTR Feature**

```python
# 1. Add to LTR_FEATURES_TO_TRACK
LTR_FEATURES_TO_TRACK.append("new_feature_name")

# 2. Collect in _collect_ltr_training_sample()
features["new_feature_name"] = compute_new_feature(query, doc_url)

# 3. Model automatically learns optimal weight
```

### Personalization Integration Points

**User Context:**

```python
def run_search_page(
    query: str,
    user_id: str = "",  # ← Extensible
    language: str = "",
    category: str = "",
    source: str = "",
    # ... future: user_preferences, session_context, etc.
):
```

**Future Enhancement:**

```python
# Per-user model selection
if user_id and user_preferences_loaded:
    user_model = load_personalized_model(user_id)
    results = apply_ltr_with_personalization(results, user_model, query)
```

### Hybrid Search Capability

**Current:** Token-based + Statistical signals
**Next:** Easy to add:

- Dense vector embeddings (semantic search)
- Hybrid BM25 + Dense retrieval
- Cross-encoder reranking
- Multi-stage ranking (fast first-pass, slow second-pass)

**No Lock-in:** Original database/index searchable independently

---

## 10. Summary: Ranking Pipeline Flow

```
User Query
    ↓
┌─────────────────────────────────────┐
│ QUERY PROCESSING                    │
├─────────────────────────────────────┤
│ • Apply rewrite rules               │
│ • Parse operators (site:, etc.)     │
│ • Tokenize & normalize              │
│ • Expand synonyms                   │
│ • Detect language                   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ EXECUTION LAYER                     │
├─────────────────────────────────────┤
│ Try: DB Search (1200 docs by quality)
│      ↓ Fallback: JSON Index Search  │
│ • Apply operator filters            │
│ • Language/category/source filters  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ CORE SCORING                        │
├─────────────────────────────────────┤
│ compute_score(doc, tokens):         │
│ • Exact matches in fields (±6)     │
│ • Prefix/fuzzy matches (±1-3)      │
│ • Phrase matching bonus (±4-8)     │
│ • Multi-token bonus (±5)           │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ SIGNAL ENHANCEMENT                  │
├─────────────────────────────────────┤
│ • Authority bonus (source quality)   │
│ • Freshness bonus (document age)     │
│ • Language bonus (query match)       │
│ • Click boost (user behavior)        │
│ Final = Base + Signal Bonuses       │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ OPTIONAL LTR RERANKING              │
├─────────────────────────────────────┤
│ If: user in treatment variant       │
│ • Extract LTR features              │
│ • Run trained model                 │
│ • Resort by LTR score               │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ FINAL RANKING                       │
├─────────────────────────────────────┤
│ Sort by:                            │
│ • relevance (score desc)            │
│ • newest (fetchedAt desc)           │
│ • quality (qualityScore desc)       │
│ Pagination & Return                 │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ POST-PROCESSING                     │
├─────────────────────────────────────┤
│ • Build facets (language/cat/source)│
│ • Query correction suggestions      │
│ • Related queries                   │
│ • LLM semantic fallback (sparse)    │
└─────────────────────────────────────┘
    ↓
Results JSON Response
```

---

## 11. Configuration & Flexibility

### Ranking Config (JSON)

**File:** [data/search-ranking-config.json](data/search-ranking-config.json)

Editable parameters:

- Coverage thresholds by intent (code, docs, images, news, research, jobs)
- Source authority boosts (24 domains configured)
- Optional query tokens (removable during scoring)

### Environment Settings

- LLM provider (OpenAI/Anthropic)
- Click signal window (30 days configurable)
- LTR training thresholds
- Deployment canary percentages

---

## 12. Performance Considerations

### Caching Strategy

| Cache                  | TTL     | Unit                        |
| ---------------------- | ------- | --------------------------- |
| Click signal artifacts | 30 sec  | Query-URL pairs, aggregates |
| Search vocabulary      | 1 hour  | Token list for corrections  |
| LTR features           | 2 hours | Training samples in memory  |
| Query suggestions      | None    | Computed fresh per request  |

### Database Indexes

```python
indexes = [
    Index(fields=["status", "language"]),
    Index(fields=["source", "status"]),
]
```

### Scale Considerations

- DB search fetches top 1200, scores, then limits output (1200 pre-filter)
- Local index search filters same way (efficient)
- Scoring O(n × m) where n = docs, m = query tokens
- LTR inference: millisecond-level latency

---

## Implementation Notes for Future Development

### Extending Scoring

1. **Non-intrusive:** Add new signal functions returning float bonus
2. **Integrated:** Can inject into the scoring pipeline at multiple stages
3. **A/B testable:** Wrap in variant logic for experimentation

### Personalization Path

1. Store user profiles/preferences in database
2. Add user_id parameter to search functions (already scaffolded)
3. Load user model/preferences in `run_search_page()`
4. Adjust scoring or apply user-specific LTR model
5. Track personalized metrics separately

### Future Directions

- Semantic search integration (dense embeddings)
- Named entity recognition for queries
- Result diversification (reduce duplicate sources)
- Query intent classification (factual vs. navigational vs. informational)
- Zero-shot ranking with LLM cross-encoders
- User feedback loop (explicit ratings → model update)

---

## Appendix: Key File Locations

```
backend-django/
  core/
    models.py                           # SearchDocument, SearchSource
    services/
      search_service.py                 # Core ranking engine (2200+ lines)
      ltr_model_trainer.py              # ML model training
      ltr_training_pipeline.py          # Live training pipeline
      ab_testing.py                     # A/B test management
      search_ranking_config_service.py  # Config normalization
      analytics_service.py              # Click & analytics tracking
      deployment_safeguards.py          # Canary & rollback logic
data/
  search-index.json                     # Local JSON index
  search-ranking-config.json            # Authority boosts, coverage thresholds
  query-rewrite-rules.json              # Typo fixes
  ab-test-state.json                    # A/B test variants
  analytics.json                        # Search clicks & queries
  assistant-memory.json                 # Chat history (not ranking)
  ltr-model.json                        # Trained LTR model
domains/
  search/
    contracts/
      search-ranking-config-response.schema.json  # API schema
```

---

This analysis covers the complete ranking pipeline from query input to result presentation, with clear extension points for future personalization and algorithm improvements.
