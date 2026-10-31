# Von der Akquise-Liste zur Plattform

Antwort auf die Anforderungen "CRM Development -- Strategic Vision" und
"Step 2 -- Additional Opportunities for Maradona", Abschnitt 10: der
konkrete technische Vorschlag.

Dieses Papier nennt, was gemessen ist, und markiert, was noch offen
ist. Wo eine Zahl steht, wurde sie abgefragt; wo eine Quelle steht,
wurde sie nachgesehen. Was nicht geprüft ist, steht unter
"Ungeprüft".

---

## 0. Der Ausgangspunkt, gemessen

Abgefragt am 31. Oktober 2026 gegen die laufende Datenbank:

    Bestand je Kanton      ZH 259'057 · TG 137'214   (396'271 Parzellen)
    Tabelle properties     118 Spalten
    Geometrie              keine -- kein PostGIS, keine Polygone
    Anmeldung              keine -- am 31.10. entfernt
    Mandantentrennung      keine

Daraus folgen drei Dinge, bevor irgendein Feature gebaut wird.

**Erstens: ohne Geometrie keine Nachbarschaft.** Die Plattform steht
und fällt mit einer Frage -- *welche Parzellen grenzen an diese?*
Abschnitt 3 (Baugesuch-Meldungen), Abschnitt 5 (Arrondierung) und
Abschnitt 2 des zweiten Papiers (Nachbarschaftsanalyse) hängen alle
daran. Heute sind nur EGRID, Adresse und Gemeindenummer gespeichert.
Daraus lässt sich Nachbarschaft nicht berechnen, auch nicht näherungs-
weise: zwei Adressen an derselben Strasse können hundert Meter oder
zwei Parzellen auseinanderliegen. Es braucht die Liegenschafts-
polygone und PostGIS.

**Zweitens: 118 Spalten sind kein Datenmodell.** In `properties`
stecken heute Parzelle, Gebäude, Eigentümer, Bewertung, Anrufzustand
und Pipedrive nebeneinander. Der Eigentümer steht als *Text in der
Parzellenzeile* (`owner_name`, `owner_name_2`, `eigentuemer_name`,
`owners_json`). Die Forderung "One owner should be connected to all
relevant properties without duplicating information" ist damit nicht
erfüllbar -- Swisscanto stünde vierhundertmal da, in vierhundert
Schreibweisen, und keine Abfrage könnte sagen, dass es dieselbe
Institution ist.

**Drittens -- und das blockiert:** Die Plattform soll Portfolios
*fremder Institutionen* führen (Helvetica, SFP, Swisscanto) und
"required data permissions and privacy safeguards" bieten. Die
Anwendung hat seit dem 31. Oktober **keine Anmeldung** und die
Datenbank lässt anonymes Lesen zu. Ein Portfolio von Helvetica in
diese Datenbank zu legen hiesse, es offen ins Netz zu stellen. Das
ist keine Geschmacksfrage und kein späteres Härten: es ist die
Voraussetzung dafür, dass Abschnitt 3, 5 und 7 überhaupt gebaut
werden dürfen. Siehe Abschnitt 6 dieses Papiers.

---

## 1. Architektur

### Das Prinzip

Heute ist die Parzelle die einzige Entität, und alles andere ist eine
Spalte an ihr. Künftig gibt es **drei Achsen**, die sich kreuzen:

    was in der Welt steht      Parzelle, Gebäude
    wer dahintersteht          Akteur (Person, Firma, Institution)
    was wir damit tun          Gelegenheit, Anruf, Mandat

Der wichtigste Entwurfsentscheid: **ein Akteur, viele Rollen.**
Swisscanto ist nicht einmal "Eigentümer", einmal "Kunde" und einmal
"Investor" in drei Tabellen. Swisscanto ist *ein* Akteur, und
Eigentum, Mandat und Suchprofil sind Beziehungen an ihm. Nur so
beantwortet das System die Frage aus Abschnitt 2 -- "Searching for
Swisscanto should display all properties linked to Swisscanto" --
mit einer Abfrage statt mit einer Textsuche über vier Spalten.

### Die Entitäten

    parzelle            EGRID als natürlicher Schlüssel, Polygon,
                        Fläche, Zone, Gemeinde, Kanton
      gebaeude          GWR-EGID, Baujahr, Geschosse, Wohnungen
      potenzial         die heutige Rechnung, als eigener Satz mit
                        Stand und Fassung statt als 22 Spalten

    akteur              Person | Firma | Institution
      kontakt           Menschen bei einem Akteur, mit Funktion
      investorprofil    Suchprofil (Abschnitt 6): Lagen, Typen,
                        Budget, Rendite, Horizont

    eigentum            n:m zwischen parzelle und akteur
                        Anteil, Art, Quelle, Stand, Prüfstatus
    verwaltung          n:m -- wer bewirtschaftet, oft nicht der
                        Eigentümer

    mandant             ein Akteur als zahlender Kunde
      portfolio         seine Liegenschaften
      portfolio_position n:m zu parzelle

    baugesuch           publiziertes Gesuch, Stand eingereicht |
                        bewilligt | abgelehnt
    nachbarschaft       vorberechnet: parzelle a grenzt an b,
                        gemeinsame Grenzlänge, Distanz

    gelegenheit         das Herzstück. Jedes Ereignis, das etwas
                        wert sein könnte, wird ein Fall mit Zustand,
                        Anlass, betroffenen Parzellen, Mandant,
                        zuständiger Person und Ergebnis.
    anruf               strukturiertes Gespräch (Abschnitt 6)

### Warum "Gelegenheit" die wichtigste Tabelle ist

Das zweite Papier sagt es in Abschnitt 4 selbst: *"We should not just
receive alerts. Each relevant event should create a structured case."*

Eine Meldung, die nur als Benachrichtigung erscheint, ist nach zwei
Tagen Rauschen. Eine Gelegenheit hat einen Zustand (`erkannt`,
`geprüft`, `dem Kunden gemeldet`, `in Bearbeitung`, `abgeschlossen`,
`verworfen`), einen Anlass und ein Ergebnis. Erst dadurch lässt sich
die Kennzahl aus Abschnitt 8 überhaupt messen -- *"Track which
opportunities were identified, communicated and converted"* -- und
erst dadurch kann man einem Kunden am Jahresende zeigen, was das Abo
gebracht hat.

Jede der drei Produktlinien erzeugt denselben Objekttyp:

    Monitor                 Baugesuch beim Nachbarn        -> Gelegenheit
    Acquisition             Arrondierungs-Ziel gefunden    -> Gelegenheit
    Portfolio Intelligence  Ausnützungsreserve entdeckt    -> Gelegenheit

Das ist der Grund, warum sich später Dienste hinzufügen lassen, ohne
das System neu zu bauen: ein neuer Dienst ist eine neue *Quelle* von
Gelegenheiten, kein neues Teilsystem.

### Was mit den 118 Spalten geschieht

Nicht löschen, nicht auf einmal umziehen. Die Parzellentabelle bleibt
bestehen und bekommt die neuen Beziehungen daneben; die neuen Tabellen
werden gefüllt, Sichten halten die alte Oberfläche am Laufen, und die
Spalten verschwinden einzeln, wenn niemand mehr darauf zugreift. Ein
Umbau in einem Schritt bei 396'271 Zeilen und laufendem Telefonbetrieb
wäre fahrlässig.

---

## 2. Datenquellen -- was geprüft ist

### Parzellengeometrie (Voraussetzung für alles)

Die Liegenschaftspolygone der Amtlichen Vermessung gibt es über
**geodienste.ch**, die Aggregationsplattform der Kantone, als WFS und
als Dateidownload; der Kanton Zürich betreibt zusätzlich einen eigenen
Dienst (`maps.zh.ch/wfs/AVZHWFS`), Datenmodell `DM01AVZH24`.

**Achtung, kommerziell:** Die Zürcher AV-Ressourcen sind im
Open-Data-Katalog als *"Non-commercial Allowed / Commercial With
Permission Allowed / Reference Required"* lizenziert. Für ein Produkt,
das institutionellen Investoren verkauft wird, braucht es also eine
Bewilligung. Das ist vor dem Bau zu klären, nicht danach.

### Baugesuche

| Kanton | Lage heute |
|---|---|
| **ZH** | Offener Datensatz "Baugesuche im Kanton Zürich" des Statistischen Amts auf opendata.swiss. Täglich aktualisiert. Seit 2025 mit BFS-Nummer und als georeferenzierte Fassung (GPKG). **Hier ist Überwachung sofort machbar.** |
| **TG** | **Kein offener Datensatz.** Das vollständig elektronische Amtsblatt ("ePublikation") kommt erst im 1. Halbjahr 2027. Das eBau-Portal läuft seit 2026 im Pilot. |

Das ist eine harte Einschränkung, die ins Verkaufsgespräch gehört:
**Maradona Monitor ist zum Start ein Zürcher Produkt.** Für den
Thurgau gibt es bis 2027 keine verlässliche maschinelle Quelle.

Daneben steht das **Amtsblattportal** (SECO), das SHAB und kantonale
Amtsblätter bündelt. Es ist der naheliegende zweite Weg.

### Eigentümer -- der eigentliche Engpass

Das Grundbuch ist in der Schweiz **nicht** offen abfragbar. Heute holt
Maradona die Eigentümer einzeln über die kantonalen Portale, mit
SMS-Bestätigung pro Sitzung und einem Lesezeichen, das zwanzig
Parzellen am Stück abarbeitet.

Das trägt die heutige Akquise. Es trägt **nicht** die Zusage aus
Abschnitt 3, Portfolios fortlaufend zu überwachen: bei einer Meldung
müssen die Nachbarn *sofort* bekannt sein, nicht in zwei Wochen
Handarbeit. Hier liegt die grösste ungelöste Frage des ganzen
Vorhabens, und sie ist keine technische, sondern eine Beschaffungs-
frage:

- Gibt es für die Zielkantone einen lizenzierbaren Eigentümerbezug?
- Zu welchen Kosten je Abfrage oder je Jahr?
- Was erlaubt die Lizenz -- Speichern, Weitergabe an den Kunden?

**Vorschlag:** Eigentum wird nach Priorität gefüllt, nicht flächig.
Zuerst die Parzellen in Kundenportfolios und deren direkte Nachbarn.
Das sind pro Portfolio Hunderte, nicht Hunderttausende, und das ist
mit dem heutigen Verfahren zu schaffen.

### Ungeprüft -- vor der Umsetzung zu klären

- Genauer Feldaufbau und Aktualisierungsrhythmus des ZH-Baugesuch-
  Datensatzes; ob EGRID oder nur BFS und Adresse mitkommt.
- Ob das Amtsblattportal eine offene Lese-Schnittstelle hat. Es gibt
  dazu nur eine inoffizielle Quelle; die offizielle Dokumentation
  habe ich nicht gefunden.
- Ob der Thurgau die AV-Liegenschaften über geodienste.ch
  herausgibt und zu welcher Lizenz.
- Preise. In diesem Papier steht bewusst keine Zahl in Franken --
  jede wäre geraten. Sie gehören eingeholt.

---

## 3. Automatisierung

Der Ablauf aus Abschnitt 4 des zweiten Papiers, als Kette:

    täglich
      1  Baugesuche des Vortags holen            (ZH: opendata.swiss)
      2  auf Parzelle zuordnen                   EGRID, sonst
                                                 BFS + Parzellennummer,
                                                 sonst Punkt im Polygon
      3  Nachbarn bestimmen                      PostGIS, vorberechnet
      4  Treffer gegen Portfolios prüfen         gehört ein Nachbar
                                                 einem Mandanten?
      5  Gelegenheit anlegen                     mit Anlass, Parzellen,
                                                 Mandant, Vorschlag
      6  Aufgabe zuweisen                        an das Akquise-Team
      7  Ergebnis festhalten                     für den Kundenbericht

Schritt 2 ist der wunde Punkt. Ein Gesuch, das der falschen Parzelle
zugeordnet wird, erzeugt eine Meldung über ein fremdes Grundstück --
und dieses Projekt hatte genau diesen Fehler schon einmal, als eine
Auskunft beim falschen Objekt landete (Migration
`20260912150000_falsche_zuordnung_gubler.sql`). Deshalb: **jede
Zuordnung trägt ihre Herkunft und ihre Sicherheit.** Was nicht
eindeutig ist, wird einem Menschen vorgelegt, statt still ein
falsches Ergebnis zu erzeugen.

Betrieben wird das mit den Abläufen, die schon da sind -- dieselbe
Technik wie `kanton-laden.yml` und `pipedrive.yml`.

---

## 4. Skalierung

Gemessen, nicht geschätzt: **bei 396'271 Zeilen laufen Abfragen schon
heute in die Zeitgrenze.** Am 31. Oktober, nach dem Aufwachen der
Datenbank:

    TG: HTTP 500  {"code":"57014","message":"canceling statement
                   due to statement timeout"}

Dasselbe geschah am 6. September und wurde mit einem Index auf
`kanton` behoben. Mit Kundenportfolios, Nachbarschaften und Baugesuchen
kommen Grössenordnungen dazu. Was daraus folgt:

- **Nachbarschaft wird vorberechnet**, nicht bei jeder Anfrage
  gerechnet. `ST_Touches` über 400'000 Polygone ist nichts für den
  Klick eines Benutzers.
- **GIST-Index auf der Geometrie**, Teilindizes auf den Abfragen, die
  die Oberfläche wirklich stellt.
- **Mandantenkennung in jedem Index**, der Kundendaten betrifft -- ein
  Kunde darf nie durch die Daten eines anderen laufen müssen.
- Der heutige Gratis-Tarif bei Supabase pausiert nach einer Woche
  ohne Zugriff. Am 31. Oktober war genau das der Grund, warum die
  Seite leer war. **Für ein Produkt mit Kundenzusagen ist das
  untragbar** -- ein bezahlter Tarif ist Voraussetzung, kein Extra.

---

## 4a. Die Karte über die ganze Schweiz

Zielbild ist eine Karte über das ganze Land, nicht über zwei Kantone.
Das ist keine spätere Erweiterung, sondern eine Entscheidung, die
*jetzt* zwei Dinge festlegt.

### Die Karte lässt sich nicht als JSON ausliefern

Heute holt die Anwendung Zeilen über PostgREST als JSON. Gemessen am
31. Oktober: schon bei 396'271 Zeilen (ZH + TG) läuft die Abfrage in
die Zeitgrenze (`57014`). Eine Karte über die ganze Schweiz bedeutet
Millionen von Polygonen -- der Weg trägt das nicht, auch mit jedem
Index nicht.

Dafür gibt es genau eine übliche Antwort: **Vektorkacheln**. PostGIS
rechnet mit `ST_AsMVT` je Zoomstufe und Kachel ein fertiges Paket,
der Browser lädt nur, was im Bild ist. Das ist ein anderer
Auslieferungsweg als alles, was die Anwendung heute tut, und er gehört
deshalb in die Planung, bevor die Geometrie eingelesen wird -- die
Speicherung und die Indizes richten sich danach.

Was daraus folgt: Die Karte ist kein Bildschirm, den man am Schluss
dazubaut. Sie ist ein eigener Dienst.

### Landesweite Karte heisst nicht landesweites Produkt

Diese beiden Dinge sind zu trennen, sonst verspricht der Vertrieb
etwas, das die Daten nicht hergeben:

| | Reichweite heute |
|---|---|
| **Grundkarte, Luftbild, Geokodierung** | **Schweizweit.** `src/lib/swisstopo.ts` nutzt `api3.geo.admin.ch` -- Bundesdaten, gratis, ohne Schlüssel und ohne Kontingent. Dieser Teil ist bereits national. |
| **Parzellengeometrie** | Über geodienste.ch grundsätzlich schweizweit harmonisiert, aber **je Kanton** verfügbar und **je Kanton** lizenziert. 26 Abklärungen, nicht eine. |
| **Baugesuche** | ZH offen und täglich, TG erst ab 2027. Für die übrigen Kantone ungeprüft. |
| **Eigentümer** | Je Kanton ein eigenes Portal, je Kanton ein eigener Ablauf. |
| **ÖREB-Kataster** | `src/lib/oereb.ts` zeigt heute **fest auf Zürich** (`maps.zh.ch`, `OerebKatasterZH`). |

Die Karte kann also früh landesweit sein. *Maradona Monitor* kann es
nicht -- der hängt an den Baugesuchen, und die sind kantonal.

### Was der Code dafür braucht

Das Datenmodell trägt es bereits: EGRID ist schweizweit eindeutig und
schon heute der Schlüssel, `kanton` ist eine Spalte. Kein Neubau.

Zwei Stellen sind aber hart begrenzt:

- `src/hooks/use-canton.tsx` führt `CantonId` als festen Typ über
  **fünf** Kantone (`'ZH' | 'TG' | 'ZG' | 'AG' | 'LU'`), davon zwei
  aktiv. Für die Schweiz müssen es 26 werden -- eine kleine Änderung
  mit vielen Folgestellen, weil der Typ überall mitgeht.
- Die Portaladressen stehen an 38 Stellen, aber gebündelt in
  `portal.ts`, `grundbuch.ts` und `oereb.ts`, mit Tests. Das ist die
  richtige Naht: sie wurde im September schon einmal gezogen, als der
  Thurgau dazukam. `oereb.ts` ist die Ausnahme und muss nachziehen.

### Reihenfolge

Die Karte kommt **nicht** am Schluss. Sie kommt in zwei Stufen:

1. **Mit Priorität 1**: Geometrie für ZH und TG, Vektorkacheln, der
   Kartendienst steht. Auf zwei Kantonen, aber auf der Technik, die
   auch 26 trägt.
2. **Danach fortlaufend**: Kanton für Kanton dazu, sobald Lizenz und
   Bezug geklärt sind. Jeder Kanton ist dann ein Einlesevorgang, kein
   Umbau.

Der Fehler, den man hier machen kann, ist, die Karte für zwei Kantone
auf dem JSON-Weg zu bauen, weil es dort gerade noch geht -- und sie
beim zehnten Kanton wegzuwerfen.

### Ungeprüft

- **Wie viele Grundstücke die Schweiz hat.** Ich habe keine belastbare
  Zahl gefunden; ZH + TG sind gemessen 396'271. Die Gesamtzahl gehört
  bei swisstopo oder über geodienste.ch erfragt, bevor irgendetwas
  dimensioniert wird.
- **Die Lizenzlage je Kanton.** Hier gibt es einen Widerspruch:
  Zürich meldete 2017, die kantonalen Geodaten seien ab 2018
  "kostenlos und ohne Einschränkung" nutzbar -- im Katalog war eine
  AV-Ressource dagegen als bewilligungspflichtig für kommerzielle
  Nutzung ausgewiesen. Welches für die Liegenschaftsgeometrie gilt,
  ist vor dem Bezug zu klären, und zwar je Kanton.

---

## 5. Entwicklungsplan

Die Reihenfolge folgt Abschnitt 9, mit einem vorgezogenen Schritt 0.

**Schritt 0 -- Voraussetzungen.** Ohne diese drei ist der Rest nicht
baubar:
1. Anmeldung und Mandantentrennung zurück (siehe Abschnitt 6).
2. Bezahlter Datenbank-Tarif.
3. Lizenz für die AV-Geometrie geklärt.

**Priorität 1 -- Fundament.** PostGIS, Parzellengeometrie einlesen,
das Entitätenmodell anlegen, Nachbarschaft vorberechnen, Eigentümer
aus den heutigen Textfeldern zu echten Akteuren verdichten,
strukturierte Anrufdaten.

*Messbar fertig, wenn:* "Zeig mir alle Parzellen von X" und "Zeig mir
die Nachbarn von Parzelle Y" beide in unter einer Sekunde antworten,
und ein Anruf Verkaufsabsicht, Preisvorstellung und Wiedervorlage
strukturiert festhält.

**Priorität 2 -- Institutionelle Dienste.** Portfolio-Import,
Baugesuch-Überwachung ZH, Gelegenheiten aus Meldungen,
Arrondierungs-Ablauf, Kundenbericht.

*Messbar fertig, wenn:* ein Kundenportfolio hochgeladen wird, das
System die Parzellen und Nachbarn selbst findet, und ein Baugesuch
beim Nachbarn binnen 24 Stunden eine Gelegenheit erzeugt.

**Priorität 3 -- Intelligenz und Erlös.** Investor-Abgleich,
Lead-Reaktivierung, Landingpages, Portfolio-Optimierung.

*Messbar fertig, wenn:* ein neu erfasstes Investorprofil passende
Objekte aus dem Bestand vorschlägt.

### Zu Aufwand und Kosten

Abschnitt 10 verlangt "estimated costs". Eine seriöse Zahl steht hier
erst, wenn drei Dinge beantwortet sind: die Lizenzkosten der
Geodaten, die Beschaffbarkeit der Eigentümerdaten und die Frage, ob
Maradona Monitor zum Start nur Zürich abdeckt. Alle drei verändern
den Aufwand um ein Mehrfaches. Eine Zahl vor diesen Antworten wäre
geraten -- und dieses Projekt hat mit Raten schon Tage verloren.

---

## 6. Der blockierende Punkt: Zugang

Am 31. Oktober wurde die Anmeldung auf Wunsch entfernt -- alle drei
Masken. Für eine interne Akquise-Liste ist das eine Entscheidung, die
man treffen kann.

Für diese Plattform ist es ein Widerspruch, der nicht aufzulösen ist:

- Abschnitt 3 will Portfolios von Helvetica, SFP und Swisscanto führen.
- Abschnitt 7 verlangt "different companies, teams and acquisition
  strategies, with the required data permissions and privacy
  safeguards".
- Abschnitt 6 will Investorprofile mit Budget und Strategie speichern.

Nichts davon darf auf einer Datenbank liegen, die jeder mit der
Adresse der Webseite lesen kann. Ein institutioneller Kunde wird
genau diese Frage als erste stellen.

**Was deshalb gilt:** Die neuen Tabellen für Mandanten, Portfolios,
Investorprofile und Anrufe werden mit Regeln angelegt, die anonymen
Zugriff **verweigern**. Sie bleiben leer und unbenutzbar, bis es
wieder eine Anmeldung gibt. Das ist Absicht: lieber eine Tabelle, die
noch nichts kann, als Kundendaten im offenen Netz.

Die Entscheidung, wann die Anmeldung zurückkommt, liegt beim
Auftraggeber -- gebaut werden kann der institutionelle Teil erst
danach.

---

## 7. Was als Nächstes zu entscheiden ist

1. Kommt die Anmeldung zurück, und in welcher Form -- ganze Seite,
   oder nur der institutionelle Teil?
2. Wird die AV-Lizenz für kommerzielle Nutzung eingeholt?
3. Startet Maradona Monitor als Zürcher Produkt, oder wird auf den
   Thurgau 2027 gewartet?
4. Gibt es ein Budget für lizenzierte Eigentümerdaten, oder bleibt
   es beim portfolio-weisen Nachfüllen über die Portale?

Antworten auf diese vier bestimmen den Aufwand. Ohne sie ist jeder
Zeitplan eine Erfindung.
