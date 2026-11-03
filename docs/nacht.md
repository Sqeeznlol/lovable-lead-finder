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
"einspielen", Text `2026110319` -- das trifft alle unten genannten:

| Migration | Was sie tut |
|---|---|
| `20261103190000_merkliste_stand_karte` | Stand und Notiz je Gebäude in Merklisten, Lage der Gebäude für die Karten (Spalten `gebaeude.e/n`) |
| `20261103200000_gelegenheiten_potenzial` | Entwicklungspotenzial in Kundenportfolios als Gelegenheit (Punkt 1) |

Danach den Ablauf **Gebäude** mit "schreiben" starten: Er lädt das
Register neu, diesmal mit der Lage jedes Gebäudes. Erst danach zeigen
die Karten der Gebäudesuche und der Merklisten Zürcher Gebäude --
Zürcher Parzellen haben im Bestand keinen Umriss (gemessen: 0 von
394'917), die Lage kommt vom Gebäude.

