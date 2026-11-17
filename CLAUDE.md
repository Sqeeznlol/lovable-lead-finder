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

Ein Bereich, der erst mit seinem Reiter kommt, entsteht mit
`nachladen()` aus `src/lib/neue-fassung.ts`, nie mit `lazy` direkt.
Fehlt mitten in einer Auslieferung sein Programmteil, wartet er, bis
die Seite neu geladen ist (17. November, Admin-Reiter: «Fehler im
Bereich Die Seite»). «Reiter prüfen» spielt das am Kalender durch.

Bringt ein Push eine neue Tabelle oder Funktion mit, steht die Seite
live, bevor die Migration eingespielt ist, und «Reiter prüfen» wird rot
(16. November, CALC YOU LATER: «kalkulation 404»). Darum gleich nach dem
Push die Migration einspielen und «Reiter prüfen» neu starten. Er spielt
seither auch einen echten Durchgang: Adresse rechnen, Entwurf anlegen,
Entwurf löschen.

### Pushes bündeln

Vercel liefert höchstens hundert Mal am Tag aus, und am Repository
hängen die Webseite und die Check-Seiten. Am 15. November gingen 70
Pushes hinein (48 auf `main`, 22 auf `akquise`); ab 21:21 blieb die
Seite acht Commits zurück stehen, und «Was ist live» wurde rot.

  * Ein Push je abgeschlossene Sache, nicht je Zwischenschritt. Lokal
    committen, prüfen, dann einmal pushen.
  * Abläufe, Werkzeuge und Unterlagen kosten denselben Bau wie die
    Seite: zusammen mit der Arbeit pushen, zu der sie gehören.
  * Bleibt die Seite stehen: nicht weiterpushen. In Vercel bringt
    *Promote to Production* einen gebauten Stand live, ohne Kontingent.

## Die Datenbank bedient die Seite

Die Datenbank läuft auf der kleinsten bezahlten Instanz von Supabase
(«Micro»: 1 GB Arbeitsspeicher, dauerhaft 11 MB/s und 500 Zugriffe je
Sekunde auf die Platte; mehr nur aus einem Guthaben, das sich im
Leerlauf füllt). Die Datenbank selbst ist seit den Zürcher Umrissen
1.5 GB gross, passt also nicht in den Speicher. An ihr hängen Anmeldung
und jede Abfrage der Seite.

In der Nacht auf den 16. November rechnete ein Ablauf die Nachbarschaft
der Zürcher Parzellen darin. Von 00:33 bis 00:59 Uhr scheiterte die
Anmeldung. Danach war das Guthaben aufgebraucht: um 02:14 Uhr lief in
der Datenbank keine einzige Anweisung, und trotzdem brauchte eine
Statistik-Abfrage über 30 Sekunden. In diesem Zustand bringt schon ein
Messlauf («Reiter prüfen», «Tempo») die Seite wieder zum Stehen.

  * Schwere Rechnungen laufen auf dem Runner, nicht in der Datenbank
    (Muster: Ablauf «Nachbarschaft»). Hinein kommt nur das Ergebnis, in
    Portionen, mit Pause, nachts, und nur solange sie zügig antwortet.
  * Jede Anweisung trägt eine Frist (`statement_timeout`). Einen Lauf
    abbrechen beendet nicht, was er in der Datenbank gestartet hat.
  * Die Seite zählt keine grosse Tabelle beim Öffnen. Solche Zahlen
    zählt der Ablauf «Zählen» vorab (jede Nacht und nach dem Laden);
    die Seite liest sie über `daten_stand` (`src/lib/daten-stand.ts`).
  * Messläufe kosten vom selben Guthaben. Nach einem schweren Lauf
    keinen hinterherschicken, sondern warten; und sie messen nur, was
    die Seite heute fragt.
  * Antwortet die Seite träge: Auswerten «last» zeigt, was die
    Datenbank gerade tut. Läuft nichts und sie ist trotzdem träge, ist
    das Guthaben leer (in Supabase: Project Settings → Infrastructure
    → Disk IO balance) -- dann hilft nur Ruhe. «Nachbarschaft» mit
    «aufraeumen» beendet hängende Rechnungen. «Reiter prüfen» nennt je
    Reiter die Abfragen, auf die die Datenbank erst nach drei Sekunden
    antwortet (nicht, wie lange der Browser des Prüfers damit braucht).

