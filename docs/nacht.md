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

