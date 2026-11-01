# DESIGN.md -- Bauraum Lead Finder

Vorlage: "Agentic AI Real Estate CRM SaaS" (Matchora AI, blockaistudio,
Behance/Muzli), am 1. November 2026 von Julian vorgegeben: "genau wie
dort". Sie ersetzt die Apple-Grundlage aus awesome-design-md. Übernommen
wird die Gestaltungssprache, nicht Marke, Logo, Namen oder Bilder der
Vorlage.

## Charakter

Ein Arbeitswerkzeug, das aussieht wie ein Architekturbüro: helle
Flächen, Luftbilder von Gebäuden als Bühne, darauf schmale, fast eckige
Tafeln mit feinen Linien. Viel Weiss, grosse geometrische Schrift,
wenige starke Signale.

## Farben (`src/index.css`)

| Rolle | Wert | Wofür |
|---|---|---|
| Seite | `#F4F4F5` | Hintergrund hinter den Tafeln |
| Tafel | `#FFFFFF` | Listen, Kennzahlen, Karten |
| Tinte | `#111111` | Text, Haupthandlung (schwarzer Knopf), aktiver Menüpunkt |
| Grau | `#646B78` | Untertitel, Zeitangaben, Etiketten |
| Linie | Schwarz 9 % | Rahmen und Trennlinien, keine Schatten |
| Elektroblau | `#3D45F5` | Akzent: Hervorhebung, "Neu"-Handlungen, Kachel für Empfehlungen |
| Orange | `#F26B1D` | nur "heiss": Kachel, Marke, Strichbalken der dringendsten Fälle |
| Violett | `#7C5CFC` | Beträge auf Objektkarten (Marge, Preis) |
| Grün | `#24A15A` | "verfügbar", "geschlossen" (minze), Fortschritt |
| Reiter aktiv | `#1E2433` | gewählter Reiter |

Marken (Chips) pastell: lila `+12 %`, rosa `+3 heute`, minze `3 Wochen`;
voll orange für "Heiss", voll grün und in Grossbuchstaben für
"VERFÜGBAR".

Julians frühere Regel "kein Orange" ist hier bewusst aufgehoben -- er
hat die Vorlage ausdrücklich so verlangt. Orange bleibt dem Signal
"heiss" vorbehalten.

## Schrift

Urbanist (Google Fonts), eine Familie. Titel 500, eng (`-0.02em`);
grosse Sätze im Cockpit 40/56 px; Kennzahlen 34 px Gewicht 400;
Fliesstext 16 px; Etiketten 11--13 px, Spaltenköpfe in Grossbuchstaben.

## Formen und Abstände

- Ecken fast eckig: Tafeln 4 px, Knöpfe, Felder, Reiter 2--3 px.
- Keine Schatten auf Tafeln; Trennung durch Weiss und feine Linie.
- Höhe von Knöpfen und Feldern 44 px (Handy).
- Kachel vor Tafeltiteln: 44 px Quadrat, farbig, Symbol weiss.

## Bausteine (`src/components/rahmen.tsx`)

- `Kopf` -- Bereichstitel; mit `bild` läuft ein Luftbild rechts nach
  links ins Weiss aus (Verlauf, kein Weichzeichner).
- `Abschnitt` -- Tafeltitel mit Kachel, Untertitel, Zahl, Handlung rechts.
- `Kennzahlen` -- weisse Leiste, Spalten durch Linien getrennt.
- `Reiter` -- "Alle 9 | Heiss | Aktiv", der gewählte dunkel gefüllt.
- `Marke` -- Chips in den Farben oben.
- `Strichbalken` -- dreissig senkrechte Striche für einen Anteil.
- `KNOPF_HAUPT` (schwarz), `KNOPF` (weiss, Linie), `KNOPF_LEISE`
  (grau, "Alle zeigen"), `KNOPF_AKZENT` (blau).

## App-Rahmen

Desktop: schmale Leiste links nur mit Symbolen, der aktive Punkt als
schwarzes Quadrat; oben Suche, rechts die Hauptaktion und das Konto.
Handy: Kopf mit Zeichen und Titel, unten fünf Ziele.

## Bilder

Luftbilder kommen vom Bund (SWISSIMAGE, geo.admin.ch), nicht aus der
Vorlage. Keine erfundenen Personenfotos, keine Buchstaben-Kästchen als
Ersatz.

## Was bleibt (Julians Regeln)

- Kein Weichzeichner hinter Text: Text muss auch unter Windows scharf
  sein. Bilder laufen über einen Farbverlauf aus.
- Keine Spiel-Elemente, keine Benachrichtigungs-Abzeichen, keine
  doppelten Zahlen.
- Alles auf dem iPhone (390 px) prüfen, bevor es live geht.
