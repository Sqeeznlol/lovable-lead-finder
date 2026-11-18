import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { projektAus, projektSatz, projektZaehlt, registerLink } from '@/lib/bauprojekt';
import { bewerten, CALC_ANNAHMEN, type CalcEingabe } from '@/lib/calc';
import { belege, nichtMehrOeffentlich } from '@/lib/baugesuch-belege';
import type { ZonenRegeln } from '@/lib/machbarkeit';

/**
 * Ein bewilligtes Projekt geht jeder eigenen Rechnung vor (Julian,
 * 18. November). Die Einträge sind gekürzt aus der Antwort des Registers
 * vom 18. November für Kloten: Dietlikerstrasse 49 bewilligt (20
 * Wohnungen, 5 Geschosse), die Tiefgarage 49.1 ohne Wohnungen, Amselweg 7
 * projektiert, Dietlikerstrasse 52 bestehend.
 */
const wohnungen49 = [60, 96, 64, 96, 60, 96, 64, 96, 60, 96, 64, 96, 60, 96, 64, 96, 60, 96, 64, 96];
const d49 = { featureId: '192104376_0', attributes: { egid: '192104376', gstat: 1002, gastw: 5, ganzwhg: 20, garea: 412, warea: wohnungen49, strname_deinr: 'Dietlikerstrasse 49', gexpdat: '16.11.2026' } };
const garage = { featureId: '192105502_0', attributes: { egid: '192105502', gstat: 1002, gastw: 1, ganzwhg: null, garea: null, strname_deinr: 'Dietlikerstrasse 49.1', gexpdat: '16.11.2026' } };
const a7 = { featureId: '192064541_0', attributes: { egid: '192064541', gstat: 1001, gastw: 5, ganzwhg: 19, garea: 444,
  warea: [120, 66, 66, 108, 120, 66, 66, 120, 120, 66, 66, 120, 120, 66, 66, 120, 115, 66, 115], strname_deinr: 'Amselweg 7', gexpdat: '16.11.2026' } };
const d52 = { featureId: '21388_0', attributes: { egid: '21388', gstat: 1004, gastw: 3, ganzwhg: 6, garea: 164, gbauj: 1960 } };

describe('Projekt aus dem Gebäuderegister', () => {
  it('bestehende Gebäude sind kein Projekt', () => {
    expect(projektAus([d52])).toBeNull();
    expect(projektAus([{ attributes: { gstat: 1007 } }, { attributes: { gstat: 1008 } }])).toBeNull();
  });

  it('bewilligt: Wohnungen, Wohnfläche und Geschosse; die Tiefgarage zählt nicht als Neubau', () => {
    const p = projektAus([d49, garage, d52])!;
    expect(p.status).toBe('bewilligt');
    expect(p.gebaeude).toBe(1);
    expect(p.wohnungen).toBe(20);
    expect(p.wohnflaeche).toBe(1580);
    expect(p.geschosse).toBe(5);
    expect(p.stand).toBe('16.11.2026');
    expect(projektSatz(p)).toBe(`Bewilligt: ein Neubau mit 20 Wohnungen, rund ${(1580).toLocaleString('de-CH')} m² Wohnfläche, 5 Geschosse`);
  });

  it('ein Gebäude mit zwei Eingängen zählt einmal', () => {
    const p = projektAus([d49, { ...d49, featureId: '192104376_1' }])!;
    expect(p.wohnungen).toBe(20);
    expect(p.bauten).toHaveLength(1);
  });

  it('der weiteste Stand gilt; fehlt bei einem Bau die Fläche, keine halbe Summe', () => {
    const p = projektAus([a7, d49])!;
    expect(p.status).toBe('bewilligt');
    expect(p.wohnungen).toBe(39);
    expect(projektAus([d49, { ...a7, attributes: { ...a7.attributes, warea: undefined } }])!.wohnflaeche).toBeNull();
  });

  it('nur ein bewilligtes oder begonnenes Projekt mit Fläche ersetzt die Formel', () => {
    expect(projektZaehlt(projektAus([d49]))).toBe(true);
    expect(projektZaehlt(projektAus([a7]))).toBe(false);
    expect(projektZaehlt(projektAus([{ ...d49, attributes: { ...d49.attributes, gstat: 1003 } }]))).toBe(true);
    expect(projektZaehlt(null)).toBe(false);
  });

  it('der Link öffnet den Bau im Kartenviewer des Bundes mit seinen Angaben', () => {
    expect(registerLink('192104376_0')).toBe('https://map.geo.admin.ch/#/map?lang=de&z=12&bgLayer=ch.swisstopo.swissimage&layers=ch.bfs.gebaeude_wohnungs_register@features=192104376_0&featureInfo=bottomPanel');
  });
});

const zone: ZonenRegeln = {
  bezeichnung: 'Wohnzone 4', abkuerzung: 'W4', gemeinde: 'Kloten', az: 0.9, bmz: null, uez: null, vollgeschosse: 4, dachgeschosse: 1,
  untergeschosse: null, hoehe: null, hoeheArt: null, wohnanteilMin: null, rechtsstatus: 'inKraft', dokument: null, quelle: 'kanton',
};
const e: CalcEingabe = {
  grundlage: { flaeche: 1200, bebaubarM2: 600, zone, gebaeude: [], registerVollstaendig: true },
  annahmen: CALC_ANNAHMEN, kanton: 'ZH', hand: {}, umfeld: {}, jahr: 2026,
};