Die nächste Grösse («Small», 2 GB, doppelte Plattenleistung) kostet
rund 5 Dollar im Monat mehr; das entscheidet Julian.

Der Test `datenbank-schonen.test.ts` wird rot, wenn eine dieser
Sicherungen verschwindet.

## Geplante Läufe starten Stunden zu spät

GitHub startet die Zeitpläne dieses Repositorys 6 bis 9 Stunden nach
Plan. Gemessen an «Baugesuche» (Plan 05:23 UTC), 4. bis 15. November:
Start zwischen 11:47 und 14:00 Uhr. Am 16. November waren darum weder
«Zählen» (03:47) noch «Reiter prüfen» (05:20) am Morgen gelaufen, und
die «Nachbarschaft» (23:30) hätte um sieben Uhr früh geschrieben statt
nachts.

  * Ein Zeitplan sagt nicht, wann ein Lauf arbeitet. Wer eine Tageszeit
    braucht, prüft die Uhr im Lauf selbst: `tools/zeitfenster.sh VON BIS`.
  * Dazu drei Einträge im Zeitplan, dreieinhalb Stunden auseinander,
    damit bei jeder Verspätung von 0 bis 9½ Stunden einer ins Fenster
    trifft. Wer daneben startet, endet nach Sekunden.
  * So laufen «Nachbarschaft» (22:00 bis 02:00 UTC), «Zählen» (03:40 bis
    07:40) und «Reiter prüfen» (04:30 bis 08:30). Von Hand gestartet
    gilt die Uhr nicht.
  * Was an keinem Tag ausfallen darf, hat einen Eintrag ohne Uhr:
    «Baugesuche» lädt mit dem Eintrag vom Vorabend nur am frühen Morgen
    (04:20 bis 08:20), mit dem Eintrag 05:23 immer.
  * Ob ein geplanter Lauf wirklich gelaufen ist, steht in der Liste der
    Läufe, nicht im Zeitplan.
  * Gemessen in der Nacht auf den 17. November, der ersten mit dieser
    Einrichtung: «Nachbarschaft» startete um 00:11, 02:35 und 05:02 UTC
    (in der Reihenfolge der Einträge 16:07, 19:37 und 23:07, also 8 h 04,
    6 h 58 und 5 h 55 zu spät), «Zählen» um 04:14 (Eintrag 21:57,
    6 h 17), «Reiter prüfen» um 04:49 (Eintrag 22:50, 5 h 59). Je ein
    Lauf traf sein Fenster; die übrigen endeten nach Sekunden.

Der Test `zeitplan.test.ts` rechnet die Abdeckung nach.

## CALC YOU LATER

Reiter `/calc`: Adresse eingeben, heraus kommen Landwert, Nutzfläche,
Kubatur, Baukosten, Erlös, Gewinn, Chancen, Risiken und eine
Kaufpreisempfehlung (Neubau und Bestand, die höhere Bewertung zählt).
Danach in 24 Stunden: Kaufpreis prüfen, freigeben, Angebot schreiben,
senden. Alles Weitere in `docs/calc-you-later.md`.

  * Comparis und Homegate werden nicht automatisch ausgelesen: beide
    verbieten es und sperren Programme aus (Wortlaut und Sperren am
    17. November nachgesehen, siehe Dokument). Die Seite öffnet die
    Suche, ein Mensch trägt ein. Automatisch nur über eine Quelle, die es
    erlaubt (Popety.io, dort besteht ein Abo; oder eine Lizenz).
  * Der Verkaufspreis je m² kommt aus den Preisen der letzten Jahre und
    steht begründet auf der Seite (17. November, Julian: «die Preise
    stimmen nicht ... begründe es auch»): Stadt Zürich amtlich je
    Quartier, übriger Kanton aus Preis je Wohnung ÷ Wohnfläche aus dem
    Register, geeicht an der Stadt. Methode in `docs/calc-you-later.md`,
    Daten `public/preise-reihen.json` (Ablauf «Preise», monatlich).
  * Nachbarn in einer Bauzone ohne Ziffer (Quartiererhaltung, Kernzone)
    lassen sich ankreuzen: sie rechnen mit der Dichte der Hauptparzelle,
    als Annahme gekennzeichnet (17. November: in Aussersihl waren alle
    Nachbarn gesperrt).
  * Reihenfolge und Uhr erzwingt die Datenbank (`kalkulation_schritt`).
    Wer die Migration ändert, lässt `tools/kalkulation-probe.sh` laufen.
  * Keine Zahl ohne Herkunft: amtlich, berechnet oder Annahme. Neue
    Chancen und Risiken sind Regeln mit Zahl, kein Sprachmodell.
  * Die Nutzfläche rechnet Julians Praxisformel (Grundstück × Ausnützung
    ÷ VG × (VG + 0.66) × 0.77), wie die Potenzialrechnung. Seine
    Vorgaben für Baukosten, Gewinn und Zuschläge stehen im Dokument;
    nicht eigenmächtig ändern.

