import { describe, expect, it } from 'vitest';
import { moeglich, summieren, type Gebaeude, type Parzelle } from './arrondierung-zusammen';

const geb = (x: Partial<Gebaeude>): Gebaeude => ({
  egid: '1', adresse: null, baujahr: null, status: 1004, geschosse: null, grundflaeche: null, ebf: null,
  volumen: null, wohnungen: null, wohnflaeche: null, e: null, n: null, ...x,
});
const parz = (flaeche: number, gebaeude: Gebaeude[]): Parzelle => ({ egrid: 'CH1', nummer: '1', flaeche, zone: null, umriss: null, gebaeude });

describe('summieren', () => {
  it('zählt die echten Werte aller gewählten Parzellen zusammen', () => {
    const s = summieren([
      parz(3554, [geb({ grundflaeche: 274, ebf: 996, wohnungen: 11, wohnflaeche: 657, baujahr: 2018, geschosse: 4 })]),
      parz(891, [geb({ grundflaeche: 113, ebf: 200, wohnungen: 1, wohnflaeche: 120, baujahr: 1922, geschosse: 2 })]),
    ]);
    expect(s.flaeche).toBe(4445);
    expect(s.gebaeude).toBe(2);
    expect(s.ebf).toBe(1196);
    expect(s.wohnflaeche).toBe(777);
    expect(s.baujahr).toBe(1922);
    expect(s.geschosse).toBe(4);
    expect(s.ueberbauung).toBeCloseTo(387 / 4445);
  });
  it('rechnet fehlende Angaben nicht als null, sondern zählt sie', () => {
    const s = summieren([parz(500, [geb({ ebf: null, wohnungen: 2, wohnflaeche: null })])]);
    expect(s.ebf).toBeNull();
    expect(s.ohneEbf).toBe(1);
    expect(s.ohneWohnflaeche).toBe(1);
  });
});

describe('moeglich', () => {
  it('gibt ohne Ausnützungsziffer keine Zahl', () => {
    expect(moeglich(4445, null, 10)).toBeNull();
  });
  it('rechnet Fläche mal AZ mit Bonus', () => {
    expect(moeglich(4445, 1.2, 10)).toBe(5867);
    expect(moeglich(1000, 0.8, null)).toBe(800);
  });
});
