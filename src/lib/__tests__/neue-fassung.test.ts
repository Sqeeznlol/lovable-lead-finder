import { describe, expect, it, vi } from 'vitest';
import { istFehlendeFassung, neuLadenEinmal } from '../neue-fassung';

describe('Neue Fassung', () => {
  it('erkennt die Meldungen der Browser für fehlende Programmteile', () => {
    // Safari (iPhone, wörtlich aus Julians Bildschirm), Chrome, Firefox
    expect(istFehlendeFassung("'text/html' is not a valid JavaScript MIME type for module script 'https://www.wohntraums.life/assets/Zentrale-CehB4OEJ.js'.")).toBe(true);
    expect(istFehlendeFassung('Failed to fetch dynamically imported module: https://x/assets/Karte-1.js')).toBe(true);
    expect(istFehlendeFassung('error loading dynamically imported module')).toBe(true);
    expect(istFehlendeFassung('Importing a module script failed.')).toBe(true);
    expect(istFehlendeFassung("Cannot read properties of undefined (reading 'map')")).toBe(false);
  });
  it('lädt höchstens einmal je Minute neu', () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { reload }, writable: true });
    sessionStorage.clear();
    expect(neuLadenEinmal(1_000_000)).toBe(true);
    expect(neuLadenEinmal(1_030_000)).toBe(false);
    expect(neuLadenEinmal(1_070_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
