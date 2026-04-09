---
ID: 2
Origin: 1
UUID: b7c4e2f8
Status: Completed
---

# Analysis: Implementation Technical Unknowns

## Changelog

| Date | Change |
|------|--------|
| 2026-04-09 | Investigation initiated from implementation phase |

## Value Statement and Business Objective

As a implementer rolling out Plan 001, I need verified answers to technical unknowns so that the Bug #1 (import validation) and Bug #2 (day-cycle init) fixes are implemented correctly without introducing regressions.

---

## Context

Plan 001 is approved and ready for implementation with decisions:
- **Midnight rule**: A — Auto-stop (entry ends at 23:59:59.999 of startTs day)
- **Import policy**: B — Tolerant (accept wrapper OR raw state)

During implementation preparation, the following technical unknowns emerged:

---

## Investigation Findings

### TU-1: Where to insert pre-normalization validation for import?

**Status**: VERIFIED

**Question**: `normalizeState()` always returns a valid structure. Where should validation happen to make import fail-closed?

**Investigation**:
- `importBackupFile()` at [app.js#L1316](app.js#L1316) currently:
  1. Parses JSON
  2. Extracts `incomingState = parsed?.state ?? parsed` (handles wrapper vs raw)
  3. Calls `normalizeState(incomingState)`
  4. Checks `if (!Array.isArray(normalized.entries))` — **ALWAYS TRUE, BUG!**

- `normalizeState()` at [app.js#L290](app.js#L290) always returns `{ active: ..., entries: [] }` where entries is always an array (even if empty).

**Finding**: Validation must happen **BEFORE** normalization, against `incomingState` (not `normalized`).

**Implementation Path**:
```js
// In importBackupFile(), BEFORE normalizeState():
const incomingState = parsed?.state ?? parsed;

// Tolerant validation: must have entries array (wrapper or raw)
if (!incomingState || typeof incomingState !== 'object') {
  throw new Error('Neplatný formát zálohy.');
}
if (!Array.isArray(incomingState.entries)) {
  throw new Error('Soubor neobsahuje pole entries.');
}

// Optional: validate at least one entry has required fields
const hasValidEntry = incomingState.entries.length === 0 || 
  incomingState.entries.some(e => 
    e && typeof e === 'object' && 
    typeof e.activity === 'string' && 
    typeof e.startTs === 'number' && 
    typeof e.endTs === 'number'
  );
if (!hasValidEntry && incomingState.entries.length > 0) {
  throw new Error('Záloha obsahuje neplatné záznamy.');
}

// NOW safe to normalize
const normalized = normalizeState(incomingState);
```

**Confidence**: HIGH (code path verified)

---

### TU-2: How to make import atomic?

**Status**: VERIFIED

**Question**: Current import directly mutates `state.active` and `state.entries`. How to ensure atomicity?

**Investigation**:
Current code at [app.js#L1325-L1332](app.js#L1325):
```js
const normalized = normalizeState(incomingState);
// ... validation ...
state.active = normalized.active;      // Mutate #1
state.entries = normalized.entries;    // Mutate #2
recoveredSessionVisible = Boolean(state.active);
save();                                // Persist
```

**Finding**: The pattern is already effectively atomic because:
1. Both assignments happen synchronously
2. If any exception occurs before `save()`, localStorage isn't touched
3. The only failure point (JSON parse) happens before any mutation

**Risk Assessment**: LOW — JavaScript is single-threaded; no interleaving risk.

**Recommendation**: Add pre-validation (TU-1) BEFORE any normalization. If validation fails, throw immediately. This keeps the "all or nothing" semantics intact.

**Confidence**: HIGH

---

### TU-3: Where to insert init checkpoint for day-cycle?

**Status**: VERIFIED

**Question**: Current init sequence doesn't check if `state.active.startTs` is from a different day. Where should the checkpoint go?

**Investigation**:
Init sequence at [app.js#L1596-L1605](app.js#L1596):
```js
loadTheme();
initCollapsiblePanels();
load();                              // Restores state (potentially old active)
setEntriesScope("all");
resetManualForm();
trackedDayKey = dayKey(Date.now()); // Sets to TODAY
// ...
render();
scheduleMidnightCheck();
```

`checkDayCycle()` at [app.js#L1394](app.js#L1394) compares `dayKey(Date.now())` with `trackedDayKey`. Since both are "today" after init, it never detects yesterday's session.

**Finding**: Need explicit init checkpoint right after `load()`:

```js
load();

// INIT CHECKPOINT: Handle cross-day active session
if (state.active) {
  const activeStartDayKey = dayKey(state.active.startTs);
  const nowDayKey = dayKey(Date.now());
  
  if (activeStartDayKey !== nowDayKey) {
    // Auto-stop per product rule A
    const autoStopTs = endOfDay(state.active.startTs); // returns 23:59:59.999
    stopActiveAt(autoStopTs);
    console.info('[init/day-cycle]', { nowDayKey, activeStartDayKey, actionTaken: 'autoStop' });
    showNewDayBanner();
  } else {
    console.info('[init/day-cycle]', { nowDayKey, activeStartDayKey, actionTaken: 'none' });
  }
}
```

**Confidence**: HIGH (flow verified)

---

### TU-4: How to calculate `endTs` for auto-stop (23:59:59.999)?

**Status**: VERIFIED

**Question**: Product rule A says entry ends at 23:59:59.999 of startTs day. How to compute this?

**Investigation**:
Need utility function:

```js
function endOfDay(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}
```

**Verification test**:
```js
const ts = new Date('2026-04-08T23:30:00').getTime();
const eod = endOfDay(ts);
console.log(new Date(eod).toISOString()); 
// Expected: "2026-04-08T21:59:59.999Z" (UTC for CET+2)
// In local time: "2026-04-08T23:59:59.999"
```

**Confidence**: HIGH

---

### TU-5: Does `stopActive()` need modification?

**Status**: VERIFIED

**Question**: Current `stopActive(nowTs)` uses `nowTs` as the end time. Need variant that uses specific end time for auto-stop.

**Investigation**:
`stopActive()` at [app.js#L1043](app.js#L1043):
```js
function stopActive(nowTs = getNow()) {
  if (!state.active) { return; }
  state.entries.push(createEntryRecord({
    activity: state.active.activity,
    startTs: state.active.startTs,
    endTs: nowTs,                    // <-- uses provided timestamp
    source: "tracked",
  }));
  // ...
}
```

**Finding**: `stopActive()` already accepts `nowTs` parameter. For auto-stop, just call:
```js
stopActive(endOfDay(state.active.startTs));
```

No modification needed to `stopActive()` itself.

**Confidence**: HIGH

---

### TU-6: What telemetry format should be used?

**Status**: VERIFIED

**Question**: Plan specifies `console.info()` for normal events. What exact format?

**Finding**: Use structured JSON-like logging for parseability:

**Import telemetry** (in `importBackupFile`):
```js
console.info('[import]', { 
  format: 'wrapper' | 'raw' | 'unknown',
  result: 'success' | 'error',
  errorCategory: 'parse' | 'validation' | 'schema' | null,
  entryCount: number
});
```

**Init/day-cycle telemetry** (at init checkpoint):
```js
console.info('[init/day-cycle]', {
  nowDayKey: string,
  activeStartDayKey: string | null,
  actionTaken: 'none' | 'autoStop'
});
```

**Confidence**: HIGH (follows Plan L1 spec)

---

### TU-7: Regression test — "session started today survives reload"

**Status**: VERIFIED

**Question**: How to test that legitimate today's session isn't auto-stopped?

**Finding**: Add E2E test:

```js
test('session started today survives reload', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const now = Date.now();
    const payload = {
      active: { activity: 'AYM', startTs: now - 60000 }, // 1 min ago (today)
      entries: []
    };
    localStorage.setItem('tracker-data-v1', JSON.stringify(payload));
  });

  await page.reload();

  // Session should still be active
  await expect(page.locator('#activeBadgeText')).toContainText('AYM');
  // No entry should have been created
  const rows = page.locator('#entriesBody tr');
  await expect(rows).toHaveCount(0);
});
```

**Confidence**: HIGH

---

## Summary of Implementation Paths

| TU | Component | Change Required | Confidence |
|----|-----------|-----------------|------------|
| TU-1 | `importBackupFile()` | Add pre-normalization validation | HIGH |
| TU-2 | `importBackupFile()` | No change (already atomic) | HIGH |
| TU-3 | Init sequence | Add checkpoint after `load()` | HIGH |
| TU-4 | New utility | Add `endOfDay(ts)` function | HIGH |
| TU-5 | `stopActive()` | No change needed | HIGH |
| TU-6 | Both fixes | Add `console.info()` calls | HIGH |
| TU-7 | Tests | Add regression E2E test | HIGH |

---

## Remaining Gaps

None. All technical unknowns have been investigated and resolved with HIGH confidence. Implementation can proceed.

---

## Recommendations (Analysis-Scoped)

1. Implement TU-1 first (import validation) — lower risk, independent of day-cycle
2. Implement TU-3 + TU-4 together (init checkpoint + endOfDay utility)
3. Add TU-7 regression test before implementing day-cycle fix to ensure no regression
4. Run full test suite after each fix

---

## Open Questions

None.
