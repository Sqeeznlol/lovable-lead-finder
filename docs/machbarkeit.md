# Machbarkeitsstudie in Aurora

Stand 15. November 2026. Für Julian und Tim: was die Studie heute
rechnet, woher jede Zahl stammt, was sie nicht weiss, und wie sie
geprüft wird, bevor sie an Kunden geht.

Julian, 15. November: «eine Machbarkeitsstudie mit Aurora, aber richtig
gute, die realistisch sind, nicht von Architekten, die alles beachten».

## Der Grundsatz

Ein Architekt rechnet eine Variante schön. Aurora rechnet nüchtern und
sagt bei jeder Zahl, woher sie kommt:

| Herkunft | Bedeutung |
|---|---|
| **amtlich** | So steht es beim Amt: Amtliche Vermessung, Zonenplan des Kantons, Gebäuderegister, Preisstatistik |
| **berechnet** | Aus amtlichen Zahlen gerechnet, ohne eigene Annahme |
| **Annahme** | Ein Erfahrungswert, den man in der Studie ändern kann und im Einzelfall prüfen muss |

Was nicht rechenbar ist, wird nicht geschätzt: die Studie sagt dann in
einem Satz, was fehlt.

## Wo sie steht

In der Objektansicht jeder Parzelle, unter «In Aurora»: Knopf
«Rechnen». Erst dann werden Zonenplan und Umriss geholt. Das Ergebnis
lässt sich als PDF sichern.

## Was sie rechnet

Zwei Grenzen bestimmen, wie viel gebaut werden darf, und die engere
gilt:

1. **Die Ziffer.** Ausnützungsziffer mal Grundstücksfläche, oder
   Baumassenziffer mal Fläche, geteilt durch die Geschosshöhe.
2. **Die Hülle.** Der Umriss der Parzelle, rundum um den Grenzabstand
   nach innen versetzt (höchstens die Überbauungsziffer), mal die
   erlaubten Vollgeschosse.

Wer nur die Ziffer rechnet, verspricht auf einem schmalen Grundstück
Flächen, die zwischen den Abständen keinen Platz haben. Die Studie sagt
darum, welche Grenze gilt.

Dazu:

- **Dachgeschoss.** Bei der Ausnützungsziffer kommt es zur Fläche der
  Vollgeschosse dazu (Faktor 0.66 eines Vollgeschosses). Bei der
  Baumassenziffer ist es im Volumen schon enthalten.
- **Bestand.** Grundfläche mal Geschosse je Gebäude, aus dem
  Gebäuderegister. Daraus Reserve und Ausnützung in Prozent.
- **Zwei Varianten.** Ersatzneubau (was nach Erlös, Baukosten, Abbruch
  und Marge des Entwicklers für das Land bleibt) und Aufstocken oder
  Anbauen (nur die Reserve).
- **Der Massstab.** Der gerechnete Landwert je m² steht neben dem, was
  in der Gemeinde für Wohnbauland bezahlt wurde (amtliche Statistik,
  Median und mittlere Hälfte). Liegt die Rechnung weit darüber oder
  darunter, sagt die Studie das.
- **Prüfpunkte.** Am Schluss steht, was eine Fachperson noch ansehen
  muss, mit Link auf die amtlichen Dokumente der Gemeinde.

## Woher die Zahlen kommen

| Zahl | Quelle | Herkunft |
|---|---|---|
| Fläche, Umriss | Amtliche Vermessung (geodienste.ch) | amtlich |
| Zone, Ausnützungs-, Baumassen-, Überbauungsziffer | Zonenplan des Kantons Zürich (WFS, Grundnutzung) | amtlich |
| Vollgeschosse, Dachgeschosse, Höhen, Wohnanteil | derselbe Zonenplan | amtlich |
| Bauordnung und Zonenplan als Dokument | Kataster der Eigentumsbeschränkungen, Link je Zone | amtlich |
| Gebäude: Grundfläche, Geschosse, Baujahr | Gebäude- und Wohnungsregister | amtlich |
| Landpreise, Preise für Eigentumswohnungen | Statistisches Amt Zürich, je Gemeinde | amtlich |
| Grenzabstand | Eingabe, Ausgangswert 5 m | Annahme |
| Geschosshöhe (Baumasse → Fläche) | 3.2 m | Annahme |
| Hauptnutzfläche | 77 % der Geschossfläche | Annahme |
| Baukosten, Abbruch, Erlös, Marge | 3'200 / 250 / 9'500 CHF je m², 15 % | Annahme |

