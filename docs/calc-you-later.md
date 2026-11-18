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

### Hauptnutzfläche nach Julians Praxisformel

    Grundstück × Ausnützung ÷ Vollgeschosse × (Vollgeschosse + 0.66) × 0.77

Dieselbe Formel wie in der Potenzialrechnung (`potential.ts`, Migration
`20260904120000_hnf_praxisformel.sql`). Das Attika zählt 0.66 eines
Vollgeschosses, ausser die Zone verbietet Dachgeschosse; eine
Baumassenziffer wird über 3.2 m Geschosshöhe zur Ausnützung. Die
Grenzabstände rechnet die Formel nicht: lassen sie weniger zu, steht
das unter den Risiken. Nur wo die Zone keine Ziffer nennt, rechnet die
Machbarkeit (Hülle). Hochweidstrasse 9: 1'411 m² × (1.8 ÷ 3.2) ÷ 2 ×
2.66 × 0.77 = 813 m² (vorher 611 m² mit Hülle und ohne Attika).

### Nachbar dazukaufen

Julian, 16. November: «Parzelle nebenan, wenn man kaufen kann:
dazukaufen, besseres Angebot.» Die Seite holt die Nachbarparzellen beim
Bund (Kataster, Gebäuderegister, Zonenplan), jede mit ihrem Wert allein.
Angekreuzt wird, was sich dazukaufen lässt. Die Regel:

  * Gemeinsam gerechnet: Nutzfläche nach Praxisformel je Parzelle,
    zusammengezählt; ab 3'000 m² gemeinsamer Fläche +10 % für eine
    Arealüberbauung (Annahme, in der Bauordnung der Gemeinde nachsehen;
    beide Werte lassen sich ändern).
  * Jeder Nachbar bekommt, was seine Parzelle allein wert ist (die
    höchste seiner drei Bewertungen).
  * Was die gemeinsame Rechnung darüber hinaus hergibt, geht in das
    Angebot für diese Parzelle -- aber nur, wenn es mindestens
    CHF 10'000 mehr ist als allein.

