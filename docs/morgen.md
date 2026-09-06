# Was als Nächstes ansteht

Stand 5. September 2026, Ende des Abends. Diese Notiz hält fest, was
offen ist und warum -- damit am nächsten Tag nichts neu hergeleitet
werden muss.

## Was Julian am Morgen selbst erledigt

Beides einmalig; danach braucht es ihn dafür nie wieder.

**1. Datenbankzugang hinterlegen.** In Supabase unter Project Settings →
Database → Connection string → URI kopieren, dann in GitHub unter
Settings → Secrets and variables → Actions als `SUPABASE_DB_URL`
anlegen. Danach lässt sich der Ablauf *Migrationen → einspielen*
starten, und alle künftigen Datenbankänderungen laufen ohne ihn.

Warum das drängt: Der öffentliche Schlüssel darf keine Indizes anlegen.
An dieser einen Sache sind am 5. September dreimal Aufgaben
gescheitert -- die Sortierung der Masterliste, der Abgleich nach
Pipedrive und das Nachfüllen der Deals, alle mit Zeitüberschreitung.

Wer es lieber von Hand macht: der SQL-Block steht in
`supabase/migrations/20260905130000_indizes_masterliste.sql`.

**2. Offene Migrationen.** Drei liegen bereit und sind noch nicht
angewendet:

- `20260905230000_zugang_beschraenken.sql` -- die dringendste. Bisher
  darf jeder mit dem öffentlichen Schlüssel alle 259'057 Datensätze
  lesen, ändern und löschen, und dieser Schlüssel steckt im JavaScript
  der Webseite. Die Anmeldemaske davor nützt nichts, solange die Regel
  gilt. In der Tabelle stehen Namen, Adressen und Telefonnummern von
  Menschen, die nie um ihre Aufnahme gebeten haben.
- `20260905130000_indizes_masterliste.sql` -- Indizes, siehe oben
- `20260905200000_zonen_kuerzel.sql` -- schliesst Winterthurs Kürzel
  (Oe, Wa, Gw, F, G, I1, I2), das Bahnareal und die 3'092 Zeilen mit
  dem Wert "zarchivat" aus

Nach der ersten Migration brauchen die Abläufe bei GitHub, die heute mit
dem öffentlichen Schlüssel auf die Objekte zugreifen, selbst eine
Anmeldung -- Abgleich nach Pipedrive und Nachfüllen. Das ist in der
Migration vermerkt und beim Einspielen gleich mitzurichten.

**3. Konto anlegen.** In Supabase unter Authentication → Users:
scamo@wohntraums.life mit einem neuen Passwort, Auto Confirm gesetzt.
Bei der Anmeldung genügt "Scamo", die Maske ergänzt die Domain. Das im
Gespräch genannte Passwort gilt als kompromittiert und darf nicht
verwendet werden.

Solange sie fehlen, wirken die Zonenausschlüsse nur in der Übersicht
(die im Browser rechnet), nicht in der Masterliste (die die Spalte
`ausgeschlossen` aus der Datenbank liest).

## Thurgau -- Schritte eins bis drei sind fertig

Die Quelle ist frei abrufbar; das Kantonskürzel steckt im Pfad, für Zug
oder Aargau gilt dieselbe Adresse.

    https://geodienste.ch/downloads/interlis/npl_nutzungsplanung/TG/
      npl_nutzungsplanung_v1_2_TG_lv95.zip      41.5 MB
    https://geodienste.ch/downloads/interlis/av/TG/
      av_TG_lv95.zip                           159.5 MB

In der Nacht auf den 6. September durchgelaufen:

    56'810   Zonenflächen
    140'275  Grundstücke
    137'233  Parzellenflächen mit Umriss
    193'642  Ergebniszeilen: je Parzelle und Zone die Fläche
             und der Anteil in Prozent

Eine Zeile sieht so aus:

    CH842026777174, Parzelle 776, TG4401, 171'348 m² gesamt,
    davon 2'144 m² (1 %) in der einen und 4'266 m² (2 %) in
    der nächsten Zone

