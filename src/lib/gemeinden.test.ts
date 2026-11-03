import { describe, expect, it } from 'vitest';
import { gemeindeKanon, gemeindenEinmal } from './gemeinden';

// Fälle aus der Messung vom 3. November (Ablauf Tempo).
describe('gemeindenEinmal', () => {
  it('führt "X ZH" und "X (ZH)" zusammen', () => {
    expect(gemeindenEinmal(['Küsnacht (ZH)', 'Küsnacht ZH', 'Kloten'])).toEqual(['Kloten', 'Küsnacht (ZH)']);
  });
  it('"X ZH" ohne "(ZH)" wird zu "X"', () => {
    expect(gemeindenEinmal(['Pfäffikon', 'Pfäffikon ZH'])).toEqual(['Pfäffikon']);
  });
  it('lässt gleichnamige Gemeinden zweier Kantone getrennt', () => {
    expect(gemeindenEinmal(['Rickenbach (ZH)', 'Rickenbach (TG)', 'Rickenbach ZH'])).toEqual(['Rickenbach (TG)', 'Rickenbach (ZH)']);
  });
  it('nennt einen doppelten Namen (Aadorf in TG und ZH) einmal', () => {
    expect(gemeindenEinmal(['Aadorf', 'Aadorf'])).toEqual(['Aadorf']);
  });
  it('rührt Namen ohne Zusatz nicht an', () => {
    expect(gemeindeKanon('Zürich', new Set(['Zürich']))).toBe('Zürich');
  });
});
