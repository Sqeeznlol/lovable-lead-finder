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
"einspielen", Text `202611032` -- und einmal `20261103190000` (siehe Tabelle):

| Migration | Was sie tut |
|---|---|
| `20261103190000_merkliste_stand_karte` | Stand und Notiz je Gebäude in Merklisten, Lage der Gebäude für die Karten (Spalten `gebaeude.e/n`) |
| `20261103200000_gelegenheiten_potenzial` | Entwicklungspotenzial in Kundenportfolios als Gelegenheit (Punkt 1) |

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

