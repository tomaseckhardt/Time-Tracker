# Time Tracker

Jednoduchá webová aplikace pro sledování času stráveného na jednotlivých projektech.

## Funkce

- **Sledování aktivit** — tlačítka pro rychlé spuštění/zastavení měření času pro aktivity: Caroda, AYM, Automatizované testy
- **Dnešní souhrn** — přehled celkového času za dnešní den pro každou aktivitu zvlášť
- **Poslední záznamy** — tabulka posledních 5 záznamů s možností rozbalit celý seznam
- **Týdenní report** — nová záložka s přehledem odpracovaných hodin po týdnech, export do CSV (kompatibilní s Excelem) nebo otevření v Google Sheets
- **3 barevná témata** — Sunrise Glass, Slate Focus, Citrus Pop
- **Cloud sync** — synchronizace dat mezi zařízeními přes vlastní Supabase projekt (upload/download, volitelná automatická synchronizace po každé změně)
- **Denní cyklus** — aktivita se automaticky zastaví o půlnoci, zobrazí se notifikace o novém dni
- **Persistence** — veškerá data se ukládají do `localStorage`

## Cloud sync (volitelné)

Pro synchronizaci mezi zařízeními potřebuješ vlastní [Supabase](https://supabase.com) projekt s tabulkou:

```sql
CREATE TABLE tracker_snapshots (
  user_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

URL, Anon Key a User ID zadej v sekci **Cloud Sync** přímo v aplikaci.

## Struktura projektu

```
index.html     # hlavní stránka
styles.css     # styly + barevná témata
app.js         # veškerá logika aplikace
```
