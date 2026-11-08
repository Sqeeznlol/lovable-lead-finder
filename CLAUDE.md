# Bauraum Lead Finder

## Nie raten, immer nachsehen

Die Regel für dieses Projekt, aus Schaden gelernt: **keine Aussage über
einen Zustand, die nicht nachgesehen wurde.** Weder "das sollte jetzt
gehen" noch "der Link stimmt" noch "das ist live". Es hat mehrere Tage
gekostet, weil geraten statt gemessen wurde:

  * Der Name eines INTERLIS-Elements wurde tagelang geraten
    (`Typ_Grundnutzung`); er existiert nicht. Ein Blick in die Datei --
    alle Elemente zählen, ungekürzt -- beendete es in fünf Minuten.

  * "Bitte ausfüllen" in Pipedrive wurde für behoben erklärt, bevor der
    Deal nachgesehen war. Der Screenschuss zeigte das Gegenteil.

  * Der ausgelieferte Stand wurde für aktuell gehalten, weil der Code
    auf `main` lag. Auf der Seite stand er nicht.

Praktisch heisst das:

  * Wer eine Zahl nennt, hat sie abgefragt. Wer ein Feld nennt, hat es
    gelesen. Wer einen Namen nennt, hat ihn in der Datei gesehen.
  * Keine Ausgabe mit `head` abschneiden, solange man noch sucht -- der
    gesuchte Fall steht gern auf Zeile neun.
  * Statt den Benutzer nachprüfen zu lassen: einen Test oder einen
    Ablauf schreiben, der es dauerhaft nachprüft.

## Akquise getrennt

Seit dem 7. November ist die Akquise ein eigenes Programm (Julian:
"alles Akquise ... separiert im Git ... dann weg von der Webseite"):
Eigentümerabfrage, Nummern, Pipedrive, Chrome-Erweiterung, Check-Seiten,
Ratgeber und Anfrage-Seiten liegen im Zweig `akquise` (später das
Repository `bauraum-akquise`). Hier bleiben die Webseite, Wohntraums,
die Datenbank mit allen Migrationen und die Datenabläufe. Der Test
`akquise-getrennt.test.ts` wird rot, wenn ein Teil zurückkommt.

Ausnahme seit dem 8. November (Julian: "es soll da sein"): der Reiter
"Leads" zeigt hier die Leads und Zahlen der Check-Seiten. Er liest nur
(`anfrage`, `check_trichter`); die Seiten selbst bleiben in der Akquise.

## Was live ist

Jeder Bau schreibt seinen Commit ins Bündel (`__FASSUNG__` in
`vite.config.ts`, im Browser `window.bauraumFassung`). Der Ablauf
`Was ist live` prüft bei jedem Push auf `main`, ob genau dieser Commit
auf der Seite steht, und wird rot, wenn nicht. Der Name des Bündels
taugt als Merkmal nicht -- er hängt auch an den Umgebungsvariablen.

Das ganze Vorgehen steht in `docs/morgen.md` unter
"Wie gepusht und ausgeliefert wird".

## Gestaltung

Wie die Seite aussieht, steht in `DESIGN.md` -- vor jeder Arbeit an der
Oberfläche lesen. Das Cockpit ist das Muster für jede Seite (Julian:
"so ist es perfekt"): Luftbild-Bühne, ein Satz mit Zahl,
Kennzahlenleiste, Tafeln mit Grafik, rechte Spalte mit Karten, Bewegung,
Handy-Fassung. Gebaut wird mit `<Seite>` aus `src/components/rahmen.tsx`.

## Sprache

Code, Kommentare, Commits und Antworten auf Deutsch. Kommentare sagen,
*warum* etwas so ist, nicht *was* die Zeile tut.

## Geheimnisse

Zugangsdaten gehören weder in den Code noch ins Repository noch in den
Verlauf. `PIPEDRIVE_API_TOKEN` und `SUPABASE_DB_URL` liegen als
GitHub-Secrets und dürfen nie in einer Ausgabe landen -- die Helfer in
`tools/` geben deshalb nur den HTTP-Status aus, nie die Adresse. Der
`service_role`-Schlüssel gehört nie in den Browser.
