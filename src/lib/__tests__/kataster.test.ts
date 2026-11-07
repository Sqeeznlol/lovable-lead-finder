import { describe, it, expect } from 'vitest';
import { katasterUrl, oerebThurgauUrl, oerebParzelleUrl } from '../swisstopo';
import { wgs84NachLv95 } from '../koordinaten';

// Diessenhofen TG, Parzelle 454 -- der Fall, an dem der Fehler auffiel:
// der Link führte auf den Zürcher Kataster und zeigte dort eine
// Zürcher Parzelle mit derselben Nummer.
const DIESSENHOFEN = { lat: 47.68724060058594, lon: 8.749064445495605 };

describe('Kataster je Kanton', () => {
  it('führt für Thurgau auf das Thurgauer Portal', () => {
    const url = katasterUrl('TG', DIESSENHOFEN.lat, DIESSENHOFEN.lon, '454', '4545');
    expect(url).toContain('map.geo.tg.ch');
    expect(url).not.toContain('maps.zh.ch');
    expect(url).toContain('topic=oereb');
  });

  it('nimmt für Thurgau Landeskoordinaten, keine Parzellennummer', () => {
    const url = oerebThurgauUrl(DIESSENHOFEN.lat, DIESSENHOFEN.lon);
    expect(url).toMatch(/E=26983\d\d\.\d\d/);
    expect(url).toMatch(/N=12826\d\d\.\d\d/);
  });

  it('führt für Zürich weiter auf den Zürcher Kataster', () => {
    const url = katasterUrl('ZH', 47.37, 8.54, 'VE4739', '230');
    expect(url).toContain('maps.zh.ch');
    expect(url).toContain('locations=230,VE4739');
  });

  it('kommt ohne Parzellennummer aus, wenn der Kanton Zürich ist', () => {
    expect(oerebParzelleUrl(null, '230')).toBeNull();
    const url = katasterUrl('ZH', 47.37, 8.54, null, null);
    expect(url).toContain('maps.zh.ch');
  });

  it('rechnet Längen- und Breitengrad in Landeskoordinaten um', () => {
    const { e, n } = wgs84NachLv95(DIESSENHOFEN.lat, DIESSENHOFEN.lon);
    // Julians Link aus dem Thurgauer Portal nennt für dieselbe Stelle
    // E=2698377.50 N=1282652.13 -- das ist der Kartenmittelpunkt beim
    // Klicken, deshalb ein paar Meter daneben. Zwanzig Meter Toleranz.
    expect(Math.abs(e - 2698377.5)).toBeLessThan(20);
    expect(Math.abs(n - 1282652.13)).toBeLessThan(20);
  });
});

describe('ÖREB Thurgau: Marke und Deckung', () => {
  it('setzt das Fadenkreuz und legt die Liegenschaft zuoberst', () => {
    const url = katasterUrl('TG', 47.68724060058594, 8.749064445495605);
    expect(url).toContain('crosshair=marker');
    expect(url).toContain('oereb_kleinsiedlungen');
    expect(url).toContain('layers_opacity=1,0.9,0.9,0.9,0.9,0.9,0.9');
    expect(url).toContain('zoom=8');
  });
});
