# Time Tracker

Jednoduchá webová aplikace pro sledování času stráveného na jednotlivých projektech.

**Verze**: v1.7.1

## Changelog

### v1.7.1 (2026-04-09)
- **Fix**: Import zálohy nyní správně odmítne nevalidní soubory (Bug #1)
- **Fix**: Aktivní session ze včerejška je automaticky ukončena při načtení stránky (Bug #2)
- **Telemetrie**: Přidáno logování pro import a day-cycle diagnostiku

### v1.7.0
- Filtry a plná editace záznamů
- Validace překryvů
- Obnova session
- Export/import záloh
- Zvýraznění neobvyklých záznamů

## Funkce

- **Sledování aktivit** — tlačítka pro rychlé spuštění/zastavení měření času pro aktivity: Caroda, AYM, Automatizované testy
- **Dnešní souhrn** — přehled celkového času za dnešní den pro každou aktivitu zvlášť
- **Poslední záznamy** — tabulka posledních 5 záznamů s možností rozbalit celý seznam
- **Týdenní report** — nová záložka s přehledem odpracovaných hodin po týdnech, export do CSV (kompatibilní s Excelem) nebo otevření v Google Sheets
- **3 barevná témata** — Sunrise Glass, Slate Focus, Citrus Pop
- **Cloud sync** — synchronizace dat mezi zařízeními přes vlastní Supabase projekt (upload/download, volitelná automatická synchronizace po každé změně)
- **Denní cyklus** — aktivita se automaticky zastaví o půlnoci, zobrazí se notifikace o novém dni
- **Persistence** — veškerá data se ukládají do `localStorage`

## Struktura projektu

```
index.html     # hlavní stránka
styles.css     # styly + barevná témata
app.js         # veškerá logika aplikace
```
