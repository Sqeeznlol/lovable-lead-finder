import { describe, expect, it } from 'vitest';
import { umkreisSatz, umkreisZeilen, type Umkreis } from '../umkreis';

const heute = new Date('2026-11-15T12:00:00Z');
const leer: Umkreis = { meter: 300, n365: 0, n90: 0, seit: '2025-11-16', neubau: 0, umbau: 0, aufstockung: 0, waermepumpe: 0, solar: 0, abbruch: 0 };

describe('Baugesuche im Umkreis', () => {
  it('ganzes Jahr in Zürich, Datum bei jungen Daten', () => {
    expect(umkreisSatz({ ...leer, n365: 6 }, heute)).toBe('Im Umkreis von 300 m wurden in den letzten zwölf Monaten 6 Baugesuche publiziert.');
    expect(umkreisSatz({ ...leer, n365: 1, seit: '2026-10-14' }, heute)).toBe('Im Umkreis von 300 m wurde seit dem 14. Oktober 2026 ein Baugesuch publiziert.');
    expect(umkreisSatz(leer, heute)).toBeNull();
  });
  it('nicht erfasster Kanton: nichts statt null Gesuche', () => {
    expect(umkreisSatz({ ...leer, seit: null }, heute)).toBeNull();
    expect(umkreisZeilen({ ...leer, n365: 3, seit: null })).toEqual([]);
  });
  it('keine doppelte Zahl: alle aus den letzten drei Monaten', () => {
    expect(umkreisZeilen({ ...leer, n365: 3, n90: 3, seit: '2026-10-14' })).toEqual([]);
  });
  it('nur Arten mit Gesuchen', () => {
    const z = umkreisZeilen({ ...leer, n365: 4, n90: 2, neubau: 1, umbau: 3, aufstockung: 1 });
    expect(z.map(x => `${x.titel} ${x.wert}`)).toEqual(['Neubau 1', 'Umbau, Anbau, Sanierung 3', 'davon Aufstockung 1', 'Letzte drei Monate 2']);
  });
});
