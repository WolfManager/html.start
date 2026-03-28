# Project Closure Plan

Status: Active execution plan
Start date: 2026-03-28
Baseline: [BASELINE_STABLE_2026-03-28.md](BASELINE_STABLE_2026-03-28.md)

## Objective

Close MAGNETO professionally by moving from stable operation to finished product quality.

Sequence:

1. freeze baseline
2. finalize search
3. finalize chatbot
4. close UX gaps
5. operational hardening
6. final documentation
7. definition of done

## Stage 1 — Freeze Stable Baseline

Goal:

- define the official reference version already validated locally

Outputs:

- stable baseline document
- explicit baseline commit
- frozen list of validated gates and runtime assumptions

Success criteria:

- one reference revision exists
- baseline commands are documented
- future work can be compared against the same checkpoint

Status:

- completed on 2026-03-28 with baseline commit `c8ef790`

## Stage 2 — Finalize Search

Status:

- in progress
- final benchmark set defined on 2026-03-28
- refinement backlog documented in `SEARCH_REFINEMENT_NOTES.md`

Goal:

- take the current strong search engine to complete and repeatable product behavior

Work items:

- close remaining long-tail weak spots
- test ambiguous and complex queries
- define final benchmark set
- compare every improvement against baseline

Acceptance criteria:

- benchmark set is explicit and repeatable
- difficult queries produce stable, coherent results
- no regression in parity, gates, or latency envelope

Suggested deliverables:

- final benchmark list
- benchmark result report
- search-specific regression notes
- search refinement backlog

## Stage 3 — Finalize AI Chatbot

Goal:

- move from good fallback behavior to final product behavior

Work items:

- standardize tone and response shape
- improve vague queries and clarification handling
- make small talk predictable
- keep external providers optional, not required

Acceptance criteria:

- fallback is consistent across common prompts
- assistant behavior is explainable and stable
- no runtime surprises in provider/fallback transitions

Suggested deliverables:

- assistant behavior matrix
- fallback tone guide
- chatbot regression prompt set

## Stage 4 — Close UX

Goal:

- remove the remaining signs of an intermediate product

Work items:

- clear status messaging
- clean, understandable errors
- consistent assistant source and API base display
- eliminate behavior perceived as drift or instability
- verify main flows end-to-end

Acceptance criteria:

- major flows are visually and behaviorally coherent
- runtime state is transparent to the user
- no major visible inconsistencies remain

Suggested deliverables:

- UX verification checklist
- issue list with fixed/not-fixed status

## Stage 5 — Operational Hardening

Goal:

- make the system hard to break and easy to validate

Work items:

- mandatory health checks and release gates
- contract and parity validation discipline
- clean config handling and env documentation
- startup, debug, and recovery instructions

Acceptance criteria:

- gates are part of normal workflow
- operational docs are sufficient for restart and recovery
- failure states are understandable and actionable

Suggested deliverables:

- hardening checklist
- release validation checklist

## Stage 6 — Final Project Documentation

Goal:

- turn the project into something maintainable beyond the current author context

Required documentation:

- architecture overview
- local setup guide
- fallback mode and config precedence guide
- test and gate execution guide
- short roadmap for future extensions

Acceptance criteria:

- a new contributor can run and validate the project
- operational assumptions are documented in one place
- no critical project knowledge remains implicit only

## Stage 7 — Definition of Done

Goal:

- define explicit closure conditions so the project can be declared finished

Definition of Done candidates:

- all main flows work without blockers
- major gates are green
- search passes final benchmark set
- chatbot is stable on important scenarios
- no major UX inconsistencies remain
- final documentation is complete
- repo is clean and release/demo ready

Acceptance criteria:

- the closure checklist is explicit
- project status can be judged objectively, not by feeling

## Current Execution Order

Current recommended order:

1. build final search benchmark set
2. standardize chatbot fallback behavior matrix
3. run UX end-to-end verification
4. refresh hardening and docs
5. evaluate against definition of done

## Working Rule

From now on, no optimization should be accepted unless it satisfies one of these:

- improves benchmark quality
- improves assistant stability
- improves UX clarity
- improves operational resilience

and does not break the frozen baseline.
