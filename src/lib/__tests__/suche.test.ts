/**
 * Die Suche versteht Sätze nach Regeln (lib/suche.ts). Diese Fälle sind
 * Julians Beispiel vom 16. November («Alle W2 in Dietikon») und die
 * Formen, in denen man so etwas tippt. Die Gemeinden sind so
 * geschrieben, wie sie im Bestand stehen (Auswerten «suche-daten»,
 * 16. November); «Küsnacht» steht dort zweimal, mit und ohne Klammer.
 */
import { describe, expect, it } from 'vitest';
import { einfach, parzellenBild, satzVerstehen, zoneText, type Gemeinde } from '../suche';

const G: Gemeinde[] = [
  { gemeinde: 'Dietikon', kanton: 'ZH', parzellen: 3476 },
  { gemeinde: 'Uster', kanton: 'ZH', parzellen: 8176 },
  { gemeinde: 'Kloten', kanton: 'ZH', parzellen: 3295 },
  { gemeinde: 'Frauenfeld', kanton: 'TG', parzellen: 4570 },
  { gemeinde: 'Küsnacht (ZH)', kanton: 'ZH', parzellen: 4000 },
  { gemeinde: 'Küsnacht ZH', kanton: 'ZH', parzellen: 12 },
  { gemeinde: 'Wil (ZH)', kanton: 'ZH', parzellen: 900 },
  { gemeinde: 'Wila', kanton: 'ZH', parzellen: 1100 },
  { gemeinde: 'Dorf', kanton: 'ZH', parzellen: 500 },
];
const v = (s: string) => satzVerstehen(s, G);

