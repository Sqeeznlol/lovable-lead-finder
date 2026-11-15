import { describe, expect, it, vi } from 'vitest';

// Jede Tabelle liefert, was hier steht; jede Bedingung wird mitgeschrieben,
// damit der Test sieht, ob nach Parzelle oder nach EGRID gesucht wurde.
const antwort: Record<string, unknown[]> = {};
const gefragt: string[] = [];
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => {
      const kette = {
        select: () => kette, order: () => kette,
        eq: (k: string, v: string) => { gefragt.push(`${t}.${k}=${v}`); return kette; },
        limit: () => Promise.resolve({ data: antwort[t] ?? [] }),
      };
      return kette;
    },
  },
}));
import { bezuegeLaden } from '../bezuege';

describe('Bezüge eines Objekts', () => {
  it('Kunde, Gelegenheit, Lead und Fonds, jedes mit Ziel', async () => {
    antwort.portfolio_position = [{ portfolio: { name: 'Bestand Nord', mandant: { id: 'm1', akteur: { name: 'TEST AG' } } } }];
    antwort.gelegenheit_parzelle = [{ rolle: 'ausloeser', gelegenheit: { id: 'g1', titel: '', anlass: 'nachbar baut', zustand: 'erkannt' } }];
    antwort.anfrage = [{ id: 'a1', name: 'TEST Anna', erstellt_am: '2026-11-01T10:00:00Z' }];
    antwort.fonds_liegenschaft = [{ gefaess: 'TEST Fonds' }];
    const b = await bezuegeLaden('p1', 'CH123456789012');
    expect(b.map(x => [x.art, x.ziel ?? null])).toEqual([
      ['Kunde', '/gelegenheiten?kunde=m1&reiter=alle'],
      ['Gelegenheit', '/gelegenheiten?gelegenheit=g1&reiter=alle'],
      ['Lead', '/leads?lead=a1'],
      ['Fonds', null],
    ]);
    expect(b[0].neben).toBe('Bestand Nord');
    expect(gefragt).toContain('anfrage.egrid=CH123456789012');
    expect(gefragt).toContain('portfolio_position.parzelle_id=p1');
  });
  it('ohne EGRID keine Abfrage nach Leads und Fonds', async () => {
    gefragt.length = 0;
    await bezuegeLaden('p2', null);
    expect(gefragt.some(g => g.startsWith('anfrage') || g.startsWith('fonds'))).toBe(false);
  });
});
