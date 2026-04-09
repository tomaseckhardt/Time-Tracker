---
ID: ARCH-001
Origin: Epic 1.7.1-A / Plan 001
UUID: 9a47e1a9
Status: Open
Verdict: APPROVED_WITH_CHANGES
---

# Architecture Findings — Epic 1.7.1-A (Import + Day-Cycle)

## Changelog
| Date | Change |
|------|--------|
| 2026-04-09 | Initial architectural assessment for Epic 1.7.1-A and Plan 001 |

## Context
Epic 1.7.1-A targets two P0 quality attributes:
- **Data integrity** (backup import must not wipe data on invalid input)
- **Temporal correctness** (sessions crossing midnight must be handled deterministically)

Current system is a static browser app with localStorage persistence and JSON file import/export.

## Architectural Fit (Current)
- Import/export boundary is a high-risk trust boundary (untrusted file input).
- Day-cycle logic is a time-based boundary (midnight) and must not depend solely on timers.

## Critical Requirements (MUST)

### R1 — Import must be fail-closed and atomic
- Validate input *shape* before any normalization.
- Do not mutate `state` unless validation passes.
- Treat file input as untrusted; errors must be explicit and safe-by-default.

### R2 — Day-cycle must have an init checkpoint
- On app init after `load()`, compute:
  - `nowDayKey`
  - `activeStartDayKey` (if any)
- If mismatch, apply the chosen product rule deterministically.

### R3 — Product rule for midnight is mandatory
- Must choose exactly one behavior: auto-stop / split / carry-over.
- This decision is an architectural contract: it affects reports and tests.

### R4 — Observability minimum
- Add normal, low-volume events/logs for:
  - import result + error category,
  - init/day-cycle action taken.
- Debug logs are optional but recommended.

## Non-Goals (keep scope tight)
- No new UI pages/wizards.
- No backend service introduction.
- No heavy schema framework; keep validation minimal but strict enough.

## Risks & Failure Modes
- **Fail-open validation**: normalizing before validation can silently convert garbage JSON into empty state.
- **Timer-only day-cycle**: reload on the next day can preserve an outdated `trackedDayKey` and skip auto-stop.
- **Ambiguity**: without a product rule, any fix risks being "wrong".

## Alternatives Considered

### A) Wrapper-only backup format
- **Pros**: simplest validation; future-proofing via `app/version/exportedAt`.
- **Cons**: breaks legacy or user-made raw backups.

### B) Tolerant import (wrapper or raw state) with strict shape checks
- **Pros**: backwards compatible.
- **Cons**: more validation branches.

Recommendation: B, but document allowed formats explicitly.

## Integration Requirements
- Update E2E tests to reflect the chosen midnight rule.
- Ensure report computations use normalized entry data only.

## Verdict
**APPROVED_WITH_CHANGES**

Plan 001 can proceed only after:
1. Product decision on midnight rule is recorded.
2. Import schema policy (wrapper-only vs tolerant) is clarified.
3. The implementation demonstrates atomic import and init day-cycle checkpoint.

## Normal vs Debug Telemetry Guidance

### Normal (always-on)
- `import_backup`: `{ fileName, format: wrapper|raw|unknown, entriesCount?, result: success|error, errorCategory? }`
- `init_day_cycle`: `{ nowDayKey, hasActive, activeStartDayKey?, action: none|autoStop|split|carryOver }`

### Debug (opt-in)
- Decision traces for why a file was rejected (missing keys, wrong types).
- Day-cycle decision variables (`trackedDayKey`, nowKey, startKey).

## Next Actions
- Record the midnight rule decision in the epic (roadmap) and plan.
- Proceed to implementation with the above MUST requirements.
