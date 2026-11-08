# Bauraum Akquise

Alles, was Eigentümer findet und anspricht -- getrennt von der Webseite
wohntraums.life (Julian, 7. November 2026: "alles Akquise ... separiert im
Git ... dann weg von der Webseite"). Beide teilen dieselbe Datenbank; das
Schema und die Datenabläufe (Kantone laden, Gebäude, Baugesuche) gehören
dem Repository der Webseite.

## Was hier liegt

| Teil | Wo | Wer sieht es |
|---|---|---|
| Leads-Dashboard (Startseite): alle Leads der Check-Seiten, Zahlen je Webseite und Quelle | `src/pages/Index.tsx`, `src/components/Leads.tsx` | nur angemeldet, keine Fondsleitungen |
| Admin: Benutzer und Protokoll | `/admin` | nur Admins |
| Check-Seiten (ParzellenChecker, HausChecker, ...) | `src/pages/Check.tsx`, `src/lib/check-marken.ts` | öffentlich, auf ihren Domains |
| Ratgeber für Eigentümer | `src/pages/Ratgeber.tsx`, `src/lib/ratgeber.ts` | öffentlich |
| Anfrage-Seiten Bewertung, Potenzial, Investor | `src/pages/Anfrage.tsx` | öffentlich |
| Server-Funktionen: Telefonsuche, Pipedrive, SMS, Tagesbericht | `supabase/functions/` | Supabase |
| Pipedrive-Werkzeuge | `tools/pipedrive-*.py`, Ablauf "Pipedrive ansehen" | GitHub Actions |
| Werbeplan | `docs/werbeplan-eigentuemer.md` | intern |

## Nicht mehr in der Oberfläche

Seit dem 8. November (Julian: "neues Tool ... die alten Funktionen
einfach weg") zeigt die App nur noch Leads und Admin. Die frühere
Eigentümerabfrage (Abfrage, Gebäudesuche, Nummern, Pipedrive,
Chrome-Erweiterung, Lesezeichen) ist nicht mehr erreichbar; ihr Code und
der folgende Abschnitt bleiben stehen, bis entschieden ist, ob er
gelöscht wird.

## Was automatisch läuft und was nicht (frühere Eigentümerabfrage)

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
3. Meta-Pixel für die Facebook-Werbung: bei Vercel die Umgebungsvariable
   `VITE_META_PIXEL_ID` mit der Pixel-ID aus dem Meta-Werbekonto setzen
   und neu bauen. Ohne sie lädt kein Pixel. Gesendet werden PageView,
   Search, ViewContent, InitiateCheckout und Lead, je mit der Domain,
   nie Name, Adresse oder Nummer.
4. Die Adresse als Repository-Variable `AKQUISE_URL` eintragen; dann
   prüft "Was ist live" jeden Push.
5. Secrets für die Abläufe: `SUPABASE_ACCESS_TOKEN` (Funktionen),
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
