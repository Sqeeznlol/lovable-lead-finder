import { describe, it, expect } from 'vitest';
import { naechsteParzelle, naechsteAdresse } from '../naechste';

const objekte = [
  { id: 'a', egrid: 'CH1', marge: 5_000_000, kanton: 'TG' },
  { id: 'b', egrid: 'CH2', marge: 20_000_000, kanton: 'TG' },
  { id: 'c', egrid: 'CH3', marge: 12_000_000, kanton: 'TG' },
];

describe('naechsteParzelle', () => {
  it('nimmt das grösste Potenzial zuerst', () => {
    expect(naechsteParzelle(objekte)?.id).toBe('b');
  });

  it('überspringt, was eben erledigt wurde', () => {
    // Die Datenbank liefert die alte Zeile oft noch einen Moment lang.
    expect(naechsteParzelle(objekte, ['b'])?.id).toBe('c');
    expect(naechsteParzelle(objekte, ['b', 'c'])?.id).toBe('a');
  });

  it('überspringt, was schon einen Eigentümer hat', () => {
    const mit = [{ ...objekte[1], eigentuemer: 'Hans Müller' }, objekte[2]];
    expect(naechsteParzelle(mit)?.id).toBe('c');
  });

  it('überspringt, was keine EGRID hat -- ohne sie geht keine Abfrage', () => {
    expect(naechsteParzelle([{ id: 'x', marge: 99_000_000 }])).toBeNull();
  });

  it('meldet, wenn nichts mehr offen ist', () => {
    expect(naechsteParzelle(objekte, ['a', 'b', 'c'])).toBeNull();
  });
});

describe('naechsteAdresse', () => {
  it('führt in das Portal des richtigen Kantons', () => {
    expect(naechsteAdresse({ id: 'b', egrid: 'CH770977292983', kanton: 'TG' }))
      .toContain('map.geo.tg.ch');
    expect(naechsteAdresse({ id: 'b', egrid: 'CH592077140849', kanton: 'ZH', bfsNr: '230' }))
      .toContain('objektwesen.zh.ch');
  });
});
