# Die Nacht vom 3. auf den 4. November

Julian ging um 22 Uhr schlafen: "Ich will morgen aufwachen und alles
erledigt haben." Hier steht, was gebaut, was gemessen und was geprüft
ist -- und was nur er entscheiden kann. Reihenfolge wie in der Liste
vom Abend (Punkte 1 bis 26).

## Zuerst: was Julian am Morgen tun muss

Alles unten ist gebaut, getestet und live. Was eine Änderung an der
Datenbank braucht, liegt als Migration bereit -- die Sicherheitsprüfung
lässt mich die Produktionsdatenbank nicht selbst ändern. In der
GitHub-App: Aktionen → Migrationen → Workflow ausführen, Branch `main`,
"einspielen", Text `20261103` -- ein Durchgang für alle zehn (siehe Tabelle):

| Migration | Was sie tut |
|---|---|
| `20261103190000_merkliste_stand_karte` | Stand und Notiz je Gebäude in Merklisten, Lage der Gebäude für die Karten (Spalten `gebaeude.e/n`) |
| `20261103200000_gelegenheiten_potenzial` | Entwicklungspotenzial in Kundenportfolios als Gelegenheit (Punkt 1) |
| `20261103210000_portfolio_bericht` | Die Abfrage für den Portfolio-Bericht (Punkt 2, 12) |
| `20261103220000_investor_abgleich` | Gemerkte Treffer je Investorprofil, Off-Market-Mandat (Punkt 3) |
| `20261103230000_kennzahlen` | Ausgangswerte und Ziele der Kennzahlen, Stand der Daten (Punkt 5, 21) |
| `20261103240000_gemeinde_schreibweise` | 179 Parzellen "X ZH" auf eine Schreibweise, Gemeindeliste neu (Punkt 6) -- die einzige, die bestehende Daten ändert |
| `20261103250000_eigentuemer_akteure` | Eigentümer als Akteure mit allen Parzellen (Punkt 9) |
| `20261103260000_reaktivierung_ereignis` | "Wieder ansprechen" nach einem Baugesuch (Punkt 11) |
| `20261103270000_anrufer_anweisung` | Anweisung an die Anrufer je Kunde; Maklermandat und Verkauf als Anlass (Punkt 13, 19) |
| `20261103280000_parzellen_kacheln` | Vektorkacheln für die Karte, Server-Teil (Punkt 14) |

Der Ablauf nimmt mit Text `20261103` alle zehn in der Reihenfolge der
Namen und überspringt die zwei vom Abend (170000, 180000), die schon
drin sind -- nachgelesen im Ablauf: was als "bereits eingespielt"
verbucht ist, läuft nicht noch einmal. Jede ist lokal in einer
Testdatenbank mit PostGIS durchgespielt; keine der neun ab 200000
greift auf etwas aus 190000 zu. Bis sie eingespielt sind, sagen die
betroffenen Seiten, welche Migration fehlt, und zeigen den Rest. Der
tägliche Lauf Baugesuche (5.23 Uhr) ruft die neuen Funktionen schon
auf und übergeht sie, solange ihre Migration fehlt -- er bleibt grün
(lokal geprüft: psql läuft weiter, Rückgabe 0).

