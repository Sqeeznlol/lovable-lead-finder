/**
 * Ein Klick auf ein Haus ohne EGID in der Kachel (Kloten, 4. November:
 * 0 von 1'386 Gebäudeteilen) fragt das Register beim Bund nach dem
 * nächsten Gebäude. Die Treffer hier sind die, die der Bund am selben Tag
 * um die Mitte eines Klotener Hauses lieferte (2684918.4 / 1254694.5,
 * vier Gebäude im Umkreis von 20 m, Abstände 17.13, 14.09, 18.91 und
 * 15.36 m).
 */
import { describe, expect, it } from 'vitest';
import { hausKennung, naechsteEgid } from '@/lib/karte3d';

const TREFFER = [
  { attributes: { egid: '210248737' }, geometry: { x: 2684903.2, y: 1254686.6 } },
  { attributes: { egid: '210248704' }, geometry: { x: 2684904.8, y: 1254690.8 } },
  { attributes: { egid: '24673' }, geometry: { x: 2684931.0, y: 1254680.4 } },
  { attributes: { egid: '24674' }, geometry: { x: 2684933.6, y: 1254696.7 } },
];

describe('Haus ohne EGID in der Kachel', () => {
  it('nimmt das nächste Gebäude des Registers', () => {
    expect(naechsteEgid(TREFFER, 2684918.4, 1254694.5)).toBe(210248704);
    // Dicht an einem anderen Gebäude: dann dieses.
    expect(naechsteEgid(TREFFER, 2684932.0, 1254695.0)).toBe(24674);
  });

  it('greift auf gkode/gkodn zurück, wenn die Lage fehlt', () => {
    expect(naechsteEgid([{ attributes: { egid: 5, gkode: 2684000, gkodn: 1254000 } }], 2684001, 1254001)).toBe(5);
  });

  it('gibt nichts zurück, wenn der Bund nichts findet', () => {
    expect(naechsteEgid([], 2684918, 1254694)).toBeNull();
    expect(naechsteEgid(undefined, 2684918, 1254694)).toBeNull();
    expect(naechsteEgid([{ attributes: { egid: null }, geometry: { x: 1, y: 1 } }], 1, 1)).toBeNull();
  });

  it('erkennt dasselbe Haus mit und ohne Klammern', () => {
    expect(hausKennung('{9DC65D38-F7BD-45F9-AB6A-889E0F08E699}')).toBe(hausKennung('9DC65D38-F7BD-45F9-AB6A-889E0F08E699'));
    expect(hausKennung('')).toBeNull();
    expect(hausKennung(undefined)).toBeNull();
  });
});
