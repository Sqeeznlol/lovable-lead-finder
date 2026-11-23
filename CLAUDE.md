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
Löschen lässt sich ein Lead nur mit Passwort (21. November, Julian: «darf
aber keiner sehen das Passwort»): die Datenbank prüft es
(`anfrage_loeschen`, nach fünf Fehlversuchen eine Stunde gesperrt); im
Repository steht nur sein bcrypt-Prüfwert, nie das Passwort.
`anfrage-loeschen.test.ts` wird rot, wenn es irgendwo im Klartext steht.
Google Ads (21. November, Julian: «Tracker ... der permanent analysiert,
jeden Tag»): unter «Leads» die Tafel «Google Ads» je Kampagne (Besuche,
Ergebnis, Kontakt, Leads aus `werbung_tage`, Kosten aus `werbung_kosten`,
Rat nach den Regeln des Werbeplans, `src/lib/werbung.ts`). Der Ablauf
«Werbung täglich» prüft jeden Tag, ob die sieben Seiten antworten und den
Messpunkt der Conversion «Lead» (AW-18588031014 mit Label) ausliefern,
und wird sonst rot. Gerechnet wird nach Kosten je *gutem* Lead (22.
November): in der Lead-Ansicht «Guter Lead» oder «Kein guter Lead»
(`anfrage.guete`, ohne Urteil gilt er als gut); dazu die Monatsgrenze
von CHF 600, hochgerechnet aus den eingetragenen Kosten, und die
Suchbegriffe, die Leads bringen (`werbung_begriffe`).

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