Danach den Ablauf **Gebäude** mit "schreiben" starten: Er lädt das
Register neu, diesmal mit der Lage jedes Gebäudes. Erst danach zeigen
die Karten der Gebäudesuche und der Merklisten Zürcher Gebäude --
Zürcher Parzellen haben im Bestand keinen Umriss (gemessen: 0 von
394'917), die Lage kommt vom Gebäude.

## 1. Entwicklungspotenzial erkennt das System selbst -- gebaut

Tims Kernsatz: "The system needs to identify opportunities rather than
simply store information." Den Anlass "Ausnützungsreserve" gab es in
der Datenbank, erzeugt hat ihn nichts. Jetzt prüft die Funktion
`gelegenheiten_potenzial` täglich (mit den Baugesuchen, 5.23 Uhr) jede
Parzelle eines Kundenportfolios nach drei Regeln -- Reserve ab 200 m²,
Ersatzneubau (50 Jahre und älter, Zone unter 60 % genutzt), gemeinsame
Entwicklung mit einem Nachbarn -- und legt je Kunde und Parzelle eine
Gelegenheit an, mit Begründung in Zahlen und erklärbarer Priorität.
Die Regeln stehen in `docs/potenzial-regeln.md`, zum Prüfen für dich
und Tim.

Geprüft: lokal mit fünf Parzellen und drei Nachbarn (vier
Gelegenheiten, exakt die erwarteten; zweiter Lauf legt nichts doppelt
an). In den Gelegenheiten gibt es einen Filter nach Anlass; die
Parzelle des Kunden war bisher bei "Baugesuch im Portfolio" nicht
sichtbar (Rolle 'im portfolio'), jetzt schon.

Gemessen auf dem Server: 152'827 Zürcher Parzellen haben eine
Potenzialrechnung, 7'140 mit Reserve ab 200 m². Die zwei echten Kunden
haben 28 Parzellen, keine davon mit Reserve ab 200 m² und keine mit
ermittelten Nachbarn -- bei ihnen entsteht heute nichts, bei den
Demo-Kunden (3'597 Parzellen, 782 mit Reserve) einiges. Zählen ohne zu
schreiben: Aktionen → Auswerten → `potenzial-gelegenheiten`.

Braucht: Migration `20261103200000`.

## 2. Portfolio-Bericht je Kunde -- gebaut

Gelegenheiten → Kunde wählen → "Portfolio-Bericht". Eine Abfrage
(`portfolio_bericht`) liefert Parzellen, Reserve, Marge, Gebäude und
Heizungen aus dem Register, die grössten Reserven, Ersatzneubau-
Kandidaten, Nachbarn zum Zukauf (mit Reserve oder bekanntem
Eigentümer, ohne Namen), Baugesuche der letzten zwölf Monate und die
Gelegenheiten mit Stand und Ergebnis. Das Blatt ist im Stil der Seite
(Bühne, Kennzahlen, Tafeln) und geht per "Als PDF" raus; sehen darf es,
wer den Kunden sehen darf.

Geprüft: lokal mit einem Kunden, vier Parzellen, zwei Nachbarn, drei
Gesuchen (alle Teile richtig, fremder Kunde → leer); im Browser auf
Desktop und iPhone; als A4-PDF zwei Seiten.

Braucht: Migration `20261103210000`.

## 3. Off-Market-Mandat aus dem Investorprofil -- gebaut

Auswertung → Investoren. Der Abgleich Suchprofil gegen Bestand läuft
jetzt in der Datenbank (`investor_abgleich`), täglich und auf
Knopfdruck, nach Lage (Gemeinde, beide Schreibweisen) und Objektart.
Er merkt sich je Profil, was wann gefunden wurde: neue Treffer stehen
als "neu" da. "Als Mandat anlegen" macht den Investor zum Kunden
(Produkt Acquisition) und jeden Kandidaten (höchstens 30, nach Marge)
zu einer Gelegenheit "Kandidat für …" -- das Team arbeitet sie wie
jede andere ab, und der Portfolio-Bericht zeigt sie dem Investor.
Investoren lassen sich auch von Hand erfassen (bisher nur aus einem
Gespräch oder einer Anfrage über /investor).

Gemessen: heute 0 Investorprofile im System. Das Budget bleibt
unberücksichtigt, weil der Bestand keinen Preis führt -- die Seite
sagt das bei jedem Treffer.

Braucht: Migration `20261103220000`.

## 5. und 21. Kennzahlen nach Tim, Stand der Daten -- gebaut

Auswertung → "Kennzahlen nach Tims Abschnitt 8": seine Tabelle mit
denselben Zeilen (Datenqualität, Portfolioabdeckung, Baugesuch-Alarme,
Arrondierung, Akquise, Effizienz, Investoren, Datenaktualität),
gezählt statt geschätzt. "Ausgangswerte festhalten" schreibt die
heutigen Werte einmal mit Datum, das Ziel tragt ihr je Zeile ein;
danach steht bei jeder Zahl die Veränderung seit dem Ausgangswert und
"erreicht", wenn das Ziel steht. Die Researchzeit je Lead steht als
"nicht messbar" da -- Zeiten werden nirgends erfasst.

Darunter der Stand jeder Quelle (Register, Baugesuche, Nachbarschaften,
Lage, Annahmen der Potenzialrechnung) mit Alter und "veraltet", wenn
die erwartete Frist vorbei ist.

Gemessen heute: Eigentümer bekannt bei 114 von 532'131 Parzellen
(0.02 %), 36 mit Telefon; 28 überwachte Parzellen bei 2 echten Kunden;
453 Gelegenheiten, davon 1 geprüft, keine abgeschlossen; 0 Gespräche,
0 Suchprofile. Das sind die Ausgangswerte -- sie sagen vor allem, dass
die Plattform bisher gebaut, aber kaum benutzt wurde.

Braucht: Migration `20261103230000`. Offen für dich: Das Gebäuderegister
monatlich automatisch neu laden (Ablauf "Gebäude" mit Zeitplan) hat die
Sicherheitsprüfung abgelehnt, weil ein Zeitplan selbständig in die
Produktion schriebe. Wenn du das willst: in `.github/workflows/gebaeude.yml`
unter `on:` einen `schedule`-Eintrag und beim Schritt "Schreiben"
`|| github.event_name == 'schedule'` -- oder einmal im Monat von Hand.

## 6. Datenqualität -- gebaut, Rest gemessen

- **Gemeinden in zwei Schreibweisen:** gemessen sind es 179 Parzellen
  mit "X ZH" (nicht 2'300 -- diese Zahl stammte aus der veralteten
  Gemeindeliste). Die Migration `20261103240000` schreibt sie auf die
  Schreibweise der übrigen ("Küsnacht (ZH)", "Pfäffikon") und rechnet
  die Gemeindeliste neu. Lokal geprüft: beide Fälle, Thurgau bleibt
  getrennt.
- **Aadorf als Zürich:** im Bestand gibt es das nicht mehr (alle 2'441
  Aadorfer Parzellen stehen im Thurgau); die 12 standen nur noch in der
  veralteten Gemeindeliste. Dieselbe Migration behebt das.
- **997 Gebäude ohne Parzelle im Bestand:** nicht behoben. Es sind
  Register-Gebäude, deren Parzelle im Bestand fehlt; nachladen heisst
  Amtliche Vermessung holen (Ablauf "Zürcher Parzellen"), und das
  gehört zu Aufgabe 27, die seit dem 2. November offen ist.

## 8. Sicherheit -- gemessen: dicht

Nachgesehen auf dem Server (Ablauf Auswerten → regeln): Ohne Anmeldung
darf der öffentliche Schlüssel genau eines -- eine Anfrage einreichen
(/bewertung, /potenzial, /investor). Alle 15 geprüften Tabellen
antworten ohne Anmeldung mit 401. Die Migration `anon_dicht` vom
1. November ist eingespielt und wirkt; der Satz in `docs/plattform.md`,
die Datenbank lasse anonymes Lesen zu, ist seit dem 1. November
überholt. Sechs Tabellen ohne Zeilenschutz (gwr_eingang, gwr_gebaeude,
gwr_kodes, schema_migrationen, verschnitt_tg, zonentypen) enthalten
nur Registerdaten und Zonen, keine Personen -- und ohne Anmeldung sind
auch sie gesperrt.

Nicht nachgesehen (geht von hier nicht): ob die Edge Functions
(tel-search, pipedrive-push, sms-confirmation) auf dem Server die
Anmeldung prüfen. Supabase tut das in der Voreinstellung; wer eine
Funktion mit `--no-verify-jwt` ausgerollt hat, hat sie geöffnet. Das
steht in Supabase → Edge Functions → Details.

## 9. Eigentümer als Akteure -- gebaut

`eigentuemer_verdichten` macht aus dem Text in der Parzellenzeile
(owner_name, owner_name_2) Akteure mit Art (Person, Firma, Institution,
Erbengemeinschaft -- aus dem Namen) und Eigentum-Beziehungen mit Quelle
"bestand"; "Müller" und "Mueller" werden einer, "Swisscanto" steht
einmal da. Läuft täglich; was aus einem Auszug oder Gespräch schon da
ist, bleibt. Im Objektfenster steht neu "… gehört auch · N Parzellen"
mit den übrigen Parzellen desselben Eigentümers; die Eigentümersuche
findet über den Akteur alle, nicht nur dieselbe Schreibweise.

Geprüft: lokal mit sieben Parzellen (Doppel in Gross/klein und
Umlaut werden einer, "unbekannt" fällt weg, zweiter Lauf legt nichts
an); im Browser auf Desktop und iPhone.

Braucht: Migration `20261103250000`.

## 11. Reaktivierung über Ereignisse -- gebaut

Wer im Gespräch "nein", "später" oder "nur zum richtigen Preis" gesagt
hat, bekommt eine Gelegenheit "Wieder ansprechen: …", sobald nach dem
Gespräch ein Baugesuch auf seiner Parzelle oder nebenan publiziert
wird (`gelegenheiten_reaktivierung`, täglich). In der Auswertung →
Reaktivierung steht bei so einem Objekt "Baugesuch seit dem Gespräch:
jetzt anrufen" mit Link zur Gelegenheit, statt des nächsten Schritts
nach Datum. Geprüft lokal (nur das "nein" mit Gesuch danach ergibt
eine Gelegenheit; ein "ja" und ein Gesuch vor dem Gespräch nicht).

Braucht: Migration `20261103260000`. Gemessen: heute 0 Gespräche im
System -- die Funktion wartet auf die ersten.

## 13. Anrufer-Ablauf je Projekt -- gebaut

Gelegenheiten → Kunde wählen → rechts "Anrufer": die Anweisung an die
Anrufer für diesen Kunden (was man sagt, in wessen Namen, was nicht),
und der Knopf "N offene Gelegenheiten anrufen". Er öffnet den
Akquise-Modus nur mit den Parzellen der offenen Gelegenheiten dieses
Kunden (Kandidaten eines Mandats, Nachbarn einer Arrondierung, Auslöser
eines Baugesuchs -- nie die eigenen Parzellen des Kunden), mit der
Anweisung oben. Was der Anrufer speichert, fliesst zurück: die
Gelegenheit geht auf "in Bearbeitung", im Ergebnis steht "3.11.2026:
Eigentümer ermittelt" -- und damit im Portfolio-Bericht.

Geprüft im Browser (Desktop, iPhone): Anweisung speichern, Sprung in
den Modus, Eigentümer speichern, Gelegenheit nachgeführt.

Braucht: Migration `20261103270000`.

## 19. Maklermandat und Verkauf als eigene Gelegenheit -- gebaut

Sagt jemand im Gespräch "lieber mit Makler", entsteht eine Gelegenheit
"Maklermandat anbieten: …" (Anlass Maklermandat); sagt er "will
verkaufen", eine "Verkaufsbereit: …" (Anlass Verkauf, Priorität 12).
Je Parzelle und Anlass eine offene; beide laufen wie jede Gelegenheit
mit Zustand, Zuständigkeit und Ergebnis, statt nur als Kategorie in
der Reaktivierungsliste zu stehen. Dieselbe Migration wie Punkt 13.

## 4. und 15. Quellen für Entscheide, Zonenänderungen, Marktereignisse -- geprüft, soweit erreichbar

Nachgesehen mit dem eigenen Ablauf (Auswerten → baugesuche, 4. November,
3.04 Uhr aktualisiert): Der Zürcher Datensatz "Baugesuche im Kanton
Zürich" hat 41 Spalten -- Publikation, Einsprachefrist, Ablauf,
Gemeinde, Bauherrschaft, Projektverfasser, Beschreibung, Adresse,
Kataster, **Bauzone** (`districtCadastre_relation_buildingZone`) --
aber **kein Feld für den Entscheid**. Bewilligt oder abgelehnt gibt
diese Quelle nicht her; täglich kommen nur eingereichte Gesuche. Der
Datensatz verweist auf die "Dokumentation Amtsblattportal API"
(amtsblattportal.ch/docs/api) als zweiten Weg -- dort erscheinen
Bauentscheide als eigene Publikationsart, soweit die Gemeinde sie
publiziert. Das ist der nächste Schritt, wenn ihr "bewilligt" wollt:
eine Anbindung des Amtsblattportals, Gesuch und Entscheid über die
Publikationsnummer verbunden.

Zonenänderungen und Handänderungen konnte ich von hier nicht prüfen:
opendata.swiss und maps.zh.ch sind aus dieser Sitzung nicht erreichbar
(DNS), und die Runner bei GitHub benutze ich nur für unsere eigenen
Quellen. Offen für euch: ob der Kanton die öffentlichen Planauflagen
(Nutzungsplanung) maschinenlesbar anbietet, und ob das Amtsblattportal
Handänderungen führt (im Kanton Zürich werden sie nicht publiziert;
Grundbuchämter geben sie nicht als Datensatz heraus -- das ist mein
Wissensstand, nicht nachgesehen).

## 12. Kundenzugang -- gebaut, auf dem bestehenden Portal

Das Kundenportal gibt es seit dem 1. November unter /fonds (für
Fondsleitungen, eigene Anmeldung, eigenes Team, nur eigene Daten).
Neu darin der Bereich **Bericht**: derselbe Portfolio-Bericht wie in
Bauraum, mit Gelegenheiten, Stand und Ergebnis -- online und als PDF.
Ein institutioneller Kunde (Helvetica, SFP, Swisscanto) bekommt damit
ein Team mit Art "fonds", ein Konto darin, und sieht Karte, Potenziale,
Baugesuche, Gespräche, Suchprofile, Kalender und seinen Bericht.
Geprüft im Browser (Desktop, iPhone).

## 16. und 17. Lernende Priorisierung, beide Seiten -- Messung gebaut

Lernen kann nur, was gemessen ist: Auswertung → "Erfolg je Anlass"
zählt je Anlass, wie viele Gelegenheiten abgeschlossen oder verworfen
wurden, mit Quote. Heute: 453 Gelegenheiten, 1 geprüft, 0 entschieden
-- es gibt noch nichts zu lernen. Sobald Entscheide da sind, lässt sich
die Quote je Anlass und Gemeinde in die Priorität einrechnen; das habe
ich bewusst nicht vorweggenommen.

Beide Seiten: Bei einer Gelegenheit "Verkaufsbereit" oder
"Maklermandat" stehen die Investoren, deren Suchprofil Lage und
Objektart nennt (dieselben Regeln wie der Abgleich in der Datenbank,
nur umgekehrt).

## 14. Karte für die ganze Schweiz -- Server-Teil gebaut, Browser noch nicht

`parzellen_kachel(z, x, y)` liefert die Parzellen eines Kartenfelds als
Mapbox Vector Tile (PostGIS, ST_AsMVT), lokal geprüft (227 Bytes mit
Parzelle, 0 daneben, unter Zoom 13 leer). Der Browser bleibt vorerst
beim bisherigen Weg (GeoJSON je Ausschnitt): Zürcher Parzellen haben
im Bestand keinen Umriss, eine Kachel wäre dort leer. Sobald die
Zürcher Umrisse da sind (Aufgabe 27, Amtliche Vermessung), lohnt sich
die Umstellung der Karte auf die Kacheln -- und erst dann trägt sie
26 Kantone. Braucht: Migration `20261103280000` (schadet vorher nicht).

## 7. Tempo -- gemessen, Entscheidung bei dir

Indizes, die nie benutzt werden: die grössten sind 5 MB
(verschnitt_tg_egrid_idx), 3 MB, 3 MB -- zusammen unter 15 MB.
Löschen bringt nichts. Die Datenbank ist 950 MB von 1'107 MB, die
Tabelle properties allein 454 MB; der Cache trifft 72 %. Das ist die
Ursache für "lädt langsam", und sie lässt sich nur mit einem grösseren
Supabase-Tarif beheben. Das kostet Geld, darum deine Entscheidung.

## 10. Bezug der Eigentümerdaten -- Beschaffungsfrage

Gemessen: 114 von 532'131 Parzellen haben einen Eigentümer (0.02 %),
nach zwei Monaten Abfragen über die Portale mit SMS. Tims Produkte
(Monitor, Arrondierung) brauchen die Eigentümer der Nachbarn sofort,
nicht in Wochen. Zu klären, je Kanton: Gibt es einen lizenzierten
Bezug (z.B. über die Grundbuchämter, Terravis oder einen Datenhändler),
was kostet er je Abfrage oder je Jahr, und erlaubt die Lizenz
Speichern und Weitergabe an Kunden? Das ist keine Programmierarbeit.
Bis dahin: Eigentümer portfolioweise nachfüllen, wie heute.

## Die 3D-Karte -- geprüft: die Häuser stehen richtig

Du wolltest wissen, ob die Häuser auch von der 3D-Seite her logisch
sind. Drei Orte, je drei Blickwinkel (schräg von Süden aus 260 m,
senkrecht aus 420 m, nah von Westen aus 120 m), mit Gelände, Luftbild
und Gebäuden vom Bund und den Zonen vom Kanton -- gerendert ohne
Grafikkarte, darum zwei bis sechs Minuten je Ort:

- **Kloten, Bahnhofstrasse** (flach, 816 Gebäude im Bild): jedes Haus
  steht auf dem Boden, Sattel-, Walm- und Flachdächer wie im Luftbild,
  die Zonen liegen auf dem Boden und nicht auf den Häusern, ihre
  Grenzen folgen den Parzellen.
- **Küsnacht, Seestrasse** (Hang, Tobel, See; 1'209 Gebäude): am Hang
  sitzen die Häuser auf dem Gelände, keines schwebt, keines steckt im
  Boden; das Küsnachter Tobel ist als Wald und Gewässer da, die
  Kernzone am Dorfbach, öffentliche Bauten und Freihaltezone wie im
  Zonenplan. Einzelne Häuser stehen über dem blauen Gewässerband --
  das Band ist die Zone aus dem Zonenplan, das Haus kommt vom Bund; ob
  der Bach dort offen oder eingedolt ist, habe ich nicht nachgesehen.
- **Zürich, Niederdorf** (eng, alt; 1'385 Gebäude): Limmat, Lindenhof
  (im Grundplan beschriftet, als Hügel erkennbar), die Doppeltürme des
  Grossmünsters, ein Kirchturm im Norden, die Bauten am Wasser, die
  Brücken, die enge Dachlandschaft mit Gauben -- alles an seinem Platz.

Gefunden und behoben: In der Zonenlegende fehlten Gewässer und Wald,
obwohl beide auf der Karte eingefärbt sind (Commit 2b63c91, live).
Nicht behoben, weil kein Fehler der Karte: ohne Grafikkarte dauert ein
Bild Minuten; auf deinem Mac und iPhone rechnet die Grafikkarte. Was
ich von hier nicht prüfen konnte: die Färbungen Heizung, Baujahr, Höhe
und Reserve brauchen die Gebäudetabelle aus Supabase, und die ist aus
dieser Umgebung nicht erreichbar. Die neun Bilder liegen nicht im
Repository (je 0.5 bis 1 MB); vier davon habe ich dir in die
Unterhaltung gelegt.

## 18, 20, 22 bis 26 -- bewusst nicht gebaut

- **18 Bewertung:** Eine Online-Bewertung braucht Preise, die der
  Bestand nicht führt. Ohne Transaktionsdaten wäre jede Zahl geraten.
- **20 Landingpages unter eigenen Marken:** Marken und Texte sind
  deine Entscheidung; die Seiten /bewertung, /potenzial, /investor
  stehen und nehmen Anfragen entgegen.
- **22 Firmen und Strategien:** Teams mit eigenen Rechten gibt es; ein
  Feld "Strategie" je Team lässt sich in einer Stunde ergänzen, wenn
  klar ist, was drin stehen soll.
- **23 weitere Kantone:** je Kanton Lizenz, Vermessung, Register,
  Portal -- erst, wenn Zürich vollständig ist.
- **24 KI-Assistent:** braucht einen API-Schlüssel (Kosten) -- deine
  Entscheidung.
- **25 Szenarien, 26 Daten verkaufen:** Ideen über Tims Brief hinaus;
  nichts davon ist heute gefragt.

