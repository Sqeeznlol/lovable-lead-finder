/**
 * Der Knopf hiess "Luftbild" und zeigte einen weissen Vermessungsplan:
 * eine zweite, deckende Ebene lag über dem Bild. Dieser Test lässt
 * das nicht wieder zu.
 */
import { describe, expect, it } from 'vitest';
import { BAUZONEN, GRENZEN, GRUNDKARTEN, WMS_MAX, esriRinge, wmsAdresse } from '@/lib/karte-ebenen';

describe('Kartenebenen', () => {
  it('jede Grundkarte ist genau eine deckende Kachelebene', () => {
    for (const [name, e] of Object.entries(GRUNDKARTEN)) {
      expect(e.art, name).toBe('wmts');
      expect(e.deckkraft ?? 1, name).toBe(1);
      expect(e.ext, name).toBeDefined();
    }
  });

  it('die Grenzen kommen erst, wenn sie Linien sind und keine grüne Fläche', () => {
    expect(GRENZEN.minZoom).toBeGreaterThanOrEqual(16);
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

  it('hat einen Deckel für die Bildgrösse, nicht über dem, was gemessen noch ein Bild war', () => {
    expect(WMS_MAX).toBeGreaterThanOrEqual(1024);
    expect(WMS_MAX).toBeLessThanOrEqual(4096);
  });
});

describe('Ringe für identify', () => {
  it('nimmt ein Polygon so, wie es ist', () => {
    const g: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[1, 1], [2, 1], [2, 2], [1, 1]]] };
    expect(esriRinge(g)).toEqual([[[1, 1], [2, 1], [2, 2], [1, 1]]]);
  });
  it('macht ein MultiPolygon flach', () => {
    const g: GeoJSON.MultiPolygon = { type: 'MultiPolygon',
      coordinates: [[[[1, 1], [2, 1], [2, 2], [1, 1]]], [[[5, 5], [6, 5], [6, 6], [5, 5]]]] };
    expect(esriRinge(g)).toHaveLength(2);
    expect(esriRinge(g)[1][0]).toEqual([5, 5]);
  });
});

describe('Kachelnähte', () => {
  // Leaflet setzt auf jede Kachel mix-blend-mode:plus-lighter, die Farben
  // werden addiert. Überlappen sich Kacheln um einen Pixel, damit bei
  // Windows-Skalierung keine Spalten bleiben, wird jede Kante doppelt
  // hell -- ein weisses Raster. Überlappung nur zusammen mit "normal".
  it('wer Kacheln überlappen lässt, schaltet das Addieren ab', async () => {
    const { readFileSync } = await import('node:fs');
    const t = readFileSync('src/components/Karte.tsx', 'utf8');
    const regel = /img\.leaflet-tile\{[^}]*\}/.exec(t)?.[0] ?? '';
    if (/width:\s*25[7-9]px/.test(regel)) expect(regel).toMatch(/mix-blend-mode:\s*normal/);
  });
});

describe('Symbolnamen', () => {
  // "import { Map } from 'lucide-react'" überdeckt das eingebaute Map.
  // In NachbarnBund.tsx warf das "Map is not a constructor", und die
  // Nachbarsuche meldete, der Bund antworte nicht. Wer Map als Symbol
  // braucht und zugleich new Map schreibt, muss das Symbol umbenennen.
  it('kein Symbol namens Map, wo new Map gebraucht wird', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const alle = (o: string): string[] => readdirSync(o, { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? (e.name === '__tests__' ? [] : alle(join(o, e.name))) : /\.tsx?$/.test(e.name) ? [join(o, e.name)] : []);
    const schuldige = alle('src').filter(p => {
      const t = readFileSync(p, 'utf8');
      return /import\s*\{[^}]*\bMap\b(?!\s+as)[^}]*\}\s*from\s*'lucide-react'/.test(t) && /new Map\b/.test(t);
    });
    expect(schuldige).toEqual([]);
  });
});
