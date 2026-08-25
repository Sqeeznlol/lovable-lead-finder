# Neue Supabase-Instanz aufsetzen

Anleitung für eine frische, saubere Instanz. Dauert rund 10 Minuten.

## 1. Projekt anlegen

1. https://supabase.com/dashboard → **New project**
2. Name z.B. `bauraum`, Region **Frankfurt (eu-central-1)**, Passwort setzen
3. Warten, bis das Projekt bereit ist

## 2. Schema einspielen

1. Im Projekt links auf **SQL Editor** → **New query**
2. Inhalt von `supabase/setup/01_schema.sql` einfügen → **Run**
3. Es darf keine rote Fehlermeldung erscheinen. Die Meldung, dass
   `pg_cron` fehlt, ist unkritisch — sie betrifft nur den optionalen
   Tages-Digest.

Danach stehen alle Tabellen, die Potenzial-Rechnung und der Trigger
bereit, der jedes neue Objekt automatisch durchrechnet.

## 3. Zugangsdaten in die App eintragen

Im Supabase-Dashboard unter **Project Settings → API**:

| Supabase                | wohin                                 |
|-------------------------|---------------------------------------|
| Project URL             | `VITE_SUPABASE_URL`                   |
| `anon` `public` Key     | `VITE_SUPABASE_PUBLISHABLE_KEY`       |
| Project-Ref (aus der URL) | `VITE_SUPABASE_PROJECT_ID` und `supabase/config.toml` |

Eintragen an zwei Orten:

- lokal in `.env`
- in Vercel unter **Project Settings → Environment Variables**
  (danach einmal neu deployen, damit die Werte greifen)

## 4. Daten importieren

In der App den Reiter **Master-Import** öffnen und die Excel-Listen
hochladen. Der Import läuft im Browser direkt gegen Supabase — es gibt
also kein Upload-Limit wie beim Chat.

Beim Import rechnet der Trigger jede Zeile automatisch durch:
Ausnützung, zulässige Geschossfläche, ungenutzte Reserve, Investition
und Marge. Nicht-Bauzonen und denkmalgeschützte Objekte werden
automatisch auf «Ausschliessen» gesetzt und tauchen in der Vorauswahl
nicht mehr auf.

## 5. Annahmen anpassen

Die Rechenannahmen stehen in der Tabelle `potenzial_config` — eine
einzige Zeile. Ändern und danach neu rechnen lassen:

```sql
UPDATE public.potenzial_config SET
  baukosten_pro_m2  = 3200,   -- CHF pro m² neuer Geschossfläche
  erloes_pro_m2_hnf = 9500,   -- CHF pro m² zusätzlicher HNF
  hnf_faktor        = 0.8,    -- Anteil HNF an der Geschossfläche
  ziffer_als_bmz    = true,   -- Ziffer im Zonennamen = Baumassenziffer
  updated_at        = now();

SELECT public.recompute_potenzial();
```

`recompute_potenzial()` arbeitet in Blöcken von 5'000 Zeilen und kann
jederzeit erneut aufgerufen werden.
