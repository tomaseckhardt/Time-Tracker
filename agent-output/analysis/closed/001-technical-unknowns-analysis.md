---
ID: 1
Origin: 1
UUID: 9a47e1a9
Status: Planned
---

## Changelog
| Datum | Změna |
|------|------|
| 2026-04-09 | Analysis převedena na implementační plán (planning ID=1) |

# Technical Unknowns Analysis (Time Tracker)

## Value Statement and Business Objective
Cílem je odstranit nejistoty, které vedou k porušení uživatelských očekávání a riziku ztráty dat:
- Import zálohy nesmí „tiše“ akceptovat nevalidní soubor a přepsat historii.
- Aktivní session nesmí nekorektně přetéct přes změnu dne a rozbít denní/týdenní reporty.

## Objective
Zredukovat „unknowns“ na ověřené příčiny a určit nejrychlejší validační kroky (repro + minimální telemetry), které umožní jednoznačné rozhodnutí o opravě.

## Context
- Aplikace: čisté HTML/CSS/JS, persistence v `localStorage` (`tracker-data-v1`).
- Automatizace: Playwright E2E.
- Stav: většina testů prochází, 2 testy záměrně padají (bug #1 a bug #2).

## Methodology
- Statická inspekce relevantních code-path v `app.js`.
- Reprodukce skrz Playwright testy (headless i headed).
- Klasifikace: Verified vs Hypothesis.

## Findings

### Bug #1 — Invalid backup import incorrectly succeeds
**Verified**

**Symptom (from test run)**
- Import `tests/fixtures/invalid-backup.json` končí statusem success: „Data byla obnovena…“
- Očekávání testu: error class a nezměněná data.

**Code-path evidence**
- `importBackupFile(file)` načte JSON, pak:
  - `incomingState = parsed?.state ?? parsed`
  - `normalized = normalizeState(incomingState)`
  - validace: `if (!Array.isArray(normalized.entries)) throw ...`
- `normalizeState(rawState)` vždy vrací `{ active, entries }` a `entries` je vždy pole (fallback `[]` když vstup nemá `entries` pole).

**Determinace**
- Validace v `importBackupFile` je neúčinná (prakticky nikdy nevyhodí chybu jen na základě struktury), protože testuje *normalizovaný* výstup, nikoli původní vstup.

**Risk mechanism**
- Nevalidní JSON (např. `{ "foo": "bar" }`) se normalizuje na prázdný stav (`entries: []`) a přepíše existující historii.

**Fastest disconfirming test**
- Přidat debug log/telemetry (viz níže) a potvrdit, že `incomingState` nemá `entries` pole, ale import přesto projde success větví.

---

### Bug #2 — Active session started yesterday is not auto-stopped on load
**Verified**

**Symptom (from test run)**
- Při reloadu se stav s `active.startTs` „včera“ natransformuje na „žádné záznamy“ (nevznikne včerejší entry) a session zůstane v aktivním stavu.

**Code-path evidence**
- `checkDayCycle()` porovnává `dayKey(Date.now())` s `trackedDayKey` a stopne aktivitu jen při změně.
- `trackedDayKey` je při startu skriptu inicializován na `dayKey(Date.now())`.
- Po `load()` se během init sekvence znovu nastaví `trackedDayKey = dayKey(Date.now())`.
- `checkDayCycle()` je volán jen v `scheduleMidnightCheck()` (časované spuštění), nikoli bezprostředně po `load()`.

**Determinace**
- Po načtení stránky v „nový den“ nemá aplikace žádný okamžitý kontrolní bod, který by detekoval, že `state.active.startTs` patří jinému dni.

**Fastest disconfirming test**
- Vložit instrumentaci (console log) do init flow: hodnoty `trackedDayKey`, `dayKey(state.active.startTs)` a `dayKey(Date.now())` a potvrdit, že se nikdy nevyvolá stop při init.

---

### Bug #3 — Recovery banner CSS hide/show mismatch
**Verified (root cause & fix already applied in repo)**

**Symptom**
- JS přepíná třídu `is-hidden`, ale banner vizuálně zůstává.

**Code-path evidence**
- CSS: `.is-hidden { display:none }` je přebito pozdějším `.session-recovery { display:grid }` (stejná specificita).

**Note**
- Byl aplikován fix: `.session-recovery.is-hidden { display:none }`.

## System Weaknesses
- Import: „fail-open“ normalizace bez explicitní schema validace.
- Lifecycle: day-cycle kontrola závislá na timeru, chybí deterministický init checkpoint.
- UI state: CSS utility třídy (`.is-hidden`) nejsou chráněné před přebitím komponentními styly.

## Instrumentation Gaps

### Normal (always-on, low volume)
- Event při importu: `{ fileName, parsedHasState, incomingHasEntriesArray, incomingEntriesLen, result: success|error, errorMsg? }`.
- Event při load/init: `{ hasActive, activeStartDayKey, nowDayKey, trackedDayKeyAtInit, actionTaken: none|autoStop }`.

### Debug (opt-in)
- Při importu: lognout „shape“ vstupu (bez celého payloadu): typy klíčů, počet entries.
- Při day-cycle: lognout rozhodovací proměnné před/po `checkDayCycle()`.

## Analysis Recommendations (next investigative steps)
1. Repro Bug #1 s existujícími daty v localStorage a invalid JSON importem; potvrdit, že dochází k přepsání na prázdný stav.
2. Doplnit minimální normal telemetry události (viz výše) a ověřit „fail-open“ cestu bez PII.
3. Repro Bug #2 s aktivní session ze včerejška v několika hodinách (ráno/večer) pro ověření, že rozhodnutí je nezávislé na denní době.
4. U Bug #2 ověřit očekávání produktu: má se session vždy uzavřít na hraně dne, nebo se má přenést do nového dne (a jak se to má promítnout do reportů).

## Open Questions
- Jaké je produktové pravidlo pro aktivitu běžící přes půlnoc? (auto-stop vs split vs carry-over)
- Jak přísná má být validace importu? (vyžadovat wrapper `{app, version, exportedAt, state}` nebo akceptovat i čistý `{active, entries}`?)
