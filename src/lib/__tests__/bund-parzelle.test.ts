import { describe, expect, it } from 'vitest';
import { mitte } from '../bund-parzelle';

describe('Schwerpunkt einer Parzelle', () => {
  it('Quadrat: die Mitte', () => {
    expect(mitte([[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]])).toEqual({ e: 5, n: 5 });
  });
  it('L-Form: nicht das Mittel der Ecken, sondern der Flächenschwerpunkt', () => {
    // 2x2 unten links + 1x1 oben links (Fläche 5): Schwerpunkt x = (4*1 + 1*0.5)/5 = 0.9
    const r = mitte([[[0, 0], [2, 0], [2, 2], [1, 2], [1, 3], [0, 3], [0, 0]]]);
    expect(r.e).toBeCloseTo(0.9, 5);
    expect(r.n).toBeCloseTo((4 * 1 + 1 * 2.5) / 5, 5);
  });
  it('entartete Fläche: Mittel der Ecken', () => {
    expect(mitte([[[0, 0], [4, 0], [0, 0]]])).toEqual({ e: 4 / 3, n: 0 });
  });
});
