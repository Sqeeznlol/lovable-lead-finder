import { describe, expect, it } from 'vitest';
import { naechsteReihe } from '../reihe';

const o = (id: string, egrid: string | null, marge: number, eig?: string) => ({
  id, egrid, marge, eigentuemer: eig ?? null, address: `Weg ${id}`, parzelle: id,
});

describe('naechsteReihe', () => {
  it('nimmt die groesste Marge zuerst', () => {
    const r = naechsteReihe([o('a', 'CH1', 1e6), o('b', 'CH2', 5e6), o('c', 'CH3', 3e6)], 3);
    expect(r.map(x => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('haelt sich an die Anzahl -- zwanzig am Tag sind zwanzig', () => {
    const viele = Array.from({ length: 50 }, (_, i) => o(String(i), `CH${i}`, i));
    expect(naechsteReihe(viele, 20)).toHaveLength(20);
  });

  it('laesst aus, was schon einen Eigentuemer hat', () => {
    const r = naechsteReihe([o('a', 'CH1', 9e6, 'Meier'), o('b', 'CH2', 1e6)], 5);
    expect(r.map(x => x.id)).toEqual(['b']);
  });

  it('laesst aus, was keine EGRID hat -- das Portal faende nichts', () => {
    const r = naechsteReihe([o('a', null, 9e6), o('b', 'CH2', 1e6)], 5);
    expect(r.map(x => x.id)).toEqual(['b']);
  });

  it('nimmt dieselbe Parzelle nicht zweimal', () => {
    // Zwei Zeilen, ein Grundstueck: sonst kostet eine Antwort zwei
    // der zwanzig Auskuenfte.
    const r = naechsteReihe([o('a', 'CH1', 5e6), o('b', 'CH1', 4e6), o('c', 'CH2', 1e6)], 5);
    expect(r.map(x => x.egrid)).toEqual(['CH1', 'CH2']);
  });

  it('gibt nichts zurueck, wenn nichts verlangt ist', () => {
    expect(naechsteReihe([o('a', 'CH1', 1)], 0)).toEqual([]);
  });
});