Nachgesehen, nicht angenommen: der Zürcher Dienst führt Ausnützung und
Überbauung in **Prozent** (70 heisst 0.70), die Baumasse in m³/m². Das
ist mit den Werten einer echten Zonenfläche in Uster als Test abgelegt
(`src/lib/__tests__/machbarkeit.test.ts`).

Ausserhalb von Zürich ist kein amtlicher Zonenplan angebunden. Dort
rechnet die Studie mit der Zone aus der eigenen Liste und kennzeichnet
jede dieser Zahlen als Annahme.

## Was sie nicht weiss

1. **Grenzabstände.** Sie stehen in keiner offenen Quelle, nur in der
   Bauordnung jeder Gemeinde, oft als kleiner und grosser Grundabstand
   mit Zuschlägen für lange Fassaden. Die Studie rechnet mit einem Wert
   rundum und zeigt ihn als Annahme.
2. **Gestaltungsplan, Baulinien, Gewässerraum, Lärm, Ortsbild,
   Denkmal.** Stehen im Kataster der Eigentumsbeschränkungen, sind aber
   nicht eingerechnet.
3. **Kosten und Erlös dieses Ortes.** Die Ausgangswerte sind
   Erfahrungswerte für den ganzen Kanton. Der Vergleich mit den
   bezahlten Landpreisen zeigt, ob sie am Ort tragen.
4. **Mieten.** Amtlich gibt es sie nicht je Gemeinde; gerechnet wird
   mit Verkauf.
5. **Parzellen in mehreren Zonen.** Gerechnet wird mit der Zone an
   einem Punkt im Innern der Parzelle.

## Wie sie geprüft wird, bevor sie an Kunden geht

Die Rechnung selbst ist mit von Hand nachgerechneten Fällen getestet
(13 Tests). Ob sie die Wirklichkeit trifft, zeigt erst der Vergleich
mit gebauten Projekten:

1. **20 bewilligte Zürcher Baugesuche** aus dem Bestand auswählen, bei
   denen die bewilligte Geschossfläche bekannt ist. Aurora rechnet die
   Studie, ohne das Projekt zu kennen. Verglichen wird die mögliche
   Geschossfläche mit der bewilligten.
2. **Grenzabstände für eine Pilotgemeinde** (Uster) aus der Bauordnung
   erfassen, mit Seitenangabe, und den Ausgangswert je Zone ersetzen.
3. **Kosten von Tim.** 10 bis 20 abgerechnete Projekte ersetzen die
   Erfahrungswerte für Baukosten und Erlös.

Erst wenn Schritt 1 eine kleine Abweichung zeigt, gehört die Studie in
einen Kundenbericht. Bis dahin ist sie ein Arbeitsmittel für uns.

## Technik

- Rechnung: `src/lib/machbarkeit.ts` (rechnet nur, holt nichts)
- Daten: `src/lib/machbarkeit-daten.ts` (Zonenplan Zürich, Datenbank)
- Umriss und bebaubare Fläche: Funktion `machbarkeit_grundlage`
  (Migration `20261115190000_machbarkeit.sql`), gerechnet mit PostGIS
- Oberfläche: `src/components/Machbarkeit.tsx`
- Preise: `public/preise.json`, monatlich aufgefrischt vom Ablauf
  «Preise»
- Umrisse: Ablauf «Umrisse laden» (`.github/workflows/umrisse.yml`),
  für jeden der 21 Kantone, die geodienste.ch freigibt
