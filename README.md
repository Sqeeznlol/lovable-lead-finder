# Bauraum Akquise

Alles, was Eigentümer findet und anspricht -- getrennt von der Webseite
wohntraums.life (Julian, 7. November 2026: "alles Akquise ... separiert im
Git ... dann weg von der Webseite"). Beide teilen dieselbe Datenbank; das
Schema und die Datenabläufe (Kantone laden, Gebäude, Baugesuche) gehören
dem Repository der Webseite.

## Was hier liegt

| Teil | Wo | Wer sieht es |
|---|---|---|
| Akquise: Übersicht, Abfrage, Gebäudesuche, Nummern, Pipedrive | `src/pages/Index.tsx` | nur angemeldet, keine Fondsleitungen |
| Stillgelegt: Akquise-Modus, Telefone, Vorauswahl, Telefon-Suche, Liegenschaften, Export, Import | Admin → Stillgelegte Bereiche | nur angemeldet |
| Chrome-Erweiterung für die Eigentumsauskunft ZH und TG | `extension/` | wer sie installiert |
| Lesezeichen für die Auskunft | Admin | angemeldet |
| Check-Seiten (ParzellenChecker, HausChecker, ...) | `src/pages/Check.tsx`, `src/lib/check-marken.ts` | öffentlich, auf ihren Domains |
| Leads aller Marken und Zahlen je Marke (Besucher bis Lead, Quelle) | `src/components/Leads.tsx`, Reiter "Leads" | nur angemeldet |
| Ratgeber für Eigentümer | `src/pages/Ratgeber.tsx`, `src/lib/ratgeber.ts` | öffentlich |
| Anfrage-Seiten Bewertung, Potenzial, Investor | `src/pages/Anfrage.tsx` | öffentlich |
| Server-Funktionen: Telefonsuche, Pipedrive, SMS, Tagesbericht | `supabase/functions/` | Supabase |
| Pipedrive-Werkzeuge | `tools/pipedrive-*.py`, Ablauf "Pipedrive ansehen" | GitHub Actions |
| Werbeplan | `docs/werbeplan-eigentuemer.md` | intern |

## Was automatisch läuft und was nicht

Nach einer Eigentumsauskunft läuft alles von selbst: Nummer suchen
(tel-search), Deal in Pipedrive anlegen (pipedrive-push), Objekt aus der
Liste nehmen. Die Check-Seiten legen jeden Lead mit Herkunft und
Priorität direkt in die Datenbank.

**Nicht automatisch ist die Auskunft selbst.** Zürich und Thurgau geben
Eigentümer nur gegen Handynummer und SMS-Code heraus, mit einer
Tageshöchstzahl. Das ist kein Hindernis des Portals, sondern Bundesrecht:
Die Kantone müssen sicherstellen, "dass die Daten nur grundstücksbezogen
abgerufen werden können und dass die Auskunftssysteme vor Serienabfragen
geschützt sind" (Grundbuchverordnung Art. 27 Abs. 2). Darum bleibt es
ein Klick je Grundstück durch einen Menschen; die Erweiterung nimmt ihm
alles andere ab.

## Starten

```sh
npm install
npm run dev          # http://localhost:8080
```

Die Erweiterung (`extension/`, in Chrome als entpackte Erweiterung laden)
spricht mit der App auf `localhost`. Bekommt die Akquise eine eigene
Adresse, diese an zwei Stellen eintragen:

1. `extension/manifest.json`: bei `content-app.js` unter `matches` und
   unter `externally_connectable`;
2. `extension/background.js`: in `APP_HOSTS`.

## Ausliefern (einmal einrichten)

1. Bei Vercel ein neues Projekt aus diesem Repository anlegen, Build
   `npm run build`, Ausgabe `dist`. Umgebungsvariablen wie in `.env`.
2. Die Marken-Domains (hauschecker.ch, parzellenchecker.ch, ...) diesem
   Projekt hinzufügen, nicht der Webseite.
3. Die Adresse als Repository-Variable `AKQUISE_URL` eintragen; dann
   prüft "Was ist live" jeden Push.
4. Secrets für die Abläufe: `SUPABASE_ACCESS_TOKEN` (Funktionen),
   `PIPEDRIVE_API_TOKEN`, `SUPABASE_DB_URL` und die Konto-Passwörter, die
   `tools/anmelden.sh` liest (Pipedrive ansehen).

## Abläufe

| Ablauf | Wann | Was |
|---|---|---|
| Prüfen | jeder Push | Typen, Tests, Bau, Erweiterung lesbar |
| Was ist live | Push auf main | steht der Commit auf `AKQUISE_URL`? |
| Funktionen ausliefern | Änderung unter `supabase/functions` | lädt die vier Funktionen zu Supabase |
| Extension packen | Änderung unter `extension` | Paket für den Download im Admin |
| Pipedrive ansehen | von Hand | Aufbau, Abgleich und Aufräumen in Pipedrive |
