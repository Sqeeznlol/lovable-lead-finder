# CALC YOU LATER

Vom Lead zur Kaufpreisempfehlung, und in einem Tag zum Angebot. Reiter
«Calc You Later» (`/calc`).

Die Idee, am 16. November an Julian weitergegeben: Lele gibt einen Lead
ein, und es kommt alles heraus -- Landwert, mögliche Hauptnutzfläche,
Kubatur, Baukosten, Verkaufserlös, Gewinn, Grösse der Fläche, Chancen,
Risiken. Dann ein Ablauf, der nicht länger als einen Tag dauern darf:
David bestätigt oder ändert die Kaufpreisempfehlung, es folgt die
finale Freigabe, dann formuliert der Caller oder Julian das Angebot und
schickt es ab. «Wichtig, dass es schnell Resultate gibt, die halten.»

## Was gerechnet wird

Drei Bewertungen, die höchste bestimmt den Preis (`src/lib/calc.ts`):

| | Rechnung | Woher |
|---|---|---|
| **Neubau zum Verkaufen** | Erlös − Baukosten − Abbruch − Gewinn = Landwert | Flächen aus der Machbarkeit (`machbarkeit.ts`): Ziffer und Hülle, die engere gilt |
| **Neubau zum Vermieten** | Nutzfläche × Miete × 12 ÷ Rendite − Baukosten − Abbruch − Gewinn = Landwert | Miete aus Inseraten, sonst BFS für Baujahre ab 2021 |
| **Bestand** | vermietbare Fläche × Miete × 12 ÷ Rendite = Ertragswert | Fussabdruck × Geschosse × 77 %; Miete laut Eingabe, sonst BFS nach Baujahr |

Die Empfehlung ist dieser Wert minus Abschlag (Vorgabe 10 %), auf
10'000 abgerundet. Der Bestand wird bewertet, wenn das Register drei
oder mehr Wohnungen führt oder jemand Mieten einträgt.

### Vorgaben von Julian (16. November)

  * **Gewinn** 20 % des Erlöses (beim Vermieten: des Werts).
  * **Baukosten je m² Nutzfläche**, inklusive Nebenkosten, nach dem
    Verkaufspreis: unter 15'000 rund 6'000, darüber 7'000, über 20'000
    8'000, über 25'000 9'000. Gerechnet ohne Treppe, als Gerade durch die
    Mitte jeder Stufe (12'500 → 6'000 ... 27'500 → 9'000), begrenzt auf
    6'000 bis 9'000. Der Abbruch kommt dazu (CHF 250 je m² Bestand).
  * **Mietwohnungen**: Baukosten CHF 6'500 je m².
  * **Hanglage** 10 bzw. 20 % teurer. Die Steigung kommt aus dem
    Geländemodell des Bundes (Höhen je 15 m um den Punkt); ab 10 %
    Steigung +10 %, ab 20 % +20 % -- die Schwellen sind angenommen.
  * **Nähe zu Zürich** teurer. Wie viel, ist angenommen: +10 % am
    Hauptbahnhof, gleichmässig weniger bis 0 % in 25 km.
  * **Kilchberg**: Verkaufspreis 20'000 bis 30'000 je m²
    (`src/lib/erloes-angaben.ts`, gerechnet mit der Mitte).

### Der Verkaufspreis je m²

