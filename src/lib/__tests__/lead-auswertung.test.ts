import { describe, expect, it } from 'vitest';
import { gesamt, quellen, trichterJeSeite, type TrichterZeile } from '@/lib/lead-auswertung';

const z = (marke: string, ereignis: string, sitzungen: number, quelle = 'direkt'): TrichterZeile => ({ marke, domain: `${marke}.ch`, ereignis, sitzungen, quelle });

describe('Auswertung der Check-Seiten', () => {
  const zeilen = [
    z('hauszugross', 'aufruf', 80, 'facebook'), z('hauszugross', 'aufruf', 20), z('hauszugross', 'suche', 40, 'facebook'),
    z('hauszugross', 'lead', 4, 'facebook'), z('parzellenchecker', 'aufruf', 50), z('parzellenchecker', 'lead', 1),
    z('parzellenchecker', 'ratgeber', 9),
  ];

  it('zählt je Webseite über alle Quellen, Ratgeber zählt nicht als Schritt', () => {
    const t = trichterJeSeite(zeilen);
    expect(t.map(m => m.domain)).toEqual(['hauszugross.ch', 'parzellenchecker.ch']);
    expect(t[0].werte).toMatchObject({ aufruf: 100, suche: 40, lead: 4, ergebnis: 0 });
    expect(t[0].quote).toBeCloseTo(0.04);
    expect(t[1].werte.aufruf).toBe(50);
  });

  it('trennt zwei Domains derselben Marke, www zählt zur Domain', () => {
    const t = trichterJeSeite([
      { marke: 'hauszugross', domain: 'hauszugross.ch', ereignis: 'aufruf', sitzungen: 10, quelle: 'direkt' },
      { marke: 'hauszugross', domain: 'www.hauszugross.ch', ereignis: 'aufruf', sitzungen: 5, quelle: 'direkt' },
      { marke: 'hauszugross', domain: 'haus-zu-gross.ch', ereignis: 'aufruf', sitzungen: 7, quelle: 'direkt' },
    ]);
    expect(t.map(x => [x.domain, x.werte.aufruf])).toEqual([['hauszugross.ch', 15], ['haus-zu-gross.ch', 7]]);
    expect(t.every(x => x.marke === 'hauszugross')).toBe(true);
  });

  it('summiert und teilt nach Quelle', () => {
    expect(gesamt(trichterJeSeite(zeilen))).toMatchObject({ aufruf: 150, lead: 5 });
    expect(quellen(zeilen)).toEqual([
      { quelle: 'facebook', besucher: 80, leads: 4 },
      { quelle: 'direkt', besucher: 70, leads: 1 },
    ]);
  });

  it('ohne Besucher keine Quote statt Division durch null', () => {
    expect(trichterJeSeite([z('x1', 'lead', 1)])[0].quote).toBeNull();
  });
});
