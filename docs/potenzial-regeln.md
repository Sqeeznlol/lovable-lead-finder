# Regeln: Wann das System ein Entwicklungspotenzial meldet

Stand 4. November 2026. Zum Prüfen durch Julian und Tim -- jede Regel
hier lässt sich ändern, ohne dass die Oberfläche angefasst wird
(Funktion `gelegenheiten_potenzial` in
`supabase/migrations/20261103200000_gelegenheiten_potenzial.sql`).

Tims Brief, Abschnitt 11B: *"Automatically identify underutilized
land, possible extensions, replacement buildings and parcels where a
zoning change creates value, so that we approach owners with a
concrete opportunity instead of a general inquiry."* Und Abschnitt 13:
*"Each event becomes a case, not a notification."*

## Für wen

Für die Parzellen der **Kundenportfolios** (Portfolio Intelligence).
Jede erkannte Parzelle wird eine Gelegenheit mit Anlass
"Ausnützungsreserve", Zustand "erkannt", dem Kunden zugeordnet. Je
Kunde und Parzelle höchstens eine; der Ablauf läuft täglich mit den
Baugesuchen und legt nichts doppelt an.

Für den eigenen Bestand (Akquise ohne Kunden) entsteht bewusst keine
Gelegenheit je Parzelle: bei 259'057 Zürcher Parzellen wären das
Tausende, und Tausende Fälle sind Rauschen. Dort steht die Reserve in
der Gebäudesuche und in der Vorauswahl als Sortierung.

## Woher die Zahlen kommen

| Grösse | Quelle |
|---|---|
| Reserve (m² Hauptnutzfläche, `hnf_delta`) | Potenzialrechnung je Parzelle: zulässige Geschossfläche aus Zone und Ausnützungsziffer, minus Bestand (Gebäudefläche × Geschosse), × 0,8 |
| Anteil der Reserve an der Zone (`reserve_quote`) | dieselbe Rechnung, 0 bis 1 |
| Sicherheit der Rechnung (`confidence`) | hoch: Ausnützung vom Objekt und Geschosse bekannt · mittel: Ausnützung aus der Zone · tief: geschätzt · keine: nicht rechenbar |
| Baujahr, Geschosse, Heizung | Gebäude- und Wohnungsregister (GWR), das grösste Gebäude der Parzelle; fehlt es, das Baujahr aus dem Bestand |
| Nachbarn | Tabelle `nachbarschaft` (vom Bund beim Einspielen eines Portfolios geholt) |
| Marge | Potenzialrechnung: Erlös der zusätzlichen Fläche minus Baukosten (Annahmen in `potenzial_config`) |

Was nicht gerechnet ist, wird nicht erfunden: Parzellen ohne
Potenzialrechnung (`confidence` leer oder "keine") und ausgeschlossene
Parzellen (Nicht-Bauzone, Denkmalschutz, "Ausschliessen" in der
Vorauswahl) erzeugen keine Gelegenheit.

## Die drei Regeln

**R1 Ausnützungsreserve.** Die Reserve beträgt mindestens 200 m² HNF.
Titel: "Ausnützungsreserve im Portfolio: Adresse, Gemeinde".

Warum 200: dieselbe Schwelle wie bei "Nachbar baut", gemessen am
1. November. Eine Aufstockung unter 200 m² lohnt den Aufwand eines
Gesprächs selten.

**R2 Ersatzneubau prüfen.** R1 trifft zu, und das Hauptgebäude ist 50
Jahre oder älter, und der Bestand nutzt weniger als 60 % dessen, was
die Zone erlaubt (`reserve_quote` ≥ 0,4). Titel: "Ersatzneubau
prüfen: …".

Warum: Ein Haus, das ein halbes Jahrhundert steht und die Zone nicht
einmal zu 60 % ausnützt, wird eher ersetzt als aufgestockt. Die
Begründung sagt das ausdrücklich, damit der Anrufer weiss, worüber er
spricht.

**R3 Gemeinsame Entwicklung mit Nachbar.** Ein Nachbar im Bestand, der
nicht demselben Kunden gehört, hat selbst mindestens 200 m² Reserve.
Erfüllt die eigene Parzelle R1, werden bis zu fünf solche Nachbarn der
Gelegenheit angehängt und der grösste in der Begründung genannt.
Erfüllt sie R1 nicht, braucht es beim Nachbarn das Doppelte (400 m²),
damit daraus eine eigene Gelegenheit wird: "Gemeinsame Entwicklung mit
Nachbar: …".

Warum: Tims Beispiel mit Swisscanto, Helvetica und SFP -- die
Entwicklung über die Grenze hinweg ist oft mehr wert als die eigene
Reserve.

## Priorität (eine Zahl, erklärbar)

    Marge in Millionen Franken (gerundet auf eine Stelle)
    + 3  wenn Ersatzneubau (R2)
    + 2  wenn das Hauptgebäude mit Öl oder Gas heizt
    + 1  je Nachbar mit Reserve, höchstens 3

Öl oder Gas zählt, weil dort der Heizungsersatz ansteht: Der
Eigentümer muss ohnehin investieren, und das ist der Moment, in dem er
über Aufstockung oder Verkauf nachdenkt.

## Was in der Begründung steht

Beispiel: *"Reserve 640 m² HNF: Bestand 1'200 von 2'000 m² aGF (Zone
W3, Ausnützung aus der Zone). Hauptgebäude 1962, 3 Geschosse, heizt
mit Heizöl. Mit 50 Jahren oder mehr und weniger als 60 % Ausnützung
eher Ersatz als Aufstockung. Nachbar Musterstrasse 5 mit 400 m²
Reserve (2 Nachbarn mit Reserve)."*

Jede Zahl darin lässt sich im Objektfenster nachprüfen.

## Was bewusst noch fehlt

- **Zonenänderungen** ("parcels where a zoning change creates
  value"): keine Quelle angebunden. Siehe docs/nacht.md, Punkt 4.
- **Bewilligte Baugesuche** als Bestätigung, dass die Zone wirklich so
  ausgenützt werden darf: die Zürcher Quelle liefert nur eingereichte
  Gesuche.
- Die Potenzialrechnung nutzt die Gebäudefläche aus dem Bestand, nicht
  die Grundfläche aus dem Register. Beides zu vergleichen und die
  Rechnung mit Registerdaten zu erneuern, hiesse 259'057 Zeilen neu zu
  schreiben -- das wird erst gemacht, wenn der Datenbank-Tarif es
  trägt (Punkt 7).
