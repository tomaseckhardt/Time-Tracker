# Epic-to-Plan Validation Report

**Date**: 2026-04-09
**Epic**: v1.7.1-A (Roadmap)
**Plan**: ID=1 (Planning)
**Validator**: Analyst

---

## Executive Summary
✅ **ALIGNED** — Plan ID=1 deliverables mapují na epic 1.7.1-A outcome-focused acceptance criteria.

⚠️ **BLOCKED** — Implementation vyžaduje product decision o pravidle session přes půlnoc (open question v plánu, dependency v epicu).

---

## Mapping Analysis

### Epic Acceptance Criteria → Plan Deliverables

| Epic AC | Plan Deliverable | Coverage | Evidence |
|---------|------------------|----------|----------|
| 1. Import nevalidního JSON zobrazí chybu a zachová data | Deliverable #1: Import odmítne nevalidní JSON, zobrazí error | ✅ FULL | Plan step 2 AC: "Import invalid-backup.json skončí error + entries zůstanou" |
| 2. Import validní zálohy obnoví data a potvrdí success | Deliverable #1: (implicitní pozitivní cesta) | ✅ FULL | Plan step 2 AC: "Import validní zálohy obnoví data a zobrazí success" |
| 3. Session ze včerejška korektně ukončena/splitnuta/přenesena | Deliverable #2: Init flow provede day-cycle check dle pravidla | ✅ FULL | Plan step 3 AC: "E2E scénář yesterday projde" + step 1 decision gate |
| 4. Denní/týdenní reporty správně započítávají entries | (Implicitně pokryto deliverable #2) | ✅ IMPLIED | Pokud session je správně ukončena/splitnuta, reporty čtou entries → budou správné |
| 5. E2E test suite 26/26 PASS | Deliverable #3: E2E 26/26 PASS | ✅ FULL | Plan step 5 AC: "26/26 PASS" |

### Value Statement Alignment

**Epic value**:
> "nepřijdu o historii při chybě importu a denní/týdenní reporty zůstanou důvěryhodné bez manuálních korekcí"

**Plan value**:
> "nepřijdu o historii a denní/týdenní reporty zůstanou důvěryhodné"

✅ **Konzistentní** — Plan value je přímým podmnožinovým parafrázováním epic value.

---

## Gap Analysis

### Identified Gaps
**None** — Všechny epic AC jsou pokryté plan deliverables (explicitně nebo implicitně).

### Ambiguity / Risk
- Epic AC #4 (reporty) není explicitní deliverable, ale je implicitně závislý na deliverable #2.
- Doporučení: Přidat do plan acceptance criteria explicitní validaci denního/týdenního reportu v testech (pokud ještě neexistuje).

---

## Blocking Dependencies

### Open Questions (from Plan)
1. **OPEN QUESTION**: Pravidlo pro aktivitu přes půlnoc — varianty A/B/C?
   - Status: **UNRESOLVED**
   - Impact: Blokuje implementaci plan step 3 (Bug #2 fix)
   - Owner: User/Product

2. **OPEN QUESTION**: Schema validace importu (wrapper vs raw state)?
   - Status: **UNRESOLVED**
   - Impact: Ovlivňuje přísnost validace v plan step 2
   - Owner: Product/Implementer

### Epic Dependencies (from Roadmap)
- "Produktové rozhodnutí: pravidlo pro session přes půlnoc"
  - Status: **NOT MET**
  - Alignment: ✅ Shodné s plan open question #1

---

## Validation Verdict

| Criterion | Result |
|-----------|--------|
| Deliverables cover epic outcomes | ✅ PASS |
| Value statements aligned | ✅ PASS |
| Acceptance criteria measurable | ✅ PASS |
| No orphaned requirements | ✅ PASS |
| Dependencies identified | ✅ PASS |
| **Overall Alignment** | ✅ **ALIGNED** |
| **Ready for Implementation** | ⚠️ **BLOCKED** (pending decision gate) |

---

## Recommendations

1. **Immediate**: Uživatel/Product musí rozhodnout open question #1 (variantu A/B/C) předtím, než může jít plan do implementace.
2. **Nice-to-have**: Přidat explicitní E2E test pro denní/týdenní report správnost po day-cycle fixu (aktuálně implicitní).
3. **Documentation**: Po implementaci aktualizovat roadmap epic status z "Planned" → "In Progress" → "Delivered".

---

## Next Steps
- [ ] Product rozhodne pravidlo session přes půlnoc (A/B/C)
- [ ] Updatovat plan step 1 s výsledkem
- [ ] Updatovat roadmap epic dependency jako splněnou
- [ ] Hand off plan → Critic → Implementer