Hochweidstrasse 9 mit den Parzellen 3947, 4903 und 4902 (zusammen
3'434 m²): Empfehlung CHF 9.72 Mio. statt 7.78 Mio. allein.

**Nachbarn in einer Bauzone ohne Ziffer.** Am 17. November waren in
Zürich Aussersihl alle Nachbarn gesperrt («keine Bauzone mit Ziffer»).
Die Quartiererhaltungs- und Kernzonen nennen im Zonenplan des Kantons
fast nie eine Ziffer (gezählt an 3'300 Zonenflächen um Zürich, Kilchberg
und Uster: 1 von 971 Quartiererhaltungszonen, 5 von 187 Kernzonen),
manche nicht einmal Geschosse. Bauzonen sind es trotzdem. Seither:

  * Ein Nachbar ohne eigene Ziffer rechnet mit der Dichte dieser Parzelle
    (ihre Nutzfläche je m² Land). Das ist eine Annahme und steht so da:
    in der Zeile des Nachbarn, in der gemeinsamen Rechnung und als Satz
    bei den Risiken.
  * Ist diese Parzelle selbst nicht gerechnet (keine Ziffer, kein Umriss),
    verlangt die Seite zuerst die Ausnützung unter «Zone von Hand».
  * Ob eine Zone Bauzone ist, sagt der Code des Kantons (C11 bis C14:
    Wohnen, Gewerbe, Misch- und Zentrumszonen). Öffentliche Bauten,
    Erholung, Strassen, Bahn und Wald lassen sich nicht ankreuzen, auch
    wenn sie eine Ziffer nennen.

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
    Steigung +10 %, ab 20 % +20 % (von Julian bestätigt).
  * **Nähe zu Zürich** teurer: +10 % am Hauptbahnhof, gleichmässig
    weniger bis 0 % in 25 km (von Julian bestätigt).
  * Die Baukosten gelten je m² verkaufbarer Nutzfläche (bestätigt).
  * **Kleine Projekte** (18. November, am Projekt YOMORI): «Bei Projekten
    unter 10 Mio. Baukosten sind die Baukosten 30 % höher.» Gemessen an
    den Baukosten vor diesem Zuschlag; in der Seite als Annahme änderbar.
    Gilt auch für Mietwohnungen; zusammen mit Nachbarn entscheidet die
    Grösse des gemeinsamen Projekts.
  * **Kilchberg**: Verkaufspreis 20'000 bis 30'000 je m²
    (`src/lib/erloes-angaben.ts`, gerechnet mit der Mitte).

### Zahlen eines bekannten Projekts

Sind Pläne oder Zahlen des Bauherrn bekannt, gehören sie in «Nutzfläche
laut Projekt» und «Baukosten laut Projekt» (gesamt, ohne Abbruch). Sie
gehen der Formel und dem Register vor und ersetzen Preisstufe und
Zuschläge.

**Abgleich an YOMORI** (Wallisellerstrasse 9, Kloten, Parzelle 6315,
711 m², W4), Zahlen des Projekts von Julian am 18. November:

| | Nutzfläche | Baukosten | Landwert | Empfehlung |
|---|---|---|---|---|
| Projekt YOMORI | 724 m² | CHF 5.5 Mio. | CHF 2.4 Mio. | |
| CALC bis 18. November (Formel) | 638 m² | CHF 4.09 Mio. | CHF 1.6 Mio. | CHF 1.43 Mio. |
| CALC mit Zuschlag kleines Projekt | 638 m² | CHF 5.31 Mio. | CHF 0.37 Mio. | CHF 0.33 Mio. |
| CALC mit den Zahlen des Projekts | 724 m² | CHF 5.5 Mio. | CHF 0.96 Mio. | CHF 0.86 Mio. |

Gemessen in der Seite mit den Daten von Bund und Kanton; Erlös in allen
Zeilen CHF 11'250 je m² (Verkäufe in Kloten 2023 bis 2025). Der Zuschlag
bringt die Baukosten nahe an das Projekt (5.31 statt 5.5 Mio.), die
Formel unterschätzt die Nutzfläche um 12 %. Den Landwert von CHF 2.4 Mio.
erreicht die Rechnung erst mit einem Erlös von CHF 13'735 je m² (bei
20 % Gewinn): mit welchem Verkaufspreis YOMORI rechnet, ist die offene
Zahl. `calc.test.ts` hält die Zeilen fest.

### Der Verkaufspreis je m²

Er ist der grösste Hebel. Am 16. November rechnete die Hochweidstrasse 9
in Kilchberg mit der Annahme CHF 9'500 und empfahl CHF 3.16 Mio.; mit
Julians 25'000 und der amtlichen Zone waren es CHF 5.81 Mio., mit der
Praxisformel CHF 7.78 Mio. Woher er
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

## Verkaufspreis je m²: aus den Preisen der letzten Jahre

Julian, 17. November: «Die Preise stimmen nicht ... schaue genau alle
Preise an, die letzten paar Jahre, und begründe es auch.» Bis dahin galt
in der Stadt Zürich das Mittel der Neubauten der ganzen Stadt und sonst
eine Annahme von CHF 9'500. Seither (`src/lib/preis-herleitung.ts`,
Daten `public/preise-reihen.json` aus `tools/preise_reihen.py`, monatlich
im Ablauf «Preise»):

  * **Stadt Zürich, amtlich je Quartier.** Statistik Stadt Zürich nennt
    den Preis je m² Wohnfläche im Stockwerkeigentum je Quartier und Jahr.
    Gerechnet wird mit 2023 bis 2025, jedes Jahr mit dem Trend der ganzen
    Stadt auf 2025 gebracht und nach Verkäufen gewichtet. Unter 30
    Verkäufen im Quartier gilt der Kreis, sonst die ganze Stadt; die Seite
    sagt es. Die Quartiere liegen 2023 bis 2025 zwischen CHF 13'300
    (Affoltern, Schwamendingen) und 24'400 (Fluntern).
  * **Übriger Kanton Zürich, berechnet.** Der Kanton veröffentlicht nur
    den Median je Wohnung. Geteilt wird durch die Fläche der verkauften
    Wohnungen: der Median der Wohnungen in Mehrfamilienhäusern ab 1980 aus
    dem Gebäuderegister, geeicht an der Stadt Zürich, wo beides amtlich
    ist (die verkauften Wohnungen waren 2023 bis 2025 2.7 % grösser).
    Drei Jahre, jedes mit dem Trend der Marktregion (Gerade durch zehn
    Jahre) auf 2025 gebracht und nach Verkäufen gewichtet.
  * **Neubauten ohne Zuschlag.** In der Stadt Zürich kosteten sie je m²
    2021 bis 2025 zwischen 94 und 103 % des Durchschnitts aller Wohnungen.
  * **Prüfung.** Kilchberg ergibt CHF 26'050, in Julians Spanne von 20'000
    bis 30'000 (16. November). Der Test `preis-herleitung.test.ts` hält
    das fest und rechnet ein kleines Beispiel von Hand nach.
  * Auf der Seite steht unter dem Preis «Warum CHF … je m² Verkaufspreis»:
    jeder Schritt als Satz, dazu die Preise der letzten elf Jahre
    (Wohnung, je m², Bauland, Einfamilienhaus) mit der Zahl der Verkäufe.
  * Ausserhalb des Kantons Zürich gibt es keine solchen Zahlen: dort
    bleibt die Annahme, als solche gekennzeichnet.

