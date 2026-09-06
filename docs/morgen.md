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

## Thurgau -- fertig, ohne Potenzialrechnung

Am 6. September durchgelaufen und in der Datenbank:

    137'214  Parzellen mit EGRID, Nummer, Gemeindenummer, Fläche
              und Zonenanteil
     73'191  davon mit Adresse
     60'382  mit Baujahr, 65'454 mit Geschossen, 63'349 mit Wohnungen
    137'214  mit Zonenname im Klartext ("W2 Wohnzone 2a")

Drei Dinge waren dafür zu lösen, und alle drei waren derselbe Fehler in
verschiedener Verkleidung -- etwas wurde nicht angesehen, sondern
geraten:

  * **Der Zonenname.** Gesucht wurde tagelang eine Tabelle
    "Typ_Grundnutzung". Die gibt es in diesem Modell nicht. Sie heisst
    "Nutzungsplanung_V1_2.Geobasisdaten.Typ" (2'202 Stück, je Gemeinde)
    und ".Typ_Kt" (134, kantonsweit) und lag von Anfang an in derselben
    Datei. Sichtbar wurde das erst, als die Diagnoseliste im Protokoll
    nicht mehr nach acht Zeilen abbrach.

  * **Adressen und Gebäudedaten.** Die Vermessung kennt keine Häuser.
    Das Gebäude- und Wohnungsregister des Bundes schon, kantonsweise
    frei abrufbar unter public.madd.bfs.admin.ch/tg.zip -- mit EGID je
    Gebäude und EGRID der Parzelle, also direkt anhängbar. 124'126
    Gebäude, 126'220 Eingänge.

  * **Der ÖREB-Link.** Er wurde selbst gebaut und brauchte dafür die
    Gemeindenummer, die oft fehlt. Dabei stand der fertige Link längst
    in der Spalte housing_stat_url.

Offen bleibt allein die **Ausnützungsziffer**: ohne sie keine
Potenzialrechnung, kein hnf_delta, keine Marge. Für Zürich liefert das
die kantonale Bauordnung, im Thurgau regeln es die Gemeinden je
einzeln. Julian rechnet das selbst.

## Ein Index, drei Mal vergessen

Derselbe Fehler an drei Stellen desselben Tages, und er kostete jedes
Mal Stunden:

  1. **Verschneiden** -- ohne räumlichen Index verglich die Datenbank
     jede der 140'000 Parzellen mit jeder der 57'000 Zonen. Ein Lauf
     lief eine halbe Stunde ohne eine einzige Zeile.
  2. **Einspielen** -- die Vorschau verglich 193'642 Zeilen mit
     259'057 und brach nach zwei Minuten ab.
  3. **Die Webseite** -- die Abfrage "gib mir die Objekte des Kantons"
     lief in die Frist von PostgREST und lieferte dem Browser
     HTTP 500 statt Daten. Thurgau war deshalb in der Datenbank, aber
     nicht auf der Seite zu sehen.

Merksatz für den nächsten Kanton: **Wer eine Spalte filtert, legt
vorher den Index an.**

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

## Was beim Ausrollen zu beachten ist

**Vercel baut die Live-Seite nur bei einem direkten Push auf `main`.**
Ein Squash-Merge einer Pull Request erzeugt zwar den Commit auf `main`,
aber kein Production-Deployment -- belegt am 6. September: von
fünfzehn gemergten Änderungen wurde eine einzige live, und das war die
eine, die direkt gepusht wurde.

Woran man erkennt, dass etwas live ist: in der Liste der Deployments
trägt der Eintrag das blaue Badge **Production** und als Branch
**main**. Ein Eintrag mit *Preview* und einem `claude/...`-Branch ist
nur ein Probebau und ändert an der Seite nichts.

Zwei Dinge, die dabei Stunden gekostet haben:

  * **Ein Redeploy holt keine neuen Commits.** Er baut denselben
    Quellstand noch einmal. Wer den aktuellen Stand live will, braucht
    einen neuen Build, keinen erneuten.

  * **Der Zwischenspeicher im Browser hält dreissig Minuten.** Kommt
    ein Feld dazu, liest die neue Anwendung so lange alte Zeilen ohne
    dieses Feld weiter -- und kein Neuladen hilft, weil das Neuladen ja
    gerade übersprungen wird. Deshalb trägt die Ablage eine Fassung im
    Namen (`bauraum.v2.`), die bei jeder Änderung der Form steigt.

## Jeder Kanton hat seinen eigenen Kataster

Der ÖREB-Link führte auch bei Thurgauer Objekten auf `maps.zh.ch` und
zeigte dort eine Zürcher Parzelle mit derselben Nummer -- schlimmer als
kein Link, weil er beim Telefonieren glaubwürdig aussieht.

Der Thurgau führt `map.geo.tg.ch`. Das Portal sucht keine
Parzellennummern, es zeigt Orte, und es rechnet in Landeskoordinaten;
die Umrechnung aus Längen- und Breitengrad steht in
`src/lib/koordinaten.ts`. Fünf Tests in
`src/lib/__tests__/kataster.test.ts` halten den Fall fest, damit ihn
niemand mehr von Hand nachklicken muss.

Für Zug, Aargau und Luzern gilt dasselbe, sobald sie dazukommen: erst
das Portal des Kantons suchen, dann den Link bauen.

## Wie gepusht und ausgeliefert wird

Am 6. September lagen fünfzehn Änderungen auf `main` und eine einzige
davon stand auf der Seite. Auffallen konnte das nur, weil jemand
zufällig klickte. Der Ablauf ist deshalb umgestellt:

  1. **Gearbeitet wird auf `main`**, in einem Commit je Sache. Ein
     Branch lohnt sich nur, wenn jemand mitlesen soll; jeder zusätzliche
     Push kostet bei Vercel ein Kontingent, und davon gibt es hundert
     am Tag.

  2. **Jeder Bau schreibt seinen Commit in das Bündel** (`__FASSUNG__`
     in `vite.config.ts`, sichtbar als `window.bauraumFassung`). Damit
     ist von aussen ablesbar, welcher Stand läuft -- der Name des
     Bündels taugt dafür nicht, er hängt auch an den
     Umgebungsvariablen.

  3. **Der Ablauf "Was ist live" läuft bei jedem Push auf `main`** und
     wartet bis zu zehn Minuten darauf, dass genau dieser Commit auf
     der Seite auftaucht. Tut er es nicht, ist der Lauf rot und sagt,
     welcher Stand stattdessen ausgeliefert ist. Niemand muss mehr von
     Hand nachsehen, und niemand telefoniert mehr mit einer Seite, die
     eine Woche alt ist.

  4. **Der Ablauf "Ausliefern" baut selbst und liefert ab**, sobald im
     Repository `VERCEL_TOKEN`, `VERCEL_ORG_ID` und `VERCEL_PROJECT_ID`
     hinterlegt sind. Fehlen sie, sagt er das und hört auf. Solange
     bleibt die Git-Anbindung von Vercel der einzige Weg -- und die
     hat schon einmal einen halben Tag lang nichts gebaut.

Bleibt sie wieder stehen, hilft in Vercel *Promote to Production* auf
einem fertigen Preview: das bringt einen bereits gebauten Stand live,
ohne neu zu bauen, und kostet deshalb kein Kontingent.
