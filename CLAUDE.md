# Bauraum Akquise

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

## Getrennt von der Webseite

Die Akquise ist seit dem 7. November ein eigenes Programm (README.md).
Sie teilt nur die Datenbank mit wohntraums.life. Migrationen gehören
dem Repository der Webseite: wer hier eine Tabelle braucht, legt die
Migration dort an.

Die Eigentumsauskunft bleibt ein Klick je Grundstück durch einen
Menschen (Grundbuchverordnung Art. 27 Abs. 2, Schutz vor
Serienabfragen). Nichts bauen, was SMS-Codes, Tageshöchstzahlen oder
Captchas der Portale umgeht.

## Was live ist

Jeder Bau schreibt seinen Commit ins Bündel (`__FASSUNG__` in
`vite.config.ts`, im Browser `window.bauraumFassung`). Der Ablauf
`Was ist live` prüft bei jedem Push auf `main`, ob genau dieser Commit
auf `AKQUISE_URL` steht.

## Gestaltung

Wie die Seite aussieht, steht in `DESIGN.md` -- vor jeder Arbeit an der
Oberfläche lesen. Das Cockpit ist das Muster für jede Seite (Julian:
"so ist es perfekt"): Luftbild-Bühne, ein Satz mit Zahl,
Kennzahlenleiste, Tafeln mit Grafik, rechte Spalte mit Karten, Bewegung,
Handy-Fassung. Gebaut wird mit `<Seite>` aus `src/components/rahmen.tsx`.

## Arbeitsweise mit Julian (seine Rückmeldungen, gesammelt)

  * Kurz und klar antworten, keine Extrazeilen; Empfehlung statt Auswahl.
  * Nie raten: selber nachsehen, messen, live prüfen (siehe oben).
  * Alles laufend selbst kontrollieren und verbessern (8. November:
    "in jeder Weise überall immer kontrollierst ... um jede Ecke
    denken"): nach jeder Änderung Tests, Bau, live und iPhone prüfen;
    Folgefehler selber suchen; jede Rückmeldung hier als Regel ablegen.
  * Öffentliche Seiten: iPhone und Safari zuerst; Tippflächen ab 44px,
    Eingaben ab 16px, nichts ragt über den Rand.
  * Gestaltung nach design-wie-apple: nichts doppelt, keine Abzeichen
    oder Kästchen um Zahlen, keine Karten-mit-Schatten-Flut.
  * Formulare kinderleicht: eine Frage je Bild, ein Tipp führt weiter.
  * Testdaten immer gekennzeichnet (Name TEST, Quelle test) und
    ausblendbar.

## Sprache

Code, Kommentare, Commits und Antworten auf Deutsch. Kommentare sagen,
*warum* etwas so ist, nicht *was* die Zeile tut.

## Geheimnisse

Zugangsdaten gehören weder in den Code noch ins Repository noch in den
Verlauf. `PIPEDRIVE_API_TOKEN` und `SUPABASE_DB_URL` liegen als
GitHub-Secrets und dürfen nie in einer Ausgabe landen -- die Helfer in
`tools/` geben deshalb nur den HTTP-Status aus, nie die Adresse. Der
`service_role`-Schlüssel gehört nie in den Browser.