Er ist der grösste Hebel. Am 16. November rechnete die Hochweidstrasse 9
in Kilchberg mit der Annahme CHF 9'500 und empfahl CHF 3.16 Mio.; mit
Julians 25'000 und der amtlichen Zone sind es CHF 5.81 Mio. Woher er
kommt, in dieser Reihenfolge:

  1. Stadt Zürich: amtlich, neue Eigentumswohnungen, Median
     (`tools/erloes.py`, 2025: CHF 18'229 aus 223 Verkäufen).
  2. Angaben von Julian je Gemeinde (`src/lib/erloes-angaben.ts`).
  3. Sonst die Annahme CHF 9'500, als solche gekennzeichnet.

Unter dem Preis steht, wenn es abweicht, welcher Erlös zum bezahlten
Landpreis der Gemeinde passt und was eingetragene Kaufinserate
verlangen, je mit einem Knopf zum Übernehmen.

Jede Annahme lässt sich ändern, und unter «Herkunft jeder Zahl» steht,
was amtlich, was berechnet und was Annahme ist.

## Woher die Zahlen kommen

| Angabe | Quelle | Gilt für |
|---|---|---|
| Adresse, Parzelle, Fläche | Suchdienst und Kataster des Bundes | ganze Schweiz |
| Gebäude: Fläche, Geschosse, Baujahr, Wohnungen | Gebäude- und Wohnungsregister des Bundes | ganze Schweiz |
| Zone: Ziffer, Geschosse | Zonenplan des Kantons Zürich | ZH; sonst eigene Liste (TG) oder von Hand |
| Umriss, bebaubare Fläche | eigener Bestand, `machbarkeit_grundlage` | ZH, TG |
| Bauland, Eigentumswohnung, Einfamilienhaus | amtliche Statistik, `public/preise.json` | ZH (BL nur Bauland) |
| Miete je m² | BFS, Strukturerhebung 2024, je Kanton und Bauperiode (`tools/mieten.py`) | ganze Schweiz |
| Belastete Standorte, ÖV-Güteklasse | Bund und geodienste.ch | ganze Schweiz |
| Steigung des Geländes | Höhendienst des Bundes (swissALTI3D) | ganze Schweiz |
| Verkaufspreis je m² | Statistik Stadt Zürich; sonst Angabe Julian oder Annahme | Stadt Zürich |
| Baugesuche im Umkreis von 300 m | eigener Bestand, `baugesuche_umkreis` | geladene Kantone |

Die Mieten des BFS sind Bestandsmieten: was heute im Durchschnitt
bezahlt wird, nicht was ein Inserat verlangt. Je Gemeinde veröffentlicht
das BFS nichts. Neu holen:

    # Adresse «master» des jüngsten Eintrags unter
    # https://dam-api.bfs.admin.ch/hub/api/dam/assets?orderNr=je-d-09.03.03.06
    python3 -I tools/mieten.py <datei.xlsx> src/lib/mieten-daten.ts

## Comparis und Homegate

Beide verbieten das automatische Auslesen und sperren Programme aus.
Das gilt für Mieten wie für Kaufpreise.
Sperren werden nicht umgangen. Die Seite öffnet darum nur die Suche
(Homegate nach Postleitzahl, Comparis nach Ort, dazu eine Suche nach
Inseraten an der Adresse), und ein Mensch überträgt zwei, drei
vergleichbare Wohnungen: Fläche und Netto-Miete. Der Median je m² ist
die Marktmiete. Der Test `calc-daten.test.ts` wird rot, wenn Code diese
Seiten selbst abruft.

## Chancen und Risiken

Regeln über gemessenen Zahlen, kein Sprachmodell; jeder Satz nennt die
Zahl, auf der er steht. Geprüft werden unter anderem: Reserve, Alter
des Hauses, Landwert und Wohnungspreis gegen die amtlichen Preise der
Gemeinde, Baugesuche im Umkreis, ÖV, Hülle statt Ziffer, fehlender
Umriss, Zone von Hand, Besitzstand, Denkmalschutz, Ortsbild, belasteter
Standort, Mieter im Haus, unbekannte Miete.

## Der Ablauf: ein Tag

    Entwurf -> Kaufpreis prüfen -> Freigabe -> Angebot schreiben -> Gesendet

Mit dem Einreichen startet die Uhr: 24 Stunden bis zum Versand. Die
Liste und das Cockpit zeigen, was wartet und was überfällig ist.

Reihenfolge und Uhr erzwingt die Datenbank, nicht die Seite (Migration
`20261116140000_kalkulation.sql`, Funktion `kalkulation_schritt`): die
Spalten des Ablaufs lassen sich von aussen nicht schreiben, und
eingereichte Kalkulationen nicht mehr ändern. Aus der Freigabe geht es
mit Grund zurück zur Prüfung; abgelehnt wird mit Grund, wieder geöffnet
als Entwurf.

Es gibt wenige Konten und mehrere Hände. Darum steht im Verlauf der
Name, den jemand angibt, und dazu sein Konto. Sollen einzelne Schritte
an bestimmte Konten gebunden sein, braucht es je Person ein Konto.

Benachrichtigt wird niemand: einen Dienst für Mail oder SMS hat Aurora
nicht. Wer prüft oder freigibt, sieht es im Cockpit und im Reiter.

## Prüfen

    npx vitest run src/lib/__tests__/calc.test.ts          # die Rechnung, von Hand nachgerechnet
    npx vitest run src/lib/__tests__/calc-daten.test.ts    # Antworten des Bundes, Portal-Links
    tools/kalkulation-probe.sh                             # Migration in einer Wegwerf-Datenbank:
                                                           # Reihenfolge, Uhr, Rechte

## Noch nicht gebaut

Die dritte Stufe (nach der Reservation: Studie und Due Diligence) ist
für das Werkzeug «noch nicht wichtig» und fehlt.
