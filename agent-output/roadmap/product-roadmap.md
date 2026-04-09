# Time Tracker - Product Roadmap

**Last Updated**: 2026-04-09 17:20
**Roadmap Owner**: Product
**Strategic Vision**: Jednoduchý, spolehlivý time tracker pro denní práci s aktivitami Caroda, AYM a Automatizované testy. Zaměření na přesnost dat, bezpečnost záloh a intuitivní UX.

## Change Log
| Date & Time | Change | Rationale |
|-------------|--------|-----------|
| 2026-04-09 15:56 | Initial roadmap vytvořen s epicem 1.7.1 | Dokument chyběl, plán ID=1 potřebuje epic alignment |
| 2026-04-09 15:56 | Validated plan ID=1 alignment s epicem 1.7.1-A | Deliverables pokrývají epic AC; BLOCKED na product decision |
| 2026-04-09 17:20 | Product decisions resolved: půlnoc=A (auto-stop), import=B (tolerant) | User confirmed decisions, plan unblocked |

---

## Release v1.7.1 - Data Integrity & Correctness
**Target Date**: 2026-04-15
**Strategic Goal**: Odstranit kritické chyby, které ohrožují integritu dat a správnost reportů.

### Epic 1.7.1-A: Bezpečný import + správné zeitgeisty přes hranice dne
**Priority**: P0
**Status**: Planned

**User Story**:
As a uživatel trackeru,
I want aby import záloh odmítl nevalidní soubory a session korektně respektovala hranice dne,
So that nepřijdu o historii při chybě importu a denní/týdenní reporty zůstanou důvěryhodné bez manuálních korekcí.

**Business Value**:
- **Prevence ztráty dat**: nevalidní import zálohy nesmí přepsat existující entries.
- **Důvěryhodnost reportů**: aktivita začatá včera musí být korektně ukončena a zaznamenána, aby denní/týdenní souhrny odpovídaly realitě.
- **Snížení frustrace**: uživatel nemusí ručně opravovat entry, které se "přelily" přes půlnoc.

**Dependencies**:
- ~~Produktové rozhodnutí: pravidlo pro session přes půlnoc (auto-stop / split / carry-over).~~ **RESOLVED: A — Auto-stop**

**Acceptance Criteria** (outcome-focused):
- [ ] Import nevalidního JSON souboru zobrazí chybu a zachová existující data (nedojde k přepsání).
- [ ] Import validní zálohy obnoví data a potvrdí success.
- [ ] Session aktivní ze včerejška je při načtení stránky korektně ukončena/splitnuta/přenesena dle produktového pravidla.
- [ ] Denní/týdenní reporty správně započítávají entries z přechodu dne.
- [ ] E2E test suite prochází 26/26 bez očekávaných selhání.

**Constraints**:
- Patch release (v1.7.0 → v1.7.1), žádné nové UI obrazovky.
- Změny omezené na validaci importu a init lifecycle.

**Status Notes**:
- 2026-04-09: Epic vytvořen z analysis ID=1, plán ID=1 připraven k implementaci.
- 2026-04-09 15:56: Validated alignment — plán ID=1 deliverables pokrývají epic AC. BLOCKED pending product decision o pravidle session přes půlnoc (decision gate plan step 1).
- 2026-04-09 17:20: Product decisions resolved (půlnoc=A auto-stop, import=B tolerant). Plan ready for implementation.
- 2026-04-09 18:00: QA complete — E2E suite 27/27 PASS. Ready for UAT.

---

## Active Release Tracker

**Current Working Release**: v1.7.1

| Plan ID | Title | UAT Status | Committed |
|---------|-------|------------|----------|
| 001 | Import + day-cycle fixes | Pending | ✗ |

**Release Status**: 0 of 1 plans committed
**Ready for Release**: No
**Blocking Items**: Plan 001 not yet implemented

---

## Backlog / Future Consideration
*(Žádné epicy zatím nepřiřazeny)*

---

## Master Product Objective (IMMUTABLE)

**Vision**: Poskytovat uživateli přesný, bezpečný a jednoduchý nástroj pro trackování času na klíčové aktivity tak, aby mohl důvěřovat datům a rozhodovat se na základě reportů.

**Core tenets**:
1. **Data integrity**: žádná ztráta dat; validace před destruktivními operacemi.
2. **Temporal correctness**: čas je záznamem přesně tak, jak to uživatel prožil.
3. **Zero-friction UX**: start/stop jedním kliknutím, minimum formulářů.
