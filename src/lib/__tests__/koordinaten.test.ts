import { describe, expect, it } from 'vitest';
import { ellipsoidUeberMeer, lv95NachWgs84, wgs84NachLv95 } from '@/lib/koordinaten';

describe('Landeskoordinaten', () => {
  it('Bundeshaus hin und zurück auf einen Meter', () => {
    // Beispiel aus der swisstopo-Anleitung: 46°57'08.66" / 7°26'22.50"
    const lat = 46 + 57 / 60 + 8.66 / 3600, lon = 7 + 26 / 60 + 22.5 / 3600;
    const { e, n } = wgs84NachLv95(lat, lon);
    expect(Math.abs(e - 2600072.37)).toBeLessThan(1.5);
    expect(Math.abs(n - 1200147.07)).toBeLessThan(1.5);
    const z = lv95NachWgs84(e, n);
    expect(Math.abs(z.lat - lat) * 111_000).toBeLessThan(1.5);
    expect(Math.abs(z.lon - lon) * 76_000).toBeLessThan(1.5);
  });
  it('Ellipsoid über Meer: 49.55 m in Bern, in Kloten rund 47 m (Formel von swisstopo)', () => {
    const bern = ellipsoidUeberMeer(46 + 57 / 60 + 8.66 / 3600, 7 + 26 / 60 + 22.5 / 3600);
    expect(Math.abs(bern - 49.55)).toBeLessThan(0.01);
    // Kloten, Dorfstrasse (2686338 / 1256375): 49.55 - 12.60 * 0.0863 - 22.64 * 0.0564
    expect(ellipsoidUeberMeer(47.4525, 8.5835)).toBeCloseTo(47.19, 1);
  });
  it('Zürich Paradeplatz landet in Zürich', () => {
    const z = lv95NachWgs84(2683000, 1247000);
    expect(z.lat).toBeGreaterThan(47.3); expect(z.lat).toBeLessThan(47.4);
    expect(z.lon).toBeGreaterThan(8.5); expect(z.lon).toBeLessThan(8.6);
  });
});