Genau darauf kommt es an: eine Parzelle kann zur Hälfte Wohnzone und zur
Hälfte Wald sein, bebauen lässt sich nur der Zonenanteil. In Zürich war
das anfangs übersehen worden, mit dem Ergebnis von Margen in
Milliardenhöhe.

Zwei Dinge waren dabei zu lösen und sind es wert, notiert zu werden:

  * GDAL liest die Amtliche Vermessung nur halb -- die Spalten heissen
    Field01 bis Field09 und die Grundstücksgrenzen bleiben lose Linien.
    Ohne Flächen ist jede Rechnung wertlos. Die Umwandlung läuft deshalb
    über ili2gpkg aus der amtlichen INTERLIS-Werkzeugkette. Das gilt für
    jeden weiteren Kanton.
  * Ohne räumlichen Index vergleicht die Datenbank jede der 140'000
    Parzellen mit jeder der 57'000 Zonen. Ein Lauf lief eine halbe
    Stunde ohne eine einzige Zeile. Mit Index dauert es zwei Minuten.

Offen:

1. Zonenname. In der Zonenfläche steht nur ein Schlüssel wie
   "x4401_221_gngde", nicht "W2". Die Bezeichnung steht in einer
   Typentabelle, die sich mit keinem der beiden Werkzeuge herauslösen
   liess: GDAL faltet sie in die Zonenfläche und verwirft ihre Spalten,
   ili2gpkg bricht ab, weil die Typen auf einen Katalog des Bundes in
   einer eigenen Datei verweisen. Ohne den Namen lässt sich nicht
   rechnen, wie hoch gebaut werden darf -- das ist die nächste Aufgabe.
2. Adressen und Gebäudedaten (Baujahr, Geschosse, Wohnungen) fehlen.
3. In die Datenbank schreiben, `kanton = TG`.

Die Zwischenstände liegen als Artefakte am Lauf "Kanton laden"; die
Umwandlung der Vermessung dauert eine halbe Stunde und muss dank
"schritt: verschneiden" nicht wiederholt werden.

## Pipedrive

Erledigt: Konto ausgelesen, sechs leere Felder entfernt (Kategorie,
Ortsbild nach ISOS, Denkmalschutz, Eigentümer 3 bis 5), Feld `Kanton`
angelegt. Ausserdem das Feld "Adresse" entfernt -- mit ihm die zwölf
leeren Unterfelder, die sich einzeln nicht löschen liessen -- und
dreizehn Deal-Titel richtiggestellt, die statt des Objekts seine
Gebäudefläche nannten ("79m² · Affoltern am Albis"). Von einunddreissig
eigenen Feldern sind zwölf übrig.

Offen und in dieser Reihenfolge sinnvoll:

**a) Die 377 nicht zuordenbaren Deals.** Von 390 liessen sich nur
dreizehn mit der Datenbank verbinden, alle über die EGRID. Den übrigen
fehlen EGRID, Parzelle und eine brauchbare Adresse -- sie lassen sich
nicht nachfüllen, solange nicht klar ist, welches Grundstück gemeint
ist. Vorschlag: über Person und Telefonnummer suchen; was dann noch
übrig bleibt, ist Altlast.

**b) Phasen umbauen.** Die heutigen Phasen sind Ergebnisse, keine
Schritte -- "Nicht Erreichbar", "Nicht INTERESSIERT", "LW ZONE".
Deshalb bleiben alle 259 offenen Deals liegen, im Mittel seit 458
Tagen. Nicht erreicht ist ausdrücklich *kein* Verlust, sondern ein
Zwischenstand mit Wiedervorlage; nur "nicht interessiert" schliesst
einen Deal.

Besprochen und entschieden am 5. September -- zwei Pipelines, weil der
Brief ein Stapelprozess ist und einen anderen Rhythmus hat als das
Telefonieren:

    Akquise                        Faulzeit
      1  Neu          nie angerufen, Warteschlange     14 Tage
      2  Anrufen      Versuch läuft                    10 Tage
      3  Gespräch     erreicht, Interesse offen        14 Tage
      4  Unterlagen   Zahlen und Papiere raus          21 Tage

    Post
      1  Brief senden    fällig, Arbeitsliste           3 Tage
      2  Brief versandt  Wartefrist                    21 Tage

