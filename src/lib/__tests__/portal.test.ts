import { describe, it, expect } from 'vitest';
import { portalUrl } from '../portal';

describe('portalUrl', () => {
  it('führt in Zürich ins Portal Objektwesen', () => {
    expect(portalUrl('ZH', 'CH592077140849', 230)).toBe(
      'https://portal.objektwesen.zh.ch/aks/detail'
      + '?egrid=CH592077140849&bfsNr=230',
    );
  });

  it('führt im Thurgau in den kantonalen Kartendienst', () => {
    // Diessenhofen, Parzelle 454 -- der Fall, an dem es auffiel.
    const url = portalUrl('TG', 'CH770977292983', 4545);
    expect(url).toContain('map.geo.tg.ch');
    expect(url).toContain('swisssearch=CH770977292983');
    expect(url).not.toContain('objektwesen.zh.ch');
  });

  it('nimmt Zürich, wenn kein Kanton bekannt ist', () => {
    // Der Bestand kam aus Zürich; ohne Angabe ist das die richtige Wahl.
    expect(portalUrl(null, 'CH592077140849', 230))
      .toContain('objektwesen.zh.ch');
  });
});
