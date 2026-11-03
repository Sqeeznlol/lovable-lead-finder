import { describe, expect, it } from 'vitest';
import { heizungBeschreiben, heizungKurz, type ParzelleGebaeude } from '@/lib/parzelle-gebaeude';

// Texte wie in gwr_kode (Ablauf "Gebäude", 3. November).
const kodes = new Map([['GENH:7530', 'Heizöl'], ['GENH:7511', 'Erdwärmesonde'], ['GWAERZH:7430', 'Heizkessel (generisch) für ein Gebäude']]);
const p = (x: Partial<ParzelleGebaeude>): ParzelleGebaeude => ({
  egrid: 'CH1', gebaeude: 1, wohnungen: null, geschosse_max: null, baujahr_aeltestes: null, baujahr_juengstes: null,
  energieflaeche: null, haupt_baujahr: null, haupt_heizung: null, haupt_heizung_energie: null, haupt_heizung_seit: null, fossil: false, ...x,
});

describe('Heizung einer Parzelle', () => {
  it('nennt Energie, Wärmeerzeuger und Jahr, soweit bekannt', () => {
    expect(heizungBeschreiben(p({ haupt_heizung_energie: 7530, haupt_heizung: 7430, haupt_heizung_seit: '2001-05-01' }), kodes))
      .toBe('Heizöl, Heizkessel (generisch) für ein Gebäude, seit 2001');
    expect(heizungBeschreiben(p({ haupt_heizung_energie: 7511 }), kodes)).toBe('Erdwärmesonde');
  });
  it('zeigt den Code, solange die Codetabelle fehlt, und nichts ohne Eintrag', () => {
    expect(heizungBeschreiben(p({ haupt_heizung_energie: 7530 }), new Map())).toBe('Code 7530');
    expect(heizungBeschreiben(p({}), kodes)).toBeNull();
    expect(heizungBeschreiben(undefined, kodes)).toBeNull();
  });
  it('fasst für Listen in Gruppen zusammen', () => {
    expect(heizungKurz(p({ haupt_heizung_energie: 7530 }), kodes)).toBe('Heizöl');
    expect(heizungKurz(p({ haupt_heizung_energie: 7511 }), kodes)).toBe('Wärmepumpe');
    expect(heizungKurz(p({}), kodes)).toBeNull();
  });
});
