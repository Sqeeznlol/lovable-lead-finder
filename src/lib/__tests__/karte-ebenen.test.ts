/**
 * Der Knopf hiess "Luftbild" und zeigte einen weissen Vermessungsplan:
 * eine zweite, deckende Ebene lag über dem Bild. Dieser Test lässt
 * das nicht wieder zu.
 */
import { describe, expect, it } from 'vitest';
import { BAUZONEN, GRENZEN, GRUNDKARTEN } from '@/lib/karte-ebenen';

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
