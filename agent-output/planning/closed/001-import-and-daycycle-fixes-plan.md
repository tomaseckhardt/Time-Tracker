---
ID: 1
Origin: 1
UUID: 9a47e1a9
Status: Active
---

# Implementation Plan: Import Validation + Day-Cycle Correctness

## Plan Header
- **Target Release**: v1.7.1 (patch z aktuální v1.7.0)
- **Epic Alignment**: Epic 1.7.1-A (Roadmap: Bezpečný import + správné zeitgeisty přes hranice dne)
- **Architecture Reference**: ARCH-001 ([agent-output/architecture/001-import-daycycle-architecture-findings.md](../architecture/001-import-daycycle-architecture-findings.md)) + system overview ([agent-output/architecture/system-architecture.md](../architecture/system-architecture.md))
- **Status**: Active (QA complete, ready for UAT)

## Changelog
| Datum | Změna |
|------|------|
| 2026-04-09 | Plan vytvořen z analysis ID=1 |
| 2026-04-09 15:56 | Validated alignment s epic 1.7.1-A (roadmap) — deliverables pokrývají epic AC |
| 2026-04-09 16:03 | Plan revidován dle ARCH-001 (fail-closed import, atomic apply, init day-cycle checkpoint, min telemetry) |
| 2026-04-09 17:20 | Rozhodnutí potvrzena: půlnoc=A (auto-stop), import=B (tolerant). Open questions resolved. Critique findings M1/L1/L2 addressed. Plan ready for implementation. |
| 2026-04-09 17:45 | Implementation complete. Bug #1 + #2 fixed, 27/27 tests pass, version v1.7.1. Awaiting QA. |
| 2026-04-09 18:00 | QA complete: E2E suite 27/27 PASS. Ready for UAT. |

## Value Statement and Business Objective
As a uživatel trackeru chci, aby import záloh byl bezpečný a aby session korektně respektovala hranici dne, so that nepřijdu o historii a denní/týdenní reporty zůstanou důvěryhodné.

## Objective
- Opravit Bug #1 (import invalid backup) tak, aby invalid soubor nikdy nepřepsal existující data a uživatel dostal jasnou chybu.
- Opravit Bug #2 (active session ze včerejška) tak, aby při načtení stránky došlo k deterministické kontrole dne a případnému auto-stop dle produktového pravidla.
- Potvrdit fix Bug #3 (recovery banner hide) vizuálně i testy.

## Scope
**In-scope**
- Validace formátu importu zálohy před aplikací změn stavu.
- Deterministická kontrola změny dne při init (po načtení uloženého stavu).
- Úpravy/rozšíření existujících Playwright E2E testů tak, aby oba bugy přešly z "expected failure" na PASS.
- Patch release aktualizace verzí a release artefaktů.

**Out-of-scope**
- Přidávání nových UI obrazovek / wizardů.
- Změna data modelu entries mimo minimum nutné pro fix.
- Přepis test infrastruktury.

## Assumptions
- Semver: bugfix release je patch → v1.7.1.
- Import může akceptovat buď wrapper export (`{app, version, exportedAt, state}`) nebo raw state (`{active, entries}`), ale vždy musí splnit minimální schema.

## Architecture Constraints (MUST)
Vše níže je povinné dle ARCH-001 (architektonický kontrakt pro Epic 1.7.1-A).

1. **Import je fail-closed a atomický**
  - Validovat tvar vstupu před normalizací.
  - Při chybě se `state` ani localStorage nesmí změnit.
2. **Day-cycle má init checkpoint**
  - Po `load()` deterministicky rozhodnout, co dělat, když `active.startTs` patří do jiného dne.
  - Nesmí spoléhat pouze na timer kolem půlnoci.
3. **Pravidlo pro půlnoc je explicitní product decision**
  - Auto-stop / split / carry-over (jedna varianta).
4. **Minimální observability**
  - Normal (always-on) log/event pro import výsledek a init/day-cycle akci.

## Deliverables
1. Import záloh odmítne nevalidní JSON (nepřepíše data), zobrazí error status.
2. Init flow provede day-cycle check a dle pravidla ukončí/splitne/přenese aktivitu.
3. E2E: `npx playwright test` prochází 26/26.
4. Release artefakty aktualizované na v1.7.1 (verze v UI + export metadata + changelog/README pokud existuje verze).
5. Minimální diagnostika (import + init/day-cycle) umožní rychlou podporu bez leaknutí dat.

## Plan

### 1) Confirm product rules (decision gate) ✅ RESOLVED
**Owner**: User/Product
- Rozhodnout pravidlo pro aktivitu přes půlnoc:
  - **A) Auto-stop na hranici dne** ✅ ZVOLENO
  - ~~B) Split na 2 entries (do půlnoci + od půlnoci)~~
  - ~~C) Carry-over do nového dne (reporty to musí umět)~~