Ohne Migration «Reiter prüfen» nicht von Hand starten: er läuft nach
«Was ist live» von selbst, und ein zweiter Start bricht den laufenden ab
(Gruppe `reiter`, 22. November: so standen beide Läufe abgebrochen da).

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
  * Die Suche («Alle W2 in Dietikon») liest jede Parzelle des Orts
    einzeln von der Platte: ohne Last 3.1 bis 3.7 Sekunden, während des
    Ladens am 19. November 9.4 Sekunden und dann Abbruch durch die Frist.
    Während eines Ladelaufs ist «Reiter prüfen» darum rot, ohne dass die
    Seite kaputt ist.

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
  * Unter CHF 10 Mio. Baukosten rechnet CALC 30 % teurer (18. November,
    Julian am Projekt YOMORI); bekannte Projektzahlen (Nutzfläche,
    Baukosten) gehen Formel und Register vor. Abgleich an YOMORI im
    Dokument: der Landwert hängt dort am Verkaufspreis, nicht an den
    Baukosten.
  * Ein bewilligtes Projekt geht der Formel vor (18. November, Julian:
    «nöd das Aurora rechnet und debi gits es bewilligts Projekt mit
    anderne Zahle»). Das Gebäuderegister führt projektierte, bewilligte
    und begonnene Bauten mit Wohnungen und Wohnflächen
    (`src/lib/bauprojekt.ts`); Machbarkeit und CALC zeigen sie über jeder
    Rechnung mit dem Knopf «Projekt ansehen» und rechnen bei «bewilligt»
    und «im Bau» mit dieser Wohnfläche. Das Amtsblatt zeigt eine
    Publikation nur bis zu ihrem Ablauf (ein Jahr); danach führt der
    Knopf ins Register. `bauprojekt.test.ts` wacht darüber.

  * Tim entscheidet (22. November, Julian: «es muss ein ganz simpler
    Workflow sein, Tim entscheidet immer schlussendlich»): einreichen,
    Tim legt den Preis fest (Urteil mit Grund, Firma und Vorlage), Tim
    verschickt. Der Weg durch vier Hände vom 19. November (David, Tim,
    Julian, Tim, David) gilt nicht mehr. Die Schrift gehört zur Firma
    (stimo Nunito Sans, Studer Helvetica wie Arial); gewählt werden nur Firma und
    Vorlage. Die Datenbank erzwingt Weg und Rolle
    (`20261122150000_tim_entscheidet_angebot.sql`, Rolle «visum»); wer was
    tut, steht nur in der Datenbank (`angebot_person`), nie im Repository,
    ebenso Namen und Adressen von Eigentümern. Hauptlayout ist die
    Arbergstrasse (stimo). Aus Tims Urteilen lernt die Seite einen
    Vorschlag neben der Empfehlung; Julians Formel bleibt. Vorlagen,
    Schriften und Farben in `docs/calc-you-later.md`.
    Lebensraum ist keine wählbare Vorlage mehr (20. November, Julian:
    «Lebensraum wegnehmen als Vorlage»; `FIRMEN_WAHL`). Das Luftbild des
    Deckblatts zeigt das Haus: Ausschnitt nach Grösse des Grundstücks, 80 bis
    160 m (`deckblattBreite`).
    Jede Kalkulation zeigt ihre Phase und bei wem sie liegt (22. November,
    Julian: «in welcher Phase ... wo ist sie aktuell?»): Phase 1 rechnen
    und einreichen (wer sie angelegt hat), Phase 2 Preis festlegen und
    Phase 3 verschicken (beide bei der Rolle «visum» aus «Wer was tut»),
    in jeder Zeile der Liste, in den Kennzahlen und im Titel der offenen
    Kalkulation. Die Namen kommen aus der Datenbank; ohne Eintrag steht
    keiner (`phase()` in `calc-ablauf.ts`, `calc-phase.test.ts`).
    Wer den Brief bekommt, kreuzt man in Phase 1 unter «Für das Angebot»
    an («Bekommt das Angebot» bei der Person). Seit dem 23. November
    (Julian: «wo muss ich das eingeben?») ist ein einziger Eigentümer aus
    dem Grundbuch vorgewählt, und «Zur Prüfung einreichen» ohne Empfänger
    springt dorthin und zeigt den Hinweis beim Kästchen
    (`calc-empfaenger.test.ts`).
    Studer schreibt genau wie seine Word-Vorlage (23. November, Julian:
    «die Studer Immobilien Vorlage muss genau so sein wie ich geschickt
    habe mit dem Layout, da ändert sich Besitzer, Preis und die
    Parzellen-Infos»): Logo oben rechts (`public/marken`), Arial 11
    (Helvetica, gleich breit), Leerzeilen in Times 10, die Eckpunkte mit
    1.5 Zeilen, das Datum eingerückt, der Fuss wörtlich. Es ändern nur
    Eigentümer («Familie …» bei gleichem Namen), Preis in Zahlen und
    Worten, Parzellen, dazu Datum, Eigentumsübertragung (leer: ein Jahr
    nach dem Brief) und Gültigkeit (sechs Wochen). Vorlagenwahl und
    eigener Wortlaut gelten bei Studer nicht (`studerBrief`). Wie Word
    setzt, ist nachgesehen, nicht geraten: den Mehrraum von 1.5 Zeilen
    legt Word unter den Text (an PDF gemessen, die Word schrieb).
    `studer-angebot.test.ts` prüft Wortlaut und Lage jedes Elements gegen
    die Masse der Vorlage. Die Vorlage selbst nennt echte Eigentümer und
    gehört nie ins Repository.

  * Der Bestand zählt mit dem Höheren aus Ertragswert und Flächenwert
    (20. November, Tim zur Schöneggstrasse 18: «10k/m² HNF ... manchmal
    ist der Bestand mehr wert als die zu günstig kapitalisierte Miete»).
    Der Wert je m² ist ein Anteil am Verkaufspreis des Quartiers (56.9 %:
    Mittel aus Tims 10'000 von 19'000 im Kreis 4 und 12'000 von 19'650 in
    Wollishofen); unter «Annahmen» änderbar, 0 schaltet ihn ab. Vorerst nur in der
    Stadt Zürich (Julian, 20. November: «mach das mal nur in der Stadt ZH»). Ein Haus mit Gewerbe (Register-Kategorie 1040) rechnet
    mit der ganzen Fläche aus dem Fussabdruck: das Register führt nur die
    Wohnungen (dort 242 von 458 m²). Ergebnis 4.45 Mio., Angebot 4.1 Mio.;
    `calc.test.ts` rechnet den Fall nach.
    Häuser ab Baujahr 1970 rechnen den Flächenwert überall, mit 71.9 % des
    Erlöses (21. November, aus Tims Prüfung der Rietwisstrasse 7, Uitikon,
    Baujahr 2019: «nach 1970 gebaut ... lange Lebensdauer ... im Bestand
    wesentlich mehr wert ... 12000/m²»; `flaechenAnteil`). Was Menschen in
    CALC zum Preis schreiben, liest der Ablauf «CALC lesen», verschlüsselt,
    weil die Protokolle öffentlich sind. «Kalkulationen neu rechnen» leitet
    auch den Verkaufspreis neu her, in der Stadt Zürich je Quartier
    (21. November, Julian: «Quartierpreise in Zürich nehmen»); im Browser
    der Prüfung war der Dienst der Stadt gesperrt, darum standen Entwürfe
    mit dem Preis der ganzen Stadt da.
    Toplage (22. November, Julian: «mach den Lagezuschlag für Toplagen»):
    der Knopf «Toplage» unter «Annahmen» hebt den Verkaufspreis je m² um
    20 % (`TOPLAGE`, aus Tims Mutschellenstrasse 49: 5.4 gegen 4.53 Mio.,
    +19 %); Neubau, Baukostenstufe und Flächenwert folgen, der Ertragswert
    nicht. Ein Mensch setzt ihn, Aurora rät nicht; er steht als Annahme
    unter den Chancen.
    Ändert sich die Rechnung, rechnet der Ablauf «Kalkulationen neu rechnen»
    alle Entwürfe neu («zeigen», dann «schreiben»); Eingereichtes bleibt.

  * Unter jeder Kalkulation, schon im Entwurf, steht «Stimmt der Preis?»
    wie ein Chatfenster (20. November, Julian zur Schöneggstrasse 18: CALC
    1.41 Mio., Angebot 4.1 Mio., «weil das und das, dass auch Aurora den
    Algo lernt»): richtig so, zu tief oder zu hoch, der richtige Preis und
    warum. Die Empfehlung, gegen die geurteilt wird, hält die Datenbank fest
    (`20261120120000_kalkulation_bemerkung.sql`); der Vorschlag aus den
    Urteilen steht neben der Empfehlung, Julians Formel bleibt.
    `calc-bemerkung.test.ts` und `tools/kalkulation-probe.sh` wachen darüber.

  * Gutachten (23. November, Julian zum Markt- und Mietwertgutachten
    einer Liegenschaft: «Bitte in CALC einpflegen. Wenn wir Daten haben
    wie hier anbei ... bitte hochladen bzw. extrahieren»): in CALC unter
    «Bestand und Mieten» der Knopf «Gutachten hochladen (PDF)». Gelesen
    wird im Browser (pdf.js, erst beim Hochladen geladen); die Datei geht
    an keinen Server, gespeichert werden nur die Zahlen
    (`eingaben.gutachten`). Gelesen werden nur Zahlen mit Bezeichnung:
    Marktwert (der gerundete), Stichtag, Kataster, Grundstück, Zone,
    Baujahr, Volumen, Nutzfläche, Mietzins, Mietwert, Kapitalisierung,
    Ertragswert. Namen von Eigentümern liest der Leser nicht. Nutzfläche
    und Mietzins gehen in die Rechnung, wo nichts von Hand steht; der
    Marktwert steht als Vergleich neben der Empfehlung, auch bei Tim in
    Phase 2, Julians Formel bleibt (`src/lib/gutachten.ts`,
    `gutachten.test.ts`). Ein Gutachten nennt echte Eigentümer und gehört
    nie ins Repository, auch nicht als Testdatei.
    Derselbe Knopf nimmt einen ÖREB-Auszug (23. November, Julian zum
    Auszug eines Grundstücks in Langnau am Albis: «das auch einpflegen»):
    Grundstück, E-GRID, Fläche und je betroffenes Thema die Tafel «Typ,
    Anteil» (Zone mit Kürzel, Wald, Gewässerraum, Baulinien, Lärmstufe,
    überlagernde Nutzungen), rechtskräftig oder mit Vorwirkung
    (`src/lib/oereb.ts`, `oereb.test.ts`). Die Rechnung ändert er nicht;
    weicht seine Fläche von der der Kalkulation ab, steht es dabei.

  * Mieterspiegel aus dem Gebäuderegister (20. November, Tim: «Anzahl
    Wohnungen, deren Grösse und die inserierten Preise»): CALC liest jede
    bestehende Wohnung mit Nummer, Stockwerk (WSTWK laut Merkmalskatalog:
    3100 Parterre, 3101 der 1. Stock), Zimmern und Fläche; deren Summe ist
    die vermietbare Fläche. Die Miete je Wohnung trägt ein Mensch ein
    (Mieterspiegel des Eigentümers oder Inserat dieser Adresse), sonst
    rechnet die Zeile mit der Miete des Kantons. Inserate von Comparis und
    Homegate liest Aurora weiterhin nicht automatisch.

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

