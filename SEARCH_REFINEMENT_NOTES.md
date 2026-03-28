# Search Refinement Notes

Status: Stage 2 working backlog
Baseline: `c8ef790`
Primary benchmark: [SEARCH_FINAL_BENCHMARK_SET.md](SEARCH_FINAL_BENCHMARK_SET.md)
Reference report: `data/backups/benchmarks/latest-search-final-benchmark.json`

## Purpose

This document tracks the search cases that are already acceptable at a gate level but are not yet strong enough to count as final product quality.

In other words:

- they pass the benchmark
- they do not block release gates
- but they are still candidates for relevance refinement before Stage 2 can be considered closed

## Current Benchmark Snapshot

Latest observed state from the final benchmark:

- total cases: 13
- passed: 13
- failed: 0
- max latency: 142ms
- average latency: 13ms

This means the system is stable.
It does not mean search quality is fully finalized.

## Cases That Still Need Refinement

### 1. Romanian Long-Tail News Drift

Case:

- `ultimele stiri ai azi`

Current top results:

- `OpenAI`
- `Anthropic Claude AI`
- `Hugging Face AI Models`

Why it still needs work:

- the benchmark passes because categories are acceptable and results are non-empty
- but the phrasing suggests a stronger news/today freshness intent than the current top titles express
- current behavior is search-stable, not yet product-final

Refinement target:

- prefer fresher news/media-style results over general AI company pages
- improve “azi” and “stiri” weighting together

Priority:

- high

### 2. Romanian Learning Recall Is Too Thin

Case:

- `curs programare javascript pentru incepatori`

Current top result:

- `Codecademy Learn Coding`

Why it still needs work:

- benchmark passes with 1 result
- result is acceptable, but recall is too shallow for a final search experience
- educational long-tail should usually surface a richer top set, not a single acceptable hit

Refinement target:

- improve recall for Romanian educational queries
- surface multiple beginner-oriented development/education results

Priority:

- high

### 3. Typo Recovery Tail Noise

Case:

- `opnai`

Current top titles include:

- `OpenAI`
- `PubMed Medical Research`
- `Python Official Documentation`

Why it still needs work:

- the first result is correct, so the benchmark passes
- tail results suggest weak query-specific focus after typo recovery
- this is acceptable for stability, but not ideal for perceived quality

Refinement target:

- keep typo recovery win
- reduce unrelated tail leakage after correction or expansion

Priority:

- medium

### 4. Research Ambiguity Still Leans Too Commercial

Case:

- `cercetare ai`

Current top titles include:

- `OpenAI`
- `arXiv Research Papers`
- `Semantic Scholar`

Why it still needs work:

- non-empty and coherent, so benchmark passes
- but research intent could rank research repositories and academic sources ahead of company homepages

Refinement target:

- push research/document sources above brand/company pages for research-intent queries

Priority:

- medium

### 5. Site Operator Recall Is Correct But Thin

Case:

- `ai site:openai.com`

Current result count:

- 1

Why it still needs work:

- operator behavior is correct enough to pass
- but recall is minimal and may feel fragile on neighboring operator queries

Refinement target:

- preserve operator precision
- improve recall where the constrained domain clearly has more relevant documents

Priority:

- low to medium

## Suggested Refinement Order

Recommended order for Stage 2 work:

1. Romanian long-tail news drift
2. Romanian learning recall
3. research ambiguity ranking
4. typo recovery tail cleanup
5. operator recall hardening

## Acceptance Standard For Closing Stage 2

Stage 2 should not be considered complete only because all cases pass.

It should be considered complete when:

- final benchmark remains green
- no critical long-tail case feels obviously off-target
- Romanian long-tail queries feel coherent, not merely non-zero
- typo/operator handling remains accurate without noisy ranking tails
- ambiguous research/news intent is ranked in a more product-natural way

## Working Rule

Every refinement should be judged against both:

1. benchmark stability
2. visible top-result quality

If a change helps one weak case but destabilizes the rest of the benchmark, it should not be accepted.
