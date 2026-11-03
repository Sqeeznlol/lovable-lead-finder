import { describe, expect, it } from 'vitest';
import { filterText } from './Merklisten';

// Der Text steht als Vorschlag für den Namen und im Kopf des PDF --
// er soll die Suche so nennen, wie man sie sagen würde.
describe('filterText', () => {
  it('nennt Gemeinde, Baujahr, Zimmer, Fläche und Art', () => {
    expect(filterText({ gemeinde: 'Kloten', bj_von: '1920', bj_bis: '1929', zi_min: '5', wf_min: '120', art_titel: 'Einfamilienhaus' }))
      .toBe('Kloten · Baujahr 1920–1929 · ab 5 Zimmer · ab 120 m² · Einfamilienhaus');
  });
  it('mit nur einer Grenze', () => {
    expect(filterText({ bj_bis: '1950', zi_max: '4' })).toBe('Baujahr bis 1950 · bis 4 Zimmer');
  });
  it('leer ohne Filter', () => {
    expect(filterText({})).toBe('');
  });
});