## Adressen beim Bund

Am 18. November kannte die Adresssuche des Bundes keine Schweizer
Adresse mehr, nur Liechtenstein, auch auf map.geo.admin.ch: das Amtliche
Gebäudeadressverzeichnis dahinter war geschrumpft. CALC YOU LATER, die
Checker, Karte, 3D-Karte, Import und Baugesuche fanden nichts. Seither
fragt jede Adresssuche zugleich die Volltextsuche im Gebäuderegister
(`src/lib/adresssuche.ts`, im Zweig `akquise` dieselbe Datei). Wer
Adressen sucht, geht über diesen Helfer; `adresssuche.test.ts` wird rot,
wenn eine Stelle ihn umgeht.

## Parzellen ZH, TG, LU und ZG

Julian, 18. November: «schau, dass wirklich alle Parzellen drin sind
von ZH TG LU ZUG, mit allen Daten». Massstab ist die Amtliche
Vermessung; Auswerten «parzellen-vier» gleicht EGRID für EGRID ab und
zählt je Angabe (`tools/parzellen_vergleich.py`).

  * «Kanton laden» rechnet auf dem Runner (Hauptzone je Parzelle,
    Register je Parzelle) und schreibt nur über `tools/in_portionen.sh`:
    Sitzungstabelle statt Zwischentabelle in public, Frist und Pause je
    Stück, Abbruch, wenn die Datenbank träge wird. Geschrieben wird nur,
    was fehlt; ein abgebrochener Lauf wird einfach wiederholt.
  * Eine Lieferung kann aus vielen Dateien bestehen (Zug: eine je
    Gemeinde). Immer alle lesen, nie die erste mit `head -1`.
  * Das Register hängt Häuser auf Baurecht an das Baurecht, nicht an
    die Parzelle darunter (Zug: 747 EGRID). Parzellen aus dem Register
    entstehen darum nur, wo die Vermessung nicht frei ist
    (`gwr-anlegen`, Luzern).
  * Luzern gibt die Vermessung nur gegen Gebühr ab (Geodatenshop:
    120'601 Liegenschaften). Frei sind Register und Nutzungsplanung:
    die bebauten Parzellen mit Adresse und Haus, die Zone am grössten
    Haus als Annahme, ohne Fläche und Umriss. Ob gekauft wird,
    entscheidet Julian.
  * Die Ziffer steht ausserhalb Zürichs nicht im Zonennamen, und ohne
    Ziffer rechnet kein Potenzial. Zug liefert die Ausnützungsziffer am
    Zonentyp (Schritt `ziffern`, `tools/kanton_ziffern.py`: 13'080
    Parzellen); Thurgau liefert keine Ziffer, Luzern eine ohne Angabe,
    welche es ist. Die Baumassenziffer steht in Zug nur bei Arbeits- und
    Mischzonen, die ohnehin ausgeschlossen sind.
  * Mit Potenzialrechnung braucht ein Stück von 2000 Zeilen rund 13
    Sekunden, dazu dieselbe Pause: 221'730 Zürcher Zonen dauerten 93
    Minuten. Bei solchen Läufen auf das Ende warten, nicht auf eine
    Schätzung.

Gemessen am 19. November, 02:45 UTC (Auswerten «parzellen-vier»):

    Kanton  amtlich  fehlen  Zone    Umriss  Adresse  Potenzial
    ZH      391'436  0       99.2 %  99.1 %  57.5 %   42.6 %  (vorher Zone 43 %)
    TG      137'274  0       100 %   99.9 %  53.3 %    1.7 %
    LU       77'048  7       99.3 %  0       100 %     0      (nur bebaute)
    ZG       24'646  0       99.9 %  100 %   66.0 %   40.0 %  (vorher 0)

Die 7 in Luzern haben im Register keine gültige EGRID (sechsmal zwölf
Ziffern ohne «CH», einmal «0»). Adressen fehlen dort, wo kein Haus
steht: das Register kennt nur Gebäude. Potenzial im Thurgau braucht
die Ziffern der Baureglemente (die Lieferung hat keine), in Luzern die
Vermessung.

## Parzellen nach Wunsch

Reiter «Parzellen nach Wunsch» (19. November, Julian: «mache ein extra
Ordner bei Aurora ... macht alle rein, die diese Kriterien haben»): feste
Ordner mit Parzellen nach einem Kriterium, gerechnet auf dem Runner, in
die Datenbank nur als Ergebnis (`wunsch_ordner`, `wunsch_parzelle`). Der
erste: über 3'000 m², mindestens zur Hälfte in der Bauzone, in den
Gemeinden, die Julian nennt (OW, NW, BE, SZ, UR, LU). Brunnen ist ein Dorf
in Ingenbohl; gerechnet wird die Gemeinde.

  * Die Fläche ist aus dem Umriss der Vermessung beim Bund gerechnet
    (die Kantone geben die amtliche nicht frei), ohne Baurechte; die Zone
    ist die harmonisierte des Bundes (Bauzonen Schweiz).
  * Der Dienst des Bundes gibt höchstens 200 Treffer; beim Blättern kamen
    Doppelte, andere fehlten (Nidau: 553 Treffer, 394 verschieden). Eine
    volle Kachel wird geviertelt, nie geblättert.
  * Zur Gemeinde gehört eine Parzelle über ihre Lage, nicht über die
    Nummer des Grundbuchkreises (Bern und Luzern zählen anders).
  * Nachweis je Gemeinde: alle Parzellen zusammen ergeben die
    Gemeindefläche. `parzellen-nach-wunsch.test.ts` zählt nach.
  * «Nur erschlossenes Bauland für Wohnen» (Julian, 19. November): Wohn-,
    Misch- und Zentrumszonen; erschlossen laut Kanton (Stand der
    Erschliessung auf geodienste.ch, frei als Karte in OW und UR, teils
    NW), sonst belegt durch ein bestehendes Wohnhaus im Register. Bern,
    Schwyz und Luzern (bis 2029) veröffentlichen den Stand nicht; ihre
    unbebauten Parzellen stehen im Ordner «Unbebaut, Erschliessung
    erfragen». Nie als erschlossen ausgeben, was keine Quelle belegt.
  * Zwei Werte der Adresse im selben Tipp (Gemeinde wählen, Zone
    zurücksetzen) überschrieben sich, und der Filter tat nichts
    (19. November). `use-url-wert.ts` baut seither auf dem zuletzt
    geschriebenen Stand auf; `use-url-wert.test.tsx` spielt es nach.
  * Favoriten (20. November, Julian: «Button ... ausfindig machen, dann ist
    es wo, wo man die Daten ausfüllen kann, aber weg von der Filterseite»):
    «Ausfindig machen» legt eine Parzelle in `wunsch_favorit`, mit ihren
    Angaben, damit sie eine neue Lieferung des Ordners übersteht. Dort stehen
    Stand, Eigentümer und Kontakt (nur in der Datenbank); in der Filterliste
    erscheint sie nicht mehr.

## Anrufen

Julian, 22. November: «die welche System sagt gut und ich dann Namen
gespeichert habe, da soll dann Tim anrufen». Im Cockpit steht die Liste
«Anrufen»: Objekte mit gerechneter Marge, bei denen ein Mensch den
Eigentümer eingetragen hat (`owner_name` ist die Handeingabe,
`eigentuemer_name` die Abfrage beim Grundbuch), ohne erfasstes Gespräch
(`anruf`) und ohne Stand «Exportiert» (alte Akquise), das zuletzt
Bearbeitete zuerst. Mit Nummer der Knopf «Anrufen», sonst «Nummer suchen»
(tel.search am Wohnort des Eigentümers). Wer «Entscheidet und verschickt»
(Tim), liest die Zahl im grossen Satz des Cockpits. In der Objektansicht
steht unter «Maps» und «Tel.search» der Knopf «… anrufen». Ist das
Gespräch erfasst, fällt das Objekt aus der Liste (`src/lib/anrufen.ts`,
`anrufen.test.ts`). Testdaten (TEST im Namen) stehen nie darin.

## Gestaltung

Wie die Seite aussieht, steht in `DESIGN.md` -- vor jeder Arbeit an der
Oberfläche lesen. Seit dem 22. November gilt dort «Der rote Faden»
(Julian: «ein bisschen Ruhe reinbringen ... ein klarer Weg»): Navigation
nach dem Weg Lead → Kalkulation → Angebot, Erklärungen eingeklappt, auf
dem Handy Listen statt breiter Tabellen. Das Cockpit ist das Muster für jede Seite (Julian:
"so ist es perfekt"): Luftbild-Bühne, ein Satz mit Zahl,
Kennzahlenleiste, Tafeln mit Grafik, rechte Spalte mit Karten, Bewegung,
Handy-Fassung. Gebaut wird mit `<Seite>` aus `src/components/rahmen.tsx`.

## Arbeitsweise mit Julian (seine Rückmeldungen, gesammelt)

  * Kurz und klar antworten, keine Extrazeilen; Empfehlung statt Auswahl.
  * Nur Hochdeutsch, ohne englische Fachwörter (18. November: «schreib
    nur hochdeutsch»): Suchbegriffe statt Keywords, auf GitHub gestellt
    statt gepusht, auf der Seite statt live. Bezeichnungen aus Google Ads
    nur in Anführungszeichen, wie sie dort stehen.
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
