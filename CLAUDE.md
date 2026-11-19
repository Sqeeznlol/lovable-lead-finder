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
  * Die Check-Seiten bleiben in Gebrauch (16. November: Wortlaut,
    Impressum, Kampagnenplan). «Akquise und Pipedrive brauche ich nicht
    mehr» (15. November) meint Eigentümerabfrage, Nummern und Pipedrive,
    nicht die Check-Seiten.
  * Wortlaut der Check-Seiten (16. November: «Was Ihre Parzelle TRÄGT
    macht wenig Sinn»): schreiben, wie ein Eigentümer redet. Ein
    Grundstück trägt, kann, erlaubt und gibt nichts her -- darauf wird
    gebaut, und was erlaubt ist, sagt die Gemeinde. «Baureserve» statt
    «Reserve», wo das Wort allein steht. Der Test `check.test.ts`
    (Wortlaut der Check-Seiten) wird rot, wenn so ein Satz zurückkommt.
  * Werbung nur bei Google Ads, Julian und Bauraum zusammen, Budget
    CHF 1'000 im Monat (18. November: «wir machen nur Google ADS»,
    «budget 1000 CHF im Monat»). Kein Meta-Pixel mehr
    (`zustimmung.test.ts` wird rot, wenn es zurückkommt). Kampagnen,
    Keywords, Anzeigen und Standorte erzeugt
    `docs/kampagnenplan/google_ads.py` als Importdatei für den Google Ads
    Editor; der Werbeplan (`werbeplan.py`) nennt dieselben Zahlen. Neue
    Anzeigentexte versprechen nur, was die Seite hält (nie «ohne
    Anmeldung»: Ausnützung und Reserve gibt es gegen Kontaktangaben).
  * Ältere Eigentümer lesen mit (19. November: «ältere Leute verwenden
    diese Webseite», «Call to Action ist weit unten», «dass man da nicht
    selber scrollen muss»). Nach der Adresse stehen die vier Zahlen und
    gleich darunter der nächste Schritt, erst danach die Einzelheiten; auf
    dem Handy liegt die Karte dazwischen. Jeder Tipp führt weiter, und die
    Seite rollt selbst zum Schritt (Wegweiser). Schrift ab 17px,
    Hauptknöpfe 58px.
  * Angaben einzeln, immer im selben Feld: Name, Wohnadresse, Telefon,
    E-Mail, alle vier Pflicht (19. November: «Email ist Pflicht, keine
    freiwillige Option»). Erst danach der Bericht als echtes PDF
    (`check-bericht.ts`, mit Luftbild und Umriss), nie vorher und nicht
    mehr als Druck der Seite. `check-wegweiser.test.ts` wacht darüber.
  * Tipps und Tricks (`check-tipps.ts`) nur mit Quelle, auf der
    amtlichen Seite nachgelesen. Was kantonal verschieden ist, trägt den
    Kanton und erscheint erst zur Parzelle dort.
  * Eigene Fotos nur über `check-fotos.json` und
    `tools/fotos_vorbereiten.py` (docs/fotos.md): Alt-Text, Urheber,
    Rechte, Ort in Seite und Datei, Kameradaten und GPS entfernt.
  * Jede Zahl mit Fundstelle (19. November, nach dem Vergleich mit
    baugesuch.prüfer.ch): unter der Rechnung zum Aufklappen die Rechnung
    Zahl für Zahl, woher der Wert kommt (Zonenplan, Bauordnung der
    Gemeinde) und welcher Artikel des kantonalen Baurechts sagt, wie die
    Ziffer gemessen wird, wörtlich zitiert (`check-fundstelle.ts`,
    `check-gesetze.json` mit Adresse und Stand). Ein Artikel kommt nur
    hinein, wenn er in der amtlichen Gesetzessammlung gelesen ist; fehlt
    er, sagt die Seite das. Die Artikelnummer der Bauordnung jeder Gemeinde
    kennen wir nicht und nennen sie nicht. Nicht neben jede Zahl (Julian,
    15. November: Quellen nicht je Zeile).
  * Vor dem ersten Klick sieht man, was man bekommt: ein Beispielbericht mit
    erfundenen Daten (überall als erfunden bezeichnet), der bewegte Schnitt
    (heute und möglich, «Schema, nicht massstäblich») und «Was Sie
    bekommen» bis zum unverbindlichen Kaufangebot (Julian: «mit
    Angebot»). Nach dem Kaufangebot fragt die Seite nur, wer verkaufen oder
    den Wert kennen will; ein Ja macht den Lead heiss. Für das Kaufangebot
    nennt die Seite keine Frist. `check-fundstelle.test.ts` wacht darüber.
  * «Wo der Check hingehört» (19. November, nach dem Vergleich mit
    eigenheimkompass.ch): Online-Bewertung, unser Check, Makler, ehrlich
    auch mit dem, was der Check nicht kann (kein Blick vor Ort). Über die
    anderen keine Beträge oder Prozente, die wir nicht belegen können.
    Dazu die Fragen «Warum ist der Check kostenlos?» und «Ersetzt der Check
    eine Bauanfrage?». Kosten je Bauteil zeigt die Seite nicht: frei
    belegbar ist nur, was einzelne Teile halten (paritätische
    Lebensdauertabelle, ganz nur gedruckt), nicht, was sie kosten.
  * Herkunft eines Leads (utm_*, gclid) wird beim Start gemerkt
    (`werbe-herkunft.ts`), weil die Check-Seite ihren Link beim Wählen
    einer Adresse umschreibt. Der Google-Tag lädt gleich nach
    «Einverstanden» und reicht die Klick-Kennung über page_location nach.

## Sprache

Code, Kommentare, Commits und Antworten auf Deutsch. Kommentare sagen,
*warum* etwas so ist, nicht *was* die Zeile tut.

## Geheimnisse

Zugangsdaten gehören weder in den Code noch ins Repository noch in den
Verlauf. `PIPEDRIVE_API_TOKEN` und `SUPABASE_DB_URL` liegen als
GitHub-Secrets und dürfen nie in einer Ausgabe landen -- die Helfer in
`tools/` geben deshalb nur den HTTP-Status aus, nie die Adresse. Der
`service_role`-Schlüssel gehört nie in den Browser.
