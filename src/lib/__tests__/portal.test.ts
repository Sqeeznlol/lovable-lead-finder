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

describe('Landeskoordinaten in der Thurgauer Adresse', () => {
  // Ohne sie oeffnet "swisssearch" nur das Vorschlagsfeld -- die Karte
  // bleibt, wo sie war. Ein Klick in die Mitte trifft dann eine fremde
  // Parzelle oder nichts. Der Unterschied ist an der Adresse ablesbar.
  it('setzt E, N und die Nadel, wenn die Koordinaten bekannt sind', () => {
    const url = portalUrl('TG', 'CH738977838269', null,
      { e: 2727291.75, n: 1279215.5 });
    expect(url).toContain('E=2727291.75');
    expect(url).toContain('N=1279215.50');
    expect(url).toContain('crosshair=marker');
    // Und ohne Suche: das Vorschlagsfeld laege ueber der Karte und
    // finge den Klick ab, der der Parzelle gilt.
    expect(url).not.toContain('swisssearch');
  });

  it('kommt ohne sie aus, ohne kaputte Adresse', () => {
    const url = portalUrl('TG', 'CH738977838269');
    expect(url).not.toContain('E=');
    expect(url).not.toContain('crosshair');
    expect(url).toContain('swisssearch=CH738977838269');
  });

  it('haengt sie Zuerich nicht an -- dort fuehrt ein anderes Portal', () => {
    const url = portalUrl('ZH', 'CH1', '261', { e: 2683000, n: 1247000 });
    expect(url).toContain('portal.objektwesen.zh.ch');
    expect(url).not.toContain('E=');
  });
});
