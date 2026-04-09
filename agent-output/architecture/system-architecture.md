---
Status: Current
Last Updated: 2026-04-09
Owner: Architect
---

# System Architecture — Time Tracker

## Changelog

| Date | Change | Rationale | Related |
|------|--------|-----------|---------|
| 2026-04-09 | Initial system architecture doc + diagram | Repo did not have architecture docs; required for Epic 1.7.1-A | Roadmap v1.7.1-A, Plan 001 |
| 2026-04-09 | Reconciled recent fixes (recovery banner CSS) | Architecture docs must reflect implemented reality | Bug #3 |

## Purpose
Single-user time tracking in the browser for a small fixed set of activities (Caroda / AYM / Automatizované testy) with:
- one-click start/stop,
- manual adjustments,
- weekly report,
- safe persistence in localStorage,
- backup export/import.

## High-Level Architecture
The system is a **static web app** running entirely in the browser:
- UI is rendered from in-memory state.
- State is persisted to **localStorage**.
- Backups are produced/consumed as **JSON files** via download/upload.
- E2E tests run via Playwright with a local static server.

### Primary Boundaries
- **Execution boundary**: browser (no backend).
- **Persistence boundary**: localStorage only.
- **Import boundary**: untrusted JSON file input.

## Components

### 1) Presentation (UI)
- Static HTML layout (panels, buttons, forms, tables)
- CSS themes and utility classes
- Dynamic rendering performed in JS

### 2) Domain / State
- `state.active`: running session (`{ activity, startTs }`)
- `state.entries`: completed entries (tracked and manual)

### 3) Persistence
- Save/load to localStorage under a single key.
- Migration/normalization happens at load.

### 4) Import/Export
- Export creates a JSON blob and triggers download.
- Import parses JSON and applies to `state`.

### 5) Reporting
- Daily totals, weekly report, and entry list with filters.

### 6) Test Harness
- Playwright runs E2E against a local web server.

## Runtime Flows

### Start activity
1. User clicks activity.
2. App confirms (overlay or `window.confirm`).
3. If an activity is already active, previous activity is stopped and an entry is created.
4. New `state.active` is set and persisted.

### Stop activity
1. User clicks Stop.
2. App creates an entry from active session.
3. `state.active` becomes null.
4. Persist + re-render.

### Manual add/edit
- Manual entry uses date/time inputs → produces an entry.
- Edit mode reuses manual form; edited tracked entries are flagged.
- Overlap detection is enforced.

### Recovery on reload
- On load, if localStorage contains active session, the app shows a recovery banner.
- User can keep running, stop now (creates entry), or discard.

### Day-cycle
- App checks for day change on a timer near midnight.
- **Architectural risk**: relying solely on timer misses sessions that cross midnight and are reloaded the next day.

### Backup export/import
- Export writes wrapper JSON with `state`.
- Import reads either wrapper or raw state.
- **Architectural risk**: importing is a destructive operation; must be fail-closed + atomic.

## Data Boundaries

### localStorage schema (conceptual)
- Key: `tracker-data-v1`
- Value: `{ active: {activity, startTs} | null, entries: Entry[] }`

### Entry schema (conceptual)
- `id`, `activity`, `startTs`, `endTs`, `durationMs`, `dayKey`, `source`, `createdAt`, `updatedAt`, `editedManually`

### Backup file schema (current)
- Wrapper:
  - `{ app, version, exportedAt, state }`
- Import currently tolerates both wrapper and raw state.

## Dependencies
- Browser APIs: localStorage, Blob/URL download, File input, Date/Intl formatting.
- No backend services.

## Quality Attributes

### Reliability / Data integrity (P0)
- Import MUST not allow invalid input to wipe data.
- Destructive operations MUST be atomic.

### Temporal correctness (P0)
- Entries and reports must reflect the user's lived time.
- Sessions crossing day boundaries must follow a single explicit product rule.

### Usability (P1)
- Minimal friction for start/stop.
- Clear feedback for import/export and validation errors.

### Maintainability (P1)
- `app.js` is a monolith; risk of regressions.
- Prefer clear invariants and small utilities around boundaries (import/day-cycle).

## Observability (Architecture-Level Requirements)
Even without a backend, the app needs consistent diagnostics to make issues debuggable.

### Normal (always-on)
- Import result event: `{ fileName, inputShape, result, errorCategory? }`
- Init/day-cycle event: `{ nowDayKey, activeStartDayKey?, actionTaken }`

### Debug (opt-in)
- Detailed decision logs for import validation and day-cycle decisions (no payload dumps).

## Problem Areas (Design Debt)
1. Import currently behaves "fail-open" if validation is based on normalized output.
2. Day-cycle correctness depends on a timer; missing init checkpoint.
3. CSS utility class `.is-hidden` can be overridden by later component rules (fixed for recovery banner; pattern risk remains).
4. Cross-window DOM checks (`instanceof HTMLElement`) can break in popup windows (already encountered).

## Decisions (ADRs embedded)

### ADR-001: Import must be fail-closed and atomic
- **Context**: Import is destructive and accepts untrusted JSON.
- **Decision**: Validate input shape before normalization; apply state only after full validation passes.
- **Alternatives**: Only accept wrapper format; prompt user with "preview" diff (out of scope).
- **Consequences**: Safer imports; may reject older/hand-edited backups unless explicitly supported.

### ADR-002: Day-cycle behavior requires a single product rule
- **Context**: Sessions can cross midnight; current behavior is ambiguous.
- **Decision**: Product must choose one of: auto-stop / split / carry-over.
- **Consequences**: Affects report correctness and user expectations.

## Roadmap Readiness
Epic v1.7.1-A is **blocked** until:
- product rule for midnight is decided,
- import schema policy is set (wrapper-only vs tolerant).