## Adresse, Parzelle oder EGRID

Gesucht wird beim Bund (geo.admin.ch, Adressen aus dem Gebäude- und
Wohnungsregister, Parzellen aus der Amtlichen Vermessung).

  * Eine Hausnummer, die es nicht gibt, sagt die Seite so und bietet die
    nächsten Nummern derselben Strasse an. «Rechnen» nimmt dann keine
    still. Am 17. November: «Dietlikerstrasse 55 in Kloten» gibt es nicht,
    daneben 54, 56 und 57. Vorher fand die Suche wegen «in» und Komma die
    Lindenstrasse 55, und «Rechnen» hätte sie genommen.
  * Ohne Adresse geht es über die Parzelle: «Kloten 2061», «Parzelle 2061
    Kloten» oder die EGRID. Die Postleitzahl für Homegate kommt dann aus
    dem Register der Gebäude auf der Parzelle.

## Comparis und Homegate

Beide verbieten das automatische Auslesen und sperren Programme aus.
Das gilt für Mieten wie für Kaufpreise.
Sperren werden nicht umgangen. Die Seite öffnet darum nur die Suche
(Homegate nach Postleitzahl, Comparis nach Ort, dazu eine Suche nach
Inseraten an der Adresse), und ein Mensch überträgt zwei, drei
vergleichbare Wohnungen: Fläche und Netto-Miete. Der Median je m² ist
die Marktmiete. Der Test `calc-daten.test.ts` wird rot, wenn Code diese
Seiten selbst abruft.

Nachgesehen am 17. November (Julian: «wieso nicht? was brauchst du,
damit das geht»):

  * Homegate antwortet einem Programm schon auf `robots.txt` mit der
    Sperre von Cloudflare (403), Comparis auf die Mietsuche mit 403.
  * Homegate, Disclaimer: die Informationen sind «nur für Browsingzwecke
    für den privaten Eigengebrauch» frei; der Benutzer erklärt sich
    einverstanden, sie «weder zu kopieren, noch zu veröffentlichen».
  * Comparis, rechtliche Hinweise: der Benutzer unterlässt es, «die
    zugänglichen Daten zu kopieren»; bei Verstössen behält sich Comparis
    rechtliche Schritte vor.

Automatisch geht es darum nur mit einer Quelle, die es erlaubt:

  * Popety.io: dort besteht ein bezahltes Abo mit Schnittstelle (Projekt
    Maradona). Das Angebot nennt Anzeigen und Transaktionen. Ob die
    Schnittstelle Inserate mit Fläche und Preis liefert, steht nicht auf
    der öffentlichen Seite: dazu braucht es den Schlüssel als
    GitHub-Secret und einen Blick in die Dokumentation.
  * Eine Lizenz der Portale selbst oder eines Datenanbieters. Kostet
    Geld; das entscheidet Julian.

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
