import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { adresseLesen, comparisOrt, gebaeudeAusRegister, neigungAus, parzelleLesen, portalLinks } from '@/lib/calc-daten';

/**
 * Was CALC YOU LATER vom Bund liest. Die Beispiele sind echte Antworten
 * (Dufourstrasse 90 in Zürich, abgefragt am 16. November), nicht erdacht.
 */
describe('CALC YOU LATER: Adresse des Bundes', () => {
  it('liest Strasse, Postleitzahl, Ort, Gemeindenummer und Kanton', () => {
    const a = adresseLesen('Dufourstrasse 90 <b>8008 Zürich</b>', 'dufourstrasse 90 8008 zuerich 261 zuerich ch zh', 2684016, 1246018.125);
    expect(a).toEqual({ label: 'Dufourstrasse 90 8008 Zürich', strasse: 'Dufourstrasse 90', plz: '8008', ort: 'Zürich', e: 2684016, n: 1246018.125, kanton: 'ZH', bfs: '261' });
  });

  it('bleibt ohne Angaben leer statt zu raten', () => {
    const a = adresseLesen('Irgendwo', '', 1, 2);
    expect(a.strasse).toBe('Irgendwo');
    expect(a.plz).toBeNull();
    expect(a.kanton).toBeNull();
    expect(a.bfs).toBeNull();
  });

  it('ein Ort aus mehreren Wörtern bleibt ganz', () => {
    const a = adresseLesen('Bahnhofstrasse 5 <b>8910 Affoltern am Albis</b>', 'bahnhofstrasse 5 8910 affoltern am albis 2 affoltern am albis ch zh', 1, 2);
    expect(a.ort).toBe('Affoltern am Albis');
    expect(a.bfs).toBe('2');
  });
});

describe('CALC YOU LATER: Gebäude aus dem Register', () => {
  it('übernimmt Fläche, Geschosse, Baujahr und Wohnungen', () => {
    expect(gebaeudeAusRegister({ gstat: 1004, garea: 393, gastw: 7, gbauj: 1961, gvol: 7610 })).toEqual({ grundflaeche: 393, geschosse: 7, baujahr: 1961, wohnungen: null });
    expect(gebaeudeAusRegister({ gstat: 1004, garea: 200, gastw: 3, gbauj: 1965, ganzwhg: 6 })!.wohnungen).toBe(6);
  });

  it('was nicht steht, zählt nicht zum Bestand', () => {
    expect(gebaeudeAusRegister({ gstat: 1007, garea: 200, gastw: 3 })).toBeNull();
    expect(gebaeudeAusRegister({ gstat: 1001, garea: 200, gastw: 3 })).toBeNull();
  });
});

describe('CALC YOU LATER: Portale', () => {
  it('öffnet die Suche der Portale, liest sie aber nicht aus', () => {
    const l = portalLinks({ strasse: 'Dufourstrasse 90', plz: '8008', ort: 'Zürich' });
    expect(l.map(x => x.adresse.split('?')[0])).toEqual([
      'https://www.homegate.ch/rent/apartment/zip-8008/matching-list',
      'https://www.comparis.ch/immobilien/marktplatz/zuerich/wohnung/mieten',
      'https://www.google.com/search',
    ]);
    expect(decodeURIComponent(l[2].adresse)).toContain('"Dufourstrasse 90" 8008 Zürich mieten');
  });

  it('rät die Schreibweise eines Ortes aus mehreren Wörtern nicht', () => {
    const l = portalLinks({ strasse: 'Bahnhofstrasse 5', plz: '8910', ort: 'Affoltern am Albis' });
    expect(l[1].adresse.startsWith('https://www.google.com/search?q=')).toBe(true);
    expect(decodeURIComponent(l[1].adresse)).toContain('site:comparis.ch Wohnung mieten 8910 Affoltern am Albis');
  });

  it('nichts im Code holt Seiten von Comparis oder Homegate', () => {
    // Nur Links für Menschen: beide Portale verbieten das automatische Auslesen.
    for (const f of ['src/lib/calc-daten.ts', 'src/lib/calc.ts', 'src/components/calc/Rechnung.tsx']) {
      const t = readFileSync(f, 'utf8');
      expect(t).not.toMatch(/fetch\([^)]*(comparis|homegate)/i);
    }
  });
});

describe('CALC YOU LATER: Kauf und Gelände', () => {
  it('Kaufinserate: Homegate nach Postleitzahl, Comparis mit Kanton im Ortsnamen', () => {
    // Nachgesehen am 16. November: /buy/apartment/zip-8802/... und /kilchberg-zh/wohnung/kaufen.
    const l = portalLinks({ strasse: 'Hochweidstrasse 9', plz: '8802', ort: 'Kilchberg ZH' }, 'kaufen');
    expect(l[0].adresse).toBe('https://www.homegate.ch/buy/apartment/zip-8802/matching-list');
    expect(l[1].adresse).toBe('https://www.comparis.ch/immobilien/marktplatz/kilchberg-zh/wohnung/kaufen');
    expect(decodeURIComponent(l[2].adresse)).toContain('"Hochweidstrasse 9" 8802 Kilchberg ZH kaufen');
    expect(comparisOrt('Zürich')).toBe('zuerich');
    expect(comparisOrt('Affoltern am Albis')).toBeNull();
  });

  it('Steigung aus vier Höhen des Geländemodells', () => {
    // Hochweidstrasse 9, Kilchberg, je 15 m: Nord 508.2, Süd 510.5, Ost 508.3, West 508.9.
    expect(neigungAus({ n: 508.2, s: 510.5, o: 508.3, w: 508.9 })).toBe(7.9);
    expect(neigungAus({ n: 500, s: 500, o: 500, w: 500 })).toBe(0);
    expect(neigungAus({ n: 506, s: 500, o: 500, w: 500 })).toBe(20);
  });
});

// Echte Antworten der Parzellensuche des Bundes, 17. November.
describe('CALC YOU LATER: eine Parzelle statt einer Adresse', () => {
  it('liest Nummer, Ort und Gemeindenummer', () => {
    expect(parzelleLesen('<b>Kloten</b> 2061 (CH 4105 7008 7781)', '2061 kloten 62 ch410570087781', 2686769, 1255481.625))
      .toEqual({ label: 'Parzelle 2061, Kloten', strasse: 'Parzelle 2061', plz: null, ort: 'Kloten', e: 2686769, n: 1255481.625, kanton: null, bfs: '62' });
    expect(parzelleLesen('<b>Zürich</b> AU1344 (CH 6191 2299 7880)', 'au1344 zuerich 261 ch619122997880', 1, 2)!.label).toBe('Parzelle AU1344, Zürich');
  });
  it('ohne Ort oder Nummer keine Parzelle', () => {
    expect(parzelleLesen('Kloten 2061', '', 1, 2)).toBeNull();
    expect(parzelleLesen('<b>Kloten</b>', '', 1, 2)).toBeNull();
  });
  it('für eine Parzelle keine Suche nach Inseraten an der Adresse', () => {
    const p = parzelleLesen('<b>Kloten</b> 2061 (CH 4105 7008 7781)', '2061 kloten 62 ch410570087781', 1, 2)!;
    expect(portalLinks(p).map(l => l.titel)).toEqual(['Comparis: Wohnungen in Kloten']);
  });
});
