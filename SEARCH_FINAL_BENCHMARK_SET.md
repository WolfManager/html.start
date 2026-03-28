# Search Final Benchmark Set

Status: Stage 2 benchmark reference
Baseline comparison point: `c8ef790`
Primary command: `npm.cmd run search:benchmark:final`

## Purpose

This document defines the final benchmark set for search closure work.

It exists to answer one question consistently:

Does a search change make MAGNETO better without regressing the stable baseline?

## Principles

The final search benchmark must be:

- explicit
- repeatable
- product-oriented
- measurable against baseline

The benchmark is not trying to prove theoretical perfection.
It is designed to prove stable product behavior on the important query classes.

## Scope

The benchmark covers these query classes:

- intent queries
- typo recovery
- operator handling
- ambiguous generic queries
- domain-specific technical queries
- Romanian intent queries
- Romanian long-tail queries
- previously problematic zero-result long-tail queries

## Execution

Run:

```powershell
npm.cmd run search:benchmark:final
```

Optional report save:

```powershell
node scripts/search-benchmark-final.js --json --save-report --label=stage2
```

Default saved report path:

- `data/backups/benchmarks/latest-search-final-benchmark.json`

## Final Query Set

### Intent

- `api documentation`
- `remote jobs`

Expected behavior:

- results are non-empty
- categories/titles align with clear user intent

### Typo Recovery

- `opnai`

Expected behavior:

- typo still resolves to OpenAI-related results

### Operators

- `intitle:documentation api`
- `ai site:openai.com`

Expected behavior:

- operators do not break relevance
- top results remain aligned to constrained intent

### Ambiguous Queries

- `news`
- `cercetare ai`

Expected behavior:

- results are coherent and non-empty
- categories remain acceptable for broad user intent

### Domain / Technical

- `database indexing`

Expected behavior:

- technical query surfaces development/database content

### Romanian Intent

- `ultimele stiri`
- `joburi remote`

Expected behavior:

- Romanian intent maps to sensible categories

### Romanian Long-Tail

- `ultimele stiri ai azi`
- `curs programare javascript pentru incepatori`

Expected behavior:

- long-tail phrasing remains non-zero and coherent

### Regression-Critical Long-Tail

- `cum optimizez cautarea full text intr-un site cu ranking personalizat`

Expected behavior:

- must not return zero results
- must preserve the refinement path already fixed in baseline
- `queryCorrection.reason` should remain `zero-results-refinement`

## Pass Criteria

The benchmark is considered healthy when:

- all cases pass
- no case regresses to zero results unexpectedly
- no fixed regression case loses its correction/refinement behavior
- latency remains within practical local expectations

## Comparison Rule Against Baseline

Any search change should be judged on:

1. benchmark pass/fail delta
2. changes in top result quality
3. changes in query correction behavior
4. gate status preservation

If a change improves one narrow case but weakens benchmark stability overall, it should not be accepted.

## Relationship To Existing Validation

This benchmark complements, not replaces:

- `npm.cmd run smoke:local:regression`
- `npm run search:benchmark`
- `npm run search:benchmark:romanian`
- `npm run parity:critical:gate`
- `npm.cmd run release:gate:json`

Use this set as the Stage 2 product-quality benchmark layer.
