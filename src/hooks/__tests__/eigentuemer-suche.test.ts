import { describe, expect, it } from 'vitest';
import { nameNorm, zusammenfuehren } from '../use-eigentuemer-suche';

describe('Eigentümersuche', () => {
  it('normalisiert wie akteur_norm in der Datenbank', () => {
    expect(nameNorm('Müller AG')).toBe('muellerag');
    expect(nameNorm('Mueller AG')).toBe(nameNorm('Müller AG'));
    expect(nameNorm('Swisscanto (CH) Real Estate Fund')).toBe('swisscantochrealestatefund');
  });

  it('führt Akteur und Textnamen zu einem Eintrag zusammen, der Akteur gewinnt', () => {
    const r = zusammenfuehren(
      [{ id: 'a1', name: 'Müller AG', art: 'firma' }],
      ['Mueller AG', 'MÜLLER AG', 'Meier Hans'],
    );
    expect(r).toEqual([
      { name: 'Müller AG', akteurId: 'a1', art: 'firma' },
      { name: 'Meier Hans', akteurId: null, art: null },
    ]);
  });

  it('lässt leere Namen weg und begrenzt die Liste', () => {
    const r = zusammenfuehren([], ['', '  ', ...Array.from({ length: 10 }, (_, i) => `Firma ${i}`)], 4);
    expect(r.map(x => x.name)).toEqual(['Firma 0', 'Firma 1', 'Firma 2', 'Firma 3']);
  });
});