- Rozhodnout import policy:
  - ~~A) Wrapper-only (vyžadovat `{app, version, exportedAt, state}`)~~
  - **B) Tolerant (akceptovat wrapper i raw state `{active, entries}`)** ✅ ZVOLENO

**Acceptance Criteria** ✅
- Jednoznačně zvolená varianta pro půlnoc: **A (auto-stop)**.
- Jednoznačně zvolená import policy: **B (tolerant)**.

### 2) Fix Bug #1: Import validation must fail-closed
**Owner**: Implementer

**Tasks**
- Zaveď minimální schema validaci *před* normalizací (validovat tvar `incomingState` dle decision gate import policy).
- Validuj, že `entries` existuje a je pole (nebo že wrapper má `state.entries` pole) a že položky jsou validovatelné (typy + časová konzistence).
- Zajistit, že import je **atomický**: validace proběhne celá před tím, než dojde k přepsání `state`/localStorage.
- Zajistit, že při chybě importu se `state` nemění (žádné částečné aplikace) a UI zobrazí error.
- Zachovat stávající UX potvrzení "Import nahradí aktuální data...".

- Přidat normal diagnostiku importu (bez dumpu payloadu): format (wrapper/raw/unknown), result (success/error), errorCategory.
- **Telemetry destination**: `console.info()` for normal events, `console.debug()` for debug-level detail.

**Acceptance Criteria**
- Import `tests/fixtures/invalid-backup.json` skončí `dataToolsStatus` v error stavu a původní entries zůstanou.
- Import validní zálohy obnoví data a zobrazí success.
- Import chyby jsou deterministické (stejný soubor → stejný výsledek) a bez side-effectů.

### 3) Fix Bug #2: Deterministic day-cycle handling on init
**Owner**: Implementer

**Tasks**
- Přidat **init checkpoint** po `load()`:
  - vypočítat `nowDayKey` a (pokud existuje) `activeStartDayKey`.
  - pokud se liší, aplikovat zvolenou produktovou variantu (A/B/C) deterministicky.
- Zajistit, že `trackedDayKey` je inicializován konzistentně a nemaskuje změnu dne.

- Přidat normal diagnostiku init/day-cycle: `nowDayKey`, `activeStartDayKey?`, `actionTaken` (none/autoStop).
- **Telemetry destination**: `console.info()` for normal events.

**Acceptance Criteria (Variant A: Auto-stop)**
- E2E scénář „active session started yesterday": entry je ukončena s `endTs` = `23:59:59.999` dne `startTs` (nebo `00:00:00.000` nového dne minus 1ms).
- Po auto-stop není žádná aktivní session.
- Nedojde k regressi: session, která začala dnes, se při reloadu nezastaví (explicitní E2E test).

### 4) Verify Bug #3 fix (CSS)
**Owner**: Implementer

**Tasks**
- Ověřit, že `.session-recovery.is-hidden` skutečně skrývá banner ve všech theme.
- Vrátit recovery testy z class-based workaround zpět na viditelnostní assert (pokud to dává smysl a je stabilní).

**Acceptance Criteria**
- Recovery banner je vizuálně skrytelný a testy jsou stabilní.

### 5) Update tests and validation
**Owner**: Implementer

**Tasks**
- Upravit `tests/tracker.spec.js` tak, aby testy pro Bug #1/#2 nebyly označené jako expected failure (jen běžné PASS očekávání).
- Spustit `npx playwright test` lokálně.

**Acceptance Criteria**
- 26/26 PASS.

### 6) Version management and release artifacts
**Owner**: DevOps/Implementer

**Tasks**
- Zvednout verzi z v1.7.0 → v1.7.1 (UI + export metadata).
- Aktualizovat release poznámky (pokud existuje CHANGELOG; jinak stručná zmínka v README).

**Acceptance Criteria**
- Verze konzistentní napříč aplikací a exportem.

## Risks
- Neujasněné pravidlo přes půlnoc může vést k „správné“ technické opravě, která ale nebude odpovídat očekávání uživatele.
- Příliš striktní schema validace může zablokovat import starších záloh; příliš benevolentní validace může opět povolit data loss.

## Dependencies
- Rozhodnutí uživatele o pravidle přes půlnoc (Plan step 1).
- Rozhodnutí o import policy (Plan step 1).

## Open Questions
- ~~OPEN QUESTION: Varianta A/B/C pro aktivitu přes půlnoc?~~ **[RESOLVED: A — Auto-stop]**
- ~~OPEN QUESTION: Má import vyžadovat wrapper export, nebo tolerovat raw state?~~ **[RESOLVED: B — Tolerant]**

---

## Handoff Notes (Critic → Implementer)
- Tohle je patch release zaměřený na bezpečnost dat a korektnost denního cyklu.
- Nechte scope úmyslně malý; vyhnout se novým UI.
