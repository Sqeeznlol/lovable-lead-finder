import { describe, expect, it } from 'vitest';
import { gesamt, quellen, trichterJeMarke, type TrichterZeile } from '@/lib/lead-auswertung';

const z = (marke: string, ereignis: string, sitzungen: number, quelle = 'direkt'): TrichterZeile => ({ marke, domain: `${marke}.ch`, ereignis, sitzungen, quelle });

describe('Auswertung der Check-Seiten', () => {
  const zeilen = [
    z('hauszugross', 'aufruf', 80, 'facebook'), z('hauszugross', 'aufruf', 20), z('hauszugross', 'suche', 40, 'facebook'),
    z('hauszugross', 'lead', 4, 'facebook'), z('parzellenchecker', 'aufruf', 50), z('parzellenchecker', 'lead', 1),
    z('parzellenchecker', 'ratgeber', 9),
  ];

  it('zählt je Marke über alle Quellen und Domains, Ratgeber zählt nicht als Schritt', () => {
    const t = trichterJeMarke(zeilen);
    expect(t.map(m => m.marke)).toEqual(['hauszugross', 'parzellenchecker']);
    expect(t[0].werte).toMatchObject({ aufruf: 100, suche: 40, lead: 4, ergebnis: 0 });
    expect(t[0].quote).toBeCloseTo(0.04);
    expect(t[1].werte.aufruf).toBe(50);
  });

  it('summiert und teilt nach Quelle', () => {
    expect(gesamt(trichterJeMarke(zeilen))).toMatchObject({ aufruf: 150, lead: 5 });
    expect(quellen(zeilen)).toEqual([
      { quelle: 'facebook', besucher: 80, leads: 4 },
      { quelle: 'direkt', besucher: 70, leads: 1 },
    ]);
  });

  it('ohne Besucher keine Quote statt Division durch null', () => {
    expect(trichterJeMarke([z('x1', 'lead', 1)])[0].quote).toBeNull();
  });
});