describe('Rechnung mit bewilligtem Projekt', () => {
  const ohne = bewerten(e).neubau!;
  const mit = bewerten({ ...e, projekt: projektAus([d49, garage]) }).neubau!;

  it('rechnet mit Wohnfläche und Wohnungen des Projekts, nicht mit der Formel', () => {
    expect(ohne.projekt).toBe(false);
    expect(mit.projekt).toBe(true);
    expect(mit.hnf).toBe(1580);
    expect(mit.wohnungen).toBe(20);
    expect(mit.hnfFormel).toBeCloseTo(ohne.hnf, 6);
    expect(mit.erloes).toBeCloseTo(1580 * CALC_ANNAHMEN.erloes, 3);
    expect(mit.hnfText).toMatch(/^Bewilligt: ein Neubau mit 20 Wohnungen.*Gebäuderegister, Stand 16\.11\.2026/);
  });

  it('nennt das Projekt mit Zahl als erste Chance und den Abschnitt in der Herkunft', () => {
    const b = bewerten({ ...e, projekt: projektAus([d49]) });
    expect(b.chancen[0]).toMatch(/^Bewilligt: ein Neubau mit 20 Wohnungen.*Gerechnet ist mit diesem Projekt .*die Formel ergäbe/);
    expect(b.herkunft[0].titel).toBe('Bewilligtes Projekt (Gebäuderegister)');
  });

  it('ein nur eingereichtes Projekt: die Formel rechnet, das Projekt steht bei den Risiken', () => {
    const b = bewerten({ ...e, projekt: projektAus([a7]) });
    expect(b.neubau!.projekt).toBe(false);
    expect(b.neubau!.hnf).toBeCloseTo(ohne.hnf, 6);
    expect(b.risiken[0]).toMatch(/^Eingereicht: ein Neubau mit 19 Wohnungen.*gerechnet ist nach der Formel/);
  });

  it('der Nachbar rechnet ohne das Projekt der Hauptparzelle', () => {
    const b = bewerten({ ...e, projekt: projektAus([d49]), nachbarn: [{ egrid: 'CH000000000001', nummer: '2', flaeche: 800, zone, gebaeude: [] }] });
    const allein = bewerten({ ...e, grundlage: { flaeche: 800, bebaubarM2: null, zone, gebaeude: [], registerVollstaendig: true } });
    expect(b.zusammen!.teile[0].wertAllein).toBeCloseTo(allein.wert!, 3);
  });
});

describe('Publikation im Amtsblatt nur bis zum Ablauf', () => {
  const g = { publikation_id: '9af63c78-bb8d-462e-b636-6b73d4a436f9', publikation_nr: 'BP-ZH01-0000054709', quelle_url: 'https://daten.statistik.zh.ch/q.csv', publiziert_bis: '2026-07-25' };
  it('vor dem Ablauf: Publikation und PDF', () => {
    expect(belege(g, new Date('2026-07-25T12:00:00Z')).map(x => x.titel)).toEqual(['Publikation im Amtsblatt', 'Publikation als PDF', 'Quelle']);
    expect(nichtMehrOeffentlich(g, new Date('2026-07-25T12:00:00Z'))).toBeNull();
  });
  it('danach keine Links, die auf eine Fehlermeldung führen', () => {
    expect(belege(g, new Date('2026-11-18T12:00:00Z')).map(x => x.titel)).toEqual(['Quelle']);
    expect(nichtMehrOeffentlich(g, new Date('2026-11-18T12:00:00Z'))).toBe('2026-07-25');
    expect(belege({ ...g, quelle: 'amtsblatt', quelle_url: 'https://amtsblatt.be.ch/#!/x' }, new Date('2026-11-18T12:00:00Z'))).toEqual([]);
  });
  it('ohne Ablaufdatum wie bisher', () => {
    expect(belege({ ...g, publiziert_bis: null }, new Date('2030-01-01')).map(x => x.titel)).toEqual(['Publikation im Amtsblatt', 'Publikation als PDF', 'Quelle']);
  });
});

describe('Der Hinweis aufs Projekt bleibt, wo gerechnet wird', () => {
  // Fehlt er, rechnet Aurora wieder still neben einem bewilligten Projekt (18. November).
  it('Machbarkeit und CALC zeigen ihn und geben das Projekt in die Rechnung', async () => {
    const { readFileSync } = await import('node:fs');
    const machbarkeit = readFileSync('src/components/Machbarkeit.tsx', 'utf8');
    const calc = readFileSync('src/components/calc/Rechnung.tsx', 'utf8');
    expect(machbarkeit).toMatch(/<ProjektHinweis /);
    expect(machbarkeit).toMatch(/projekt: projekt\.data/);
    expect(calc).toMatch(/<ProjektHinweis /);
    expect(calc).toMatch(/projekt: basis\.projekt/);
    // Auch die Nachbarn in CALC rechnen ohne das Projekt der Hauptparzelle.
    expect(calc).toMatch(/nachbarn: \[\], dichte, projekt: null/);
  });

  it('nach dem Ablauf führt der Knopf auf die Parzelle mit dem Baustand im Register', async () => {
    const { parzelleLink } = await import('@/lib/bauprojekt');
    expect(parzelleLink('CH970577700821')).toBe('https://map.geo.admin.ch/#/map?lang=de&swisssearch=CH970577700821&layers=ch.bfs.gebaeude_wohnungs_register&bgLayer=ch.swisstopo.swissimage');
  });
});