Übergänge: 3× nicht erreicht schiebt den Deal nach Post → Brief senden,
mit seiner ganzen Historie. Meldet sich jemand, geht er zurück nach
Akquise → Gespräch. Keine Antwort nach 21 Tagen: verloren mit dem Grund
"Kein Kontakt möglich".

Verlustgründe: Nicht interessiert · Bereits verkauft · Öffentliche Hand
· Falsche Zone · Kein Kontakt möglich.

Bewertung, Verhandlung und Kaufvertrag bleiben vorerst weg. Sie kommen,
wenn der erste Deal so weit ist -- dann sind auch die Namen der Schritte
aus der Praxis bekannt statt geraten.

Offen dabei: Wechselt ein Deal die Pipeline, fehlt in der Auswertung der
Akquise die Zahl "von hundert Neuen wurden zwölf erreicht", weil die
Briefe herausfallen. Für den Alltag ohne Belang, für die Frage nach dem
Wert der Kaltakquise nicht. Lässt sich später mit einem Bericht über
beide Pipelines lösen.

**c) Nächtlicher Lauf.** Zählt die Anrufversuche je Deal aus den
Aktivitäten, schreibt sie ins Feld Kontaktversuche und verschiebt Deals
ab drei Fehlversuchen nach Post. Läuft bei GitHub, unabhängig vom
Pipedrive-Tarif.

## Die Kette, die den Handaufwand ersetzt

Das eigentliche Ziel, besprochen am 5. September. Sobald zu einer
Parzelle ein Eigentümer feststeht, soll ohne weiteres Zutun ein
anrufbarer Deal entstehen:

    Grundbuchabfrage    Eigentümer zur Parzelle gefunden
            ↓
    tel.search.ch       Nummer suchen
            ↓
    eigenes Programm    von Julian geschrieben, noch einzubauen
            ↓
    wohntraums.life     Datensatz vervollständigen
            ↓
    Pipedrive           fertiger Deal in Akquise, Phase "Neu"

Offene Punkte dazu:

**Der Name der Pipeline.** Angelegt wurde sie als "Akquise". Julian
schreibt "Akquise 🏡" -- vor dem ersten automatischen Anlegen klären, wie
sie tatsächlich heisst, sonst laufen die Deals ins Leere.

**Die Nummernsuche.** search.ch bietet eine offizielle Schnittstelle
(api.search.ch/tel) mit kostenlosem Schlüssel für massvolle Nutzung. Die
Webseite abzugreifen verstösst gegen die Nutzungsbedingungen und fliegt
früher oder später auf -- der Schlüssel ist der Weg. Eintragen nur, wenn
das Ergebnis eindeutig ist: eine falsche Nummer im Datensatz kostet mehr
als eine fehlende, weil dann jemand Fremdes angerufen wird.

**Das eigene Programm.** Was es tut und in welcher Sprache es
geschrieben ist, ist noch nicht bekannt. Nötig ist der Zugriff darauf --
am einfachsten im Repository unter tools/, dann lässt es sich in den
nächtlichen Ablauf einhängen.

## Zahlen, die den Stand beschreiben

| | |
|---|---|
| Objekte im Bestand | 259'057 |
| davon Zonenangabe "zarchivat" | rund ein Viertel |
| Deals in Pipedrive | 390: 259 offen, 129 verloren, 2 gewonnen |
| Median-Alter der offenen Deals | 458 Tage |
| Anrufe insgesamt | 897 |
| Grundbuchabfragen pro Tag | 5, mit Bestätigung per SMS |

Die letzte Zahl ist der eigentliche Engpass. Bei fünf Auskünften am Tag
dauert es für 2'710 Anruf-Kandidaten rund zwei Jahre. Wenn die Akquise
schneller werden soll, führt der Weg über einen anderen Bezug der
Eigentümerdaten, nicht über mehr Export.
