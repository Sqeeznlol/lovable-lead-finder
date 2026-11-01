import { describe, expect, it } from 'vitest';
import { flaecheLv95 } from '../ortsabfrage';

describe('Fläche aus dem Umriss', () => {
  it('ein Rechteck 30 x 20 m hat 600 m²', () => {
    expect(flaecheLv95({ type: 'Polygon', coordinates: [[[2683000, 1247000], [2683030, 1247000], [2683030, 1247020], [2683000, 1247020], [2683000, 1247000]]] })).toBe(600);
  });
  it('Löcher werden abgezogen, Teilflächen addiert', () => {
    const aussen = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    const loch = [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]];
    expect(flaecheLv95({ type: 'Polygon', coordinates: [aussen, loch] })).toBe(96);
    expect(flaecheLv95({ type: 'MultiPolygon', coordinates: [[aussen], [aussen]] })).toBe(200);
  });
});
