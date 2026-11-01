import { describe, expect, it } from 'vitest';
import { OHNE_FILTER, filterAktiv, passtFilter } from '../kartenfilter';

describe('Kartenfilter', () => {
  const efh = { flaeche: 800, marge: 600_000, art: 'Einfamilienhaus' };

  it('lässt ohne Filter alles durch, auch Parzellen ohne Angaben', () => {
    expect(passtFilter(efh, OHNE_FILTER)).toBe(true);
    expect(passtFilter({}, OHNE_FILTER)).toBe(true);
    expect(filterAktiv(OHNE_FILTER)).toBe(false);
  });

  it('filtert nach Mindestfläche; ohne Fläche fällt die Parzelle heraus', () => {
    expect(passtFilter(efh, { ...OHNE_FILTER, flaecheAb: 500 })).toBe(true);
    expect(passtFilter(efh, { ...OHNE_FILTER, flaecheAb: 1000 })).toBe(false);
    expect(passtFilter({ flaeche: null }, { ...OHNE_FILTER, flaecheAb: 500 })).toBe(false);
  });

  it('filtert nach Marge; "mit Marge" schliesst null und 0 aus', () => {
    expect(passtFilter(efh, { ...OHNE_FILTER, margeAb: 1 })).toBe(true);
    expect(passtFilter({ marge: 0 }, { ...OHNE_FILTER, margeAb: 1 })).toBe(false);
    expect(passtFilter({ marge: null }, { ...OHNE_FILTER, margeAb: 1 })).toBe(false);
    expect(passtFilter(efh, { ...OHNE_FILTER, margeAb: 1_000_000 })).toBe(false);
  });

  it('filtert nach Objektart genau, wie sie in kategorie steht', () => {
    expect(passtFilter(efh, { ...OHNE_FILTER, art: 'Einfamilienhaus' })).toBe(true);
    expect(passtFilter(efh, { ...OHNE_FILTER, art: 'Mehrfamilienhaus' })).toBe(false);
    expect(passtFilter({ art: ' Mehrfamilienhaus ' }, { ...OHNE_FILTER, art: 'Mehrfamilienhaus' })).toBe(true);
  });
});
