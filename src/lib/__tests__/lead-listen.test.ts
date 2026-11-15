import { describe, expect, it } from 'vitest';
import { baujahrOder, bauzeit, csv, periodenBis } from '../lead-listen';

describe('Lead-Listen', () => {
  it('Baujahr: genaues Jahr oder ganze Periode davor', () => {
    expect(periodenBis(1980)).toEqual([8011, 8012, 8013, 8014, 8015]);
    expect(periodenBis(1960)).toEqual([8011, 8012, 8013]);
    expect(baujahrOder(1960)).toBe('baujahr.lte.1960,and(baujahr.is.null,periode.in.(8011,8012,8013))');
    expect(bauzeit({ baujahr: null, periode: 8013 })).toBe('1946–1960');
  });
  it('CSV mit Semikolon, Texten statt Codes und TEST-freien Beispieldaten', () => {
    const t = csv([{ egid: 1, egrid: 'CHTEST', kanton: 'ZH', bfs: 198, gemeinde: 'Uster', strasse: 'TEST-Weg 1', plz: 8610, ort: 'Uster',
      baujahr: 1965, periode: 8014, wohnungen: 3, klasse: 1122, heizung: 7530, e: 2696000, n: 1245000 }]);
    expect(t.split('\r\n')[1]).toBe('TEST-Weg 1;8610;Uster;Uster;ZH;1965;Mehrfamilienhaus;3;Heizöl;1;CHTEST;2696000;1245000');
  });
});
