/**
 * Der Beispielbericht (Julian, 19. November, nach dem Vergleich mit
 * baugesuch.prüfer.ch: «Beispielbericht mit erfundenen Daten ... vor dem
 * ersten Klick sieht man, was man bekommt»). Adresse, Parzelle und Werte
 * sind erfunden und gehören zu keinem Grundstück; Kanton, Zone und der
 * Gesetzesartikel sind echt, damit die Fundstelle zeigt, wie sie wirklich
 * aussieht. So steht es auch auf der Seite und im PDF.
 *
 * Dazu, was ein Eigentümer bekommt (Julian: «mit Angebot»): sofort und
 * ohne Angaben die amtlichen Daten, mit seinen Angaben die Rechnung und
 * den Bericht, auf Wunsch die persönliche Analyse und ein unverbindliches
 * Kaufangebot. Versprochen wird nur, was der Ablauf hält: die Analyse innert
 * zwei Arbeitstagen steht schon auf der Seite, das Kaufangebot entsteht in
 * CALC YOU LATER (Prüfung, Visum, Kontrolle, Bestätigung) ohne eigene Frist
 * gegenüber dem Eigentümer.
 */
import type { BerichtDaten } from './check-bericht';
import { fundstelle, fundstelleZeilen, schnittDaten, type Fundstelle } from './check-fundstelle';
import type { Ziffern } from './check-modell';

export const BEISPIEL_HINWEIS = 'Beispiel mit erfundenen Daten: Adresse, Parzelle und Werte gehören zu keinem Grundstück. Kanton, Zone und Gesetzesartikel sind echt.';

export const BEISPIEL = {
  adresse: 'Beispielweg 12, 8000 Musterhausen',
  ort: 'Musterhausen (erfunden) · Parzelle 0000 · Kanton ZH',
  flaeche: 812,
  haeuser: [{ grundflaeche: 120, geschosse: 2, baujahr: 1968 }],
};

const ZIFFERN: Ziffern = {
  zone: 'Wohnzone W3', kuerzel: 'W3', gemeinde: null, quelle: 'Zonenplan Kanton ZH',
  az: 0.9, bmz: null, uez: null, gruen: null, frei: null, vollgeschosse: 3, dachgeschosse: null, untergeschosse: null, attika: 1,
  gebaeudehoehe: null, fassadenhoehe: null, fassadenhoehe_giebel: null, gesamthoehe: null, firsthoehe: null, wohnanteil: null, unbestimmt: null,
};

export function beispielFundstelle(): Fundstelle {
  return fundstelle({ kanton: 'ZH', ziffern: ZIFFERN, flaeche: BEISPIEL.flaeche, az: 0.9, haeuser: BEISPIEL.haeuser, volumenHeute: null,
    ordnung: { titel: 'Bau- und Zonenordnung der Gemeinde (im Beispiel ohne Link)', url: '' } });
}
export const beispielSchnitt = () => schnittDaten(ZIFFERN, BEISPIEL.haeuser[0].geschosse)!;

/** Der Beispielbericht als PDF, mit denselben Teilen wie ein echter. */
export function beispielBericht(marke: { name: string; farbe: string; domain: string; betreiber: string; betreiberAdresse: string[] }): BerichtDaten {
  const f = beispielFundstelle();
  return {
    marke: marke.name, farbe: marke.farbe, domain: marke.domain, datum: new Date(),
    adresse: `BEISPIEL · ${BEISPIEL.adresse}`, ort: BEISPIEL.ort, egrid: null, bild: null,
    kennzahlen: [
      { titel: 'Grundstücksfläche', wert: `${BEISPIEL.flaeche} m²`, zusatz: 'erfunden' },
      { titel: 'Bauzone', wert: 'W3', zusatz: 'Wohnzone W3' },
      { titel: 'Überbaut', wert: '15 %', zusatz: '120 m² Grundfläche' },
      { titel: 'Ältestes Gebäude', wert: '1968', zusatz: '1 Gebäude' },
    ],
    rechnung: { titel: 'Baureserve mit Fundstelle', satz: BEISPIEL_HINWEIS, zeilen: fundstelleZeilen(f) },
    abschnitte: [
      { titel: 'Was für die Parzelle gilt', zeilen: [
        { titel: 'Zone', wert: 'Wohnzone W3' },
        { titel: 'Erlaubt', wert: 'Ausnützungsziffer 0.9 · 3 Vollgeschosse + Attika' },
        { titel: 'Baulinie', wert: 'keine auf der Parzelle' },
      ] },
    ],
    tipps: [],
    fuer: 'Beispiel',
    betreiber: marke.betreiber, betreiberAdresse: marke.betreiberAdresse,
    quellen: 'Beispiel mit erfundenen Daten. Ein echter Bericht nennt hier die amtlichen Quellen und den Tag der Abfrage.',
  };
}

/** Was ein Eigentümer bekommt: drei Stufen, alle kostenlos. */
export const ANGEBOT: { stufe: string; titel: string; punkte: string[]; preis: string }[] = [
  { stufe: 'Sofort', titel: 'Ohne Angaben', preis: 'kostenlos',
    punkte: ['Parzelle, Fläche und Bauzone aus der amtlichen Vermessung', 'Gebäude, Baujahr und Heizung aus dem Gebäuderegister', 'Rechtslage aus dem ÖREB-Kataster: Baulinien, Lärm, Altlasten', 'Energie, Lage und Baugesuche in der Nachbarschaft'] },
  { stufe: 'Mit Ihren Angaben', titel: 'Rechnung und Bericht', preis: 'kostenlos',
    punkte: ['Baureserve, Zahl für Zahl gerechnet', 'Jede Ziffer mit Fundstelle: Zonenplan, Gesetzesartikel, Zitat', 'Bericht als PDF mit Luftbild und Umriss', 'Tipps für Ihr Haus, mit amtlicher Quelle'] },
  { stufe: 'Auf Wunsch', titel: 'Analyse und Kaufangebot', preis: 'kostenlos und unverbindlich',
    punkte: ['Fachleute prüfen die Bauordnung Ihrer Gemeinde und melden sich innert zwei Arbeitstagen', 'Ein schriftliches, unverbindliches Kaufangebot für Ihr Grundstück', 'Kein Makler, keine Provision, keine Verpflichtung'] },
];