## 3D-Karte

Am 17. November (Julian: «die 3D-Ansicht ist mega langsam und dann stockt
die ganze Webseite») waren es zwei Dinge, beide erst durch Messen gefunden:

  * Nach «Zurück» aus der 3D-Karte war die ganze Seite leer, seit dem
    3. November. Beim Verlassen wird zuerst der Viewer zerstört, ein
    späteres Aufräumen fasste ihn noch an, und der Fehler riss alles mit:
    der Auffang eines Bereichs verschwindet beim Wechsel mit ihm. Darum
    prüft jedes Aufräumen `isDestroyed()`, und um die ganze Anwendung
    liegt ein letzter Auffang (`App.tsx`).
  * Die Karte zeichnete auf einem Bildschirm mit doppelter Dichte 4.9 Mio.
    Bildpunkte mit vierfacher Kantenglättung (Cesiums Vorgabe) und weichen
    Schatten: gut fünfmal so teuer wie die sparsamste Einstellung. Teuer
    sind die Bildpunkte, nicht die Kacheln. Wie dicht, wie geglättet und
    ob mit Schatten, steht in `src/lib/karte3d-guete.ts`; kommt ein Gerät
    nicht mit, geht die Karte selbst Stufe um Stufe zurück und merkt sich
    das einen Tag.

Geprüft ist ein Bereich erst, wenn man ihn auch wieder verlassen hat,
ohne neu zu laden. «Reiter prüfen» lädt jeden Reiter frisch und sah den
Fehler in keinem Lauf; seither geht er einmal von der Karte in die
3D-Karte und mit «Zurück» wieder hinaus.

Der Browser der Prüfung hat keine Grafikkarte. Zeiten der 3D-Karte lassen
sich dort nur untereinander vergleichen, nicht als Tempo auf einem echten
Gerät angeben.

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
  * Akquise und Pipedrive braucht Julian nicht mehr (15. November: «die
    Akquise und Pipedrive brauche ich nicht mehr»): nichts mehr daran
    bauen, keine Verbindungen nach Pipedrive. Die Check-Seiten gehören
    nicht dazu: sie bleiben in Gebrauch (16. November: Wortlaut,
    Impressum, Kampagnenplan) und liegen im Zweig `akquise`.
  * Nicht fragen, was als Nächstes kommt (15. November: «wieso immer was
    als nächstes ... mach alle verbesserungen die dir einfallen ... ohne
    widerrede»): die offene Liste selber abarbeiten, das Wichtigste
    zuerst, und erst am Schluss berichten. Gefragt wird nur, was allein
    Julian liefern kann (Zugangsdaten, Geld, Angaben zur Firma).
  * Zahlen nur, wenn sie Menschen zählen (15. November: "stimmen die
    analytics?"): Besucher erst nach Tippen oder Scrollen, Bots nie,
    Tests nie. Nachprüfen mit Auswerten «besucher».

## Sprache

Code, Kommentare, Commits und Antworten auf Deutsch. Kommentare sagen,
*warum* etwas so ist, nicht *was* die Zeile tut.

## Geheimnisse

Zugangsdaten gehören weder in den Code noch ins Repository noch in den
Verlauf. `PIPEDRIVE_API_TOKEN` und `SUPABASE_DB_URL` liegen als
GitHub-Secrets und dürfen nie in einer Ausgabe landen -- die Helfer in
`tools/` geben deshalb nur den HTTP-Status aus, nie die Adresse. Der
`service_role`-Schlüssel gehört nie in den Browser.
