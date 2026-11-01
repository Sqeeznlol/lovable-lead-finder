import { describe, expect, it } from 'vitest';
import { begruendung, prioritaet } from '../arrondierung';

const n = (x: Partial<{ owner_name: string | null; area: number | null; marge_chf: number | null }>) =>
  ({ id: 'x', egrid: 'CH1', address: null, owner_name: null, area: null, marge_chf: null, ...x });

describe('Arrondierung: Priorität', () => {
  it('ohne Nachbarn im Bestand ist sie 0', () => expect(prioritaet([])).toBe(0));
  it('ein bekannter Eigentümer zählt mehr als ein unbekannter', () => {
    expect(prioritaet([n({ owner_name: 'Muster AG' })])).toBe(3);
    expect(prioritaet([n({})])).toBe(1);
  });
  it('Fläche und Marge kommen dazu, negative Marge nicht', () => {
    expect(prioritaet([n({ area: 2500, marge_chf: 1_500_000 })])).toBe(1 + 2.5 + 1.5);
    expect(prioritaet([n({ marge_chf: -400_000 })])).toBe(1);
  });
  it('die Begründung nennt auch die Nachbarn ausserhalb des Bestands', () => {
    expect(begruendung([n({ owner_name: 'A' }), n({})], [{ egrid: 'CH2', nummer: '12' }]))
      .toBe('2 Nachbarn im Bestand, 1 mit Eigentümer, 1 weitere ausserhalb des Bestands.');
    expect(begruendung([], [])).toBe('0 Nachbarn im Bestand.');
  });
});