describe('Suche: Sätze verstehen', () => {
  it('Julians Beispiel: «Alle W2 in Dietikon»', () => {
    const r = v('Alle W2 in Dietikon');
    expect(r.filter).toEqual({ gemeinden: ['Dietikon'], zone: 'W2' });
    expect(r.offen).toEqual([]);
    expect(r.teile).toEqual(['Dietikon', 'Wohnzone, 2 Geschosse']);
  });

  it('klein geschrieben, mit Leerzeichen, als Wort', () => {
    expect(v('w 2 dietikon').filter).toEqual({ gemeinden: ['Dietikon'], zone: 'W2' });
    expect(v('Wohnzone 3 in Uster').filter.zone).toBe('W3');
    expect(v('Kernzonen in Kloten').filter.zone).toBe('K');
    expect(v('3-geschossige Wohnzone in Uster').filter).toEqual({ gemeinden: ['Uster'], zone: 'W3' });
    expect(v('WG3 Frauenfeld').filter.zone).toBe('WG3');
  });

  it('eine Gemeinde mit zwei Schreibweisen ist ein Ort', () => {
    const r = v('W2 in Küsnacht');
    expect(r.filter.gemeinden).toEqual(['Küsnacht (ZH)', 'Küsnacht ZH']);
    expect(r.orte).toEqual(['Küsnacht']);
    expect(v('W2 in Kuesnacht').filter.gemeinden).toHaveLength(2);
  });

  it('der längere Name gewinnt, und ein Ort im Wort zählt nicht', () => {
    expect(v('W2 in Wila').filter.gemeinden).toEqual(['Wila']);
    expect(v('W2 in Wil').filter.gemeinden).toEqual(['Wil (ZH)']);
    // «Dorfzone» ist eine Zone, nicht die Gemeinde Dorf.
    const r = v('Dorfzone in Uster');
    expect(r.filter).toEqual({ gemeinden: ['Uster'], zone: 'D' });
  });

  it('Postleitzahl, und keine Verwechslung mit Baujahr oder Fläche', () => {
    expect(v('W3 in 8953').filter).toEqual({ plz: ['8953'], zone: 'W3' });
    const r = v('Dietikon vor 1980 über 8000 m2');
    expect(r.filter.plz).toBeUndefined();
    expect(r.filter.baujahr_max).toBe(1979);
    expect(r.filter.flaeche_min).toBe(8000);
  });

  it('Baujahr in allen üblichen Formen', () => {
    expect(v('Uster vor 1970').filter.baujahr_max).toBe(1969);
    expect(v('Uster bis 1970').filter.baujahr_max).toBe(1970);
    expect(v('Uster älter als 1950').filter.baujahr_max).toBe(1949);
    expect(v('Uster nach 1990').filter.baujahr_min).toBe(1991);
    expect(v('Uster ab 1990').filter.baujahr_min).toBe(1990);
    expect(v('Uster zwischen 1950 und 1970').filter).toMatchObject({ baujahr_min: 1950, baujahr_max: 1970 });
    expect(v('Uster 1950-1970').filter).toMatchObject({ baujahr_min: 1950, baujahr_max: 1970 });
    expect(v('Uster 1960er').filter).toMatchObject({ baujahr_min: 1960, baujahr_max: 1969 });
    expect(v('Uster Baujahr 1962').filter).toMatchObject({ baujahr_min: 1962, baujahr_max: 1962 });
  });

  it('Fläche: über, unter, von bis, mit Tausender-Hochkomma', () => {
    expect(v("Kloten über 1'000 m²").filter.flaeche_min).toBe(1000);
    expect(v('Kloten mehr als 800 m2').filter.flaeche_min).toBe(800);
    expect(v('Kloten unter 600 qm').filter.flaeche_max).toBe(600);
    expect(v('Kloten 800 bis 1500 m2').filter).toMatchObject({ flaeche_min: 800, flaeche_max: 1500 });
    expect(v('Kloten zwischen 800 und 1500 m2').filter).toMatchObject({ flaeche_min: 800, flaeche_max: 1500 });
  });

  it('Heizung, auch mit Umlaut am Wortanfang', () => {
    expect(v('Uster mit Ölheizung').filter.heizung).toEqual([7530]);
    expect(v('Uster Öl').filter.heizung).toEqual([7530]);
    expect(v('Uster Heizöl').filter.heizung).toEqual([7530]);
    expect(v('Uster mit Gas').filter.heizung).toEqual([7520]);
    expect(v('Uster Öl oder Gas').filter.heizung).toEqual([7520, 7530]);
    expect(v('Uster fossil').filter.heizung).toEqual([7520, 7530]);
    expect(v('Uster mit Wärmepumpe').filter.heizung).toContain(7501);
    expect(v('Uster Fernwärme').filter.heizung).toEqual([7580, 7581, 7582]);
    // «Gasse» ist keine Gasheizung.
    expect(v('Bahnhofgasse Uster').filter.heizung).toBeUndefined();
  });

  it('Potenzial, mit und ohne Mindestfläche', () => {
    expect(v('Kloten mit Potenzial').filter.reserve_min).toBe(1);
    expect(v('Kloten Potenzial ab 200 m2').filter).toMatchObject({ reserve_min: 200 });
    expect(v('Kloten Potenzial ab 200 m2').filter.flaeche_min).toBeUndefined();
    expect(v('Kloten Reserve über 300 m²').filter.reserve_min).toBe(300);
  });

  it('Geschosse und Wohnungen', () => {
    expect(v('Uster ab 3 Geschossen').filter.geschosse_min).toBe(3);
    expect(v('Uster mehr als 2 Stockwerke').filter.geschosse_min).toBe(3);
    expect(v('Uster 2 Geschosse').filter).toMatchObject({ geschosse_min: 2, geschosse_max: 2 });
    expect(v('Uster ab 6 Wohnungen').filter.wohnungen_min).toBe(6);
    expect(v('Uster bis 2 Wohnungen').filter.wohnungen_max).toBe(2);
  });

  it('Art, unbebaut, Eigentümer, Denkmalschutz', () => {
    expect(v('Einfamilienhäuser in Uster').filter.art).toBe('efh');
    expect(v('MFH Uster').filter.art).toBe('mfh');
    expect(v('Bauland in Uster').filter.unbebaut).toBe(true);
    expect(v('unbebaute Parzellen in Uster').filter.unbebaut).toBe(true);
    expect(v('Uster Eigentümer unbekannt').filter.eigentuemer).toBe('unbekannt');
    expect(v('Uster mit Eigentümer').filter.eigentuemer).toBe('bekannt');
    expect(v('Uster denkmalgeschützt').filter.denkmal).toBe('mit');
    expect(v('Uster ohne Denkmalschutz').filter.denkmal).toBe('ohne');
    expect(v('Uster nicht geschützt').filter.denkmal).toBe('ohne');
  });

  it('ein langer Satz mit allem', () => {
    const r = v('Zeige mir alle Einfamilienhäuser in Uster in der W2, gebaut vor 1970, über 600 m² mit Ölheizung und Potenzial, nicht denkmalgeschützt');
    expect(r.filter).toEqual({
      gemeinden: ['Uster'], zone: 'W2', baujahr_max: 1969, reserve_min: 1, flaeche_min: 600,
      heizung: [7530], art: 'efh', denkmal: 'ohne',
    });
    expect(r.offen).toEqual([]);
  });

  it('sagt, was es nicht versteht, und wenn der Ort fehlt', () => {
    const r = v('Alle W2 mit Seesicht in Dietikon');
    expect(r.offen).toEqual(['seesicht']);
    expect(r.filter.zone).toBe('W2');
    const ohne = v('Alle W2 in Zug');
    expect(ohne.filter.gemeinden).toBeUndefined();
    expect(ohne.fremderOrt).toBe('Zug');
    expect(v('Alle W2').fremderOrt).toBeUndefined();
  });

  it('Sortierung', () => {
    expect(v('die grössten Parzellen in Uster').filter.sortierung).toBe('flaeche');
    expect(v('die ältesten Häuser in Uster').filter.sortierung).toBe('baujahr');
  });

  it('Hilfen: Umlaute, Zonentext', () => {
    expect(einfach('Größte Ölheizung Übersicht')).toBe('groesste oelheizung uebersicht');
    expect(zoneText('W2')).toBe('Wohnzone, 2 Geschosse');
    expect(zoneText('K')).toBe('Kernzone');
  });
});

describe('Suche: Bild der Parzelle', () => {
  it('Ausschnitt quadratisch um den Umriss, Umriss in Bildkoordinaten', () => {
    const b = parzellenBild({
      rahmen: [2672600, 1250900, 2672640, 1250920],
      umriss: { type: 'Polygon', coordinates: [[[2672600, 1250900], [2672640, 1250900], [2672640, 1250920], [2672600, 1250920], [2672600, 1250900]]] },
    }, 240)!;
    // 40 m breit, mal 1.35 Rand: 54 m Seite, um die Mitte.
    expect(b.bild).toContain('BBOX=2672593.0,1250883.0,2672647.0,1250937.0');
    expect(b.bild).toContain('WIDTH=240&HEIGHT=240');
    // Die Ecke unten links des Umrisses: x klein, y gross (SVG zählt von oben).
    const [x, y] = b.pfad.slice(1).split(' L')[0].split(' ').map(Number);
    expect(x).toBeCloseTo(12.96, 1);
    expect(y).toBeCloseTo(68.52, 1);
  });

  it('ohne Umriss kein Bild', () => {
    expect(parzellenBild({ rahmen: null, umriss: null })).toBeNull();
  });
});
