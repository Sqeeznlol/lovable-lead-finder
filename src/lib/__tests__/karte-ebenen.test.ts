/**
 * Der Knopf hiess "Luftbild" und zeigte einen weissen Vermessungsplan:
 * eine zweite, deckende Ebene lag über dem Bild. Dieser Test lässt
 * das nicht wieder zu.
 */
import { describe, expect, it } from 'vitest';
import { BAUZONEN, GRENZEN, GRUNDKARTEN, WMS_MAX, wmsAdresse } from '@/lib/karte-ebenen';

describe('Kartenebenen', () => {
  it('jede Grundkarte ist genau eine deckende Kachelebene', () => {
    for (const [name, e] of Object.entries(GRUNDKARTEN)) {
      expect(e.art, name).toBe('wmts');
      expect(e.deckkraft ?? 1, name).toBe(1);
      expect(e.ext, name).toBeDefined();
    }
  });

  it('das Luftbild ist das Luftbild', () => {
    expect(GRUNDKARTEN.luftbild.id).toBe('ch.swisstopo.swissimage');
  });

  it('was über der Grundkarte liegt, lässt sie durchscheinen', () => {
    for (const e of [GRENZEN, BAUZONEN]) {
      expect(e.art, e.id).toBe('wms');
      expect(e.deckkraft, e.id).toBeGreaterThan(0);
      expect(e.deckkraft, e.id).toBeLessThan(1);
    }
  });
});

describe('Ein WMS-Bild statt Kacheln', () => {
  const a = { west: 950000, sued: 5990000, ost: 952000, nord: 5991000 };

  it('fragt genau den Ausschnitt in Web-Mercator an', () => {
    const u = new URL(wmsAdresse(GRENZEN, a, 1600, 800));
    expect(u.hostname).toBe('wms.geo.admin.ch');
    expect(u.searchParams.get('SRS')).toBe('EPSG:3857');
    expect(u.searchParams.get('BBOX')).toBe('950000,5990000,952000,5991000');
    expect(u.searchParams.get('WIDTH')).toBe('1600');
    expect(u.searchParams.get('HEIGHT')).toBe('800');
    expect(u.searchParams.get('LAYERS')).toBe(GRENZEN.id);
  });

  it('bleibt durchsichtig, sonst deckt es die Grundkarte', () => {
    const u = new URL(wmsAdresse(BAUZONEN, a, 100, 100));
    expect(u.searchParams.get('TRANSPARENT')).toBe('TRUE');
    expect(u.searchParams.get('FORMAT')).toBe('image/png');
  });

  it('hat einen Deckel für die Bildgrösse', () => {
    expect(WMS_MAX).toBeGreaterThanOrEqual(1024);
    expect(WMS_MAX).toBeLessThanOrEqual(4096);
  });
});
