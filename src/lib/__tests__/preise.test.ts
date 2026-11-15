import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { chf, preisZeilen, type Preise } from '../preise';

const daten = JSON.parse(readFileSync('public/preise.json', 'utf8')) as Preise;

describe('Preise je Gemeinde', () => {
  it('stimmen mit der amtlichen Datei überein (Uster 2025, am 15. November nachgesehen)', () => {
    const u = daten.gemeinden['198'];
    expect(u.name).toBe('Uster');
    expect(u.efh).toMatchObject({ m: 1630000, n: 47, z: '2025' });
    expect(u.stwe).toMatchObject({ m: 1100000, n: 123 });
    // Einfamilienhäuser kosten in Zürich mehr als Wohnungen; sonst sind die Dateien vertauscht.
    expect(daten.gemeinden['261'].efh!.m).toBeGreaterThan(daten.gemeinden['261'].stwe!.m);
  });
  it('nur ZH und BL, nur deutschsprachig', () => {
    expect(new Set(Object.values(daten.gemeinden).map(g => g.k))).toEqual(new Set(['ZH', 'BL']));
  });
  it('zeigt Median, Spanne, Fallzahl und den Boden als Richtwert', () => {
    expect(chf(1630000)).toBe('1.63 Mio.');
    expect(chf(825500)).toBe("826'000");
    const z = preisZeilen(daten.gemeinden['198'], 600);
    expect(z.map(x => x.titel)).toEqual(['Einfamilienhaus', 'Eigentums­wohnung', 'Bauland', 'Ihr Boden']);
    expect(z[0].zusatz).toBe('Median, mittlere Hälfte 1.41 Mio. bis 1.83 Mio. · 47 Verkäufe 2025');
    expect(z[3].wert).toBe('rund CHF 1.71 Mio.');
    expect(z[3].zusatz).toContain('keine Schätzung');
  });
  it('ohne Daten nichts, ohne Fläche kein Boden', () => {
    expect(preisZeilen(undefined, 600)).toEqual([]);
    expect(preisZeilen(daten.gemeinden['198'], null).map(x => x.titel)).not.toContain('Ihr Boden');
  });
});
