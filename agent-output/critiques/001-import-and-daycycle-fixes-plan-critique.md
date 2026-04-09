---
ID: 1
Origin: 1
UUID: 9a47e1a9
Status: CLOSED
---

# Critique: Plan 001 — Import Validation + Day-Cycle Correctness

**Artifact**: [agent-output/planning/001-import-and-daycycle-fixes-plan.md](../planning/001-import-and-daycycle-fixes-plan.md)
**Analysis Reference**: [agent-output/analysis/closed/001-technical-unknowns-analysis.md](../analysis/closed/001-technical-unknowns-analysis.md)
**Architecture Reference**: [agent-output/architecture/001-import-daycycle-architecture-findings.md](../architecture/001-import-daycycle-architecture-findings.md)
**Date**: 2026-04-09
**Status**: APPROVED
**Critic**: critic

## Changelog

| Date | Handoff | Request | Summary |
|------|---------|---------|---------|
| 2026-04-09 | User | Review plan for clarity, completeness, architectural alignment | Initial critique created |
| 2026-04-09 17:20 | User | Confirmed product decisions (půlnoc=A, import=B) | Open questions resolved, all findings addressed, verdict→APPROVED |

---

## Value Statement Assessment

✅ **PRESENT AND CLEAR**

> As a uživatel trackeru chci, aby import záloh byl bezpečný a aby session korektně respektovala hranici dne, so that nepřijdu o historii a denní/týdenní reporty zůstanou důvěryhodné.

- User story format: ✅ (As a / I want / So that)
- Aligns with Epic 1.7.1-A user story: ✅
- Aligns with Master Product Objective (Data integrity + Temporal correctness): ✅

---

## Overview

Plan 001 addresses two P0 bugs (import validation, day-cycle handling) and one already-fixed CSS bug (recovery banner). The plan:
- Has clear scope boundaries (patch release, no new UI)
- References architecture findings explicitly (ARCH-001)
- Embeds architecture MUST constraints directly into the plan
- Uses a decision gate pattern for blocking product decisions
- Includes deliverables for observability/telemetry

**Overall impression**: Well-structured, appropriately scoped patch plan with explicit architectural guardrails.

---

## Architectural Alignment

✅ **FULLY ALIGNED**

| ARCH-001 Requirement | Plan Coverage | Evidence |
|----------------------|---------------|----------|
| R1: Import fail-closed + atomic | ✅ | Architecture Constraints #1, Step 2 tasks |
| R2: Day-cycle init checkpoint | ✅ | Architecture Constraints #2, Step 3 tasks |
| R3: Product rule for midnight | ✅ | Architecture Constraints #3, Step 1 decision gate |
| R4: Observability minimum | ✅ | Architecture Constraints #4, Deliverable #5, Steps 2/3 tasks |

The plan correctly embeds all four MUST requirements from ARCH-001 and traces them to specific tasks/deliverables.

---

## Scope Assessment

✅ **APPROPRIATE**

**In-scope items are minimal and necessary:**
- Import validation (Bug #1)
- Day-cycle init checkpoint (Bug #2)
- CSS verification (Bug #3 — already fixed)
- Test updates
- Version bump

**Out-of-scope exclusions are reasonable:**
- No new UI
- No data model changes beyond minimum
- No test infra rewrite

**Risk**: None identified. Scope is tight and appropriate for a patch release.

---

## Technical Debt Risks

| Risk | Severity | Mitigation in Plan |
|------|----------|-------------------|
| `app.js` monolith | Low | Plan doesn't increase complexity; adds small utilities at boundaries |
| CSS utility override pattern | Low | Bug #3 fix applied; pattern risk noted but out of scope |
| Timer-only day-cycle | Medium | **Addressed** — init checkpoint added |
| Fail-open import | High | **Addressed** — atomic + fail-closed validation |

No new debt introduced. Two existing debt items are directly addressed.

---

## Findings

### Critical

*None.*

### Medium

| Issue | Status | Description | Impact | Recommendation |
|-------|--------|-------------|--------|----------------|
| M1: Test AC for day-cycle variants | ✅ RESOLVED | Step 3 AC says "projde dle zvoleného pravidla" but doesn't specify how each variant (A/B/C) would be tested differently | Test may pass for wrong reason | Add variant-specific AC: e.g., "If A chosen: entry ends at 23:59:59 of startTs day" — **ADDRESSED in plan revision** |

### Low

| Issue | Status | Description | Impact | Recommendation |
|-------|--------|-------------|--------|----------------|
| L1: Telemetry format not specified | ✅ RESOLVED | Steps 2/3 mention "normal diagnostiku" but don't specify where logs go (console? localStorage? event?) | Implementer ambiguity | Clarify: "console.info for normal; console.debug for debug-mode" — **ADDRESSED in plan revision** |
| L2: Regression test for today's session | ✅ RESOLVED | Step 3 AC mentions "nedojde k regressi" but no explicit test case | Regression could slip through | Add E2E test: "session started today survives reload without stop" — **ADDRESSED in plan revision** |

---

## Unresolved Open Questions

✅ **ALL RESOLVED**

| # | Open Question | Resolution | Blocking? |
|---|---------------|------------|-----------|
| 1 | Varianta A/B/C pro aktivitu přes půlnoc? | **A — Auto-stop** | ~~YES~~ Resolved |
| 2 | Má import vyžadovat wrapper export, nebo tolerovat raw state? | **B — Tolerant** | ~~YES~~ Resolved |

**Both open questions resolved by user on 2026-04-09. Plan is unblocked.**

---

## Risk Assessment

| Risk Category | Level | Notes |
|---------------|-------|-------|
| Ambiguity | ✅ None | Open questions resolved |
| Scope creep | ✅ Low | Clear out-of-scope exclusions |
| Architectural drift | ✅ None | ARCH-001 constraints embedded |
| Regression | ✅ Low | L2 addressed: explicit today-session test AC added |
| Timeline | ✅ Clear | Decision gates resolved, ready for implementation |

---

## Recommendations

1. ~~**BLOCKING**: Resolve the 2 open questions before proceeding to implementation.~~ ✅ DONE
2. ~~**M1**: Add variant-specific acceptance criteria for Step 3 based on chosen rule (A/B/C).~~ ✅ DONE
3. ~~**L1**: Specify telemetry destination (recommend `console.info` for normal, `console.debug` for debug).~~ ✅ DONE

---

## Verdict

**APPROVED** — Plan is ready for implementation.

All blocking open questions have been resolved. All findings (M1, L1, L2) have been addressed in the plan revision. The plan maintains architectural alignment with ARCH-001 and delivers the value statement.
4. **L2**: Add explicit E2E test case: "session started today survives reload".

---

## Verdict

**APPROVED_WITH_CONDITIONS**

The plan is well-structured, architecturally aligned, and appropriately scoped. However, it cannot proceed to implementation until:

1. ✗ Open Question #1 (midnight rule) is resolved → update Plan Step 1, Step 3 AC
2. ✗ Open Question #2 (import policy) is resolved → update Plan Step 1, Step 2 tasks

Once resolved, address M1/L1/L2 findings and re-review before Implementer handoff.

---

## Next Action Required

**User/Product must decide:**
1. Pravidlo pro session přes půlnoc: **A** (auto-stop) / **B** (split) / **C** (carry-over)?
2. Import policy: **A** (wrapper-only) / **B** (tolerant)?

After decisions are recorded, Planner updates the plan, Critic re-reviews, then Implementer proceeds.
