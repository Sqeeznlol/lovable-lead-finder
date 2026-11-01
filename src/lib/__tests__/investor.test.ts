import { describe, expect, it } from 'vitest';
import { lagenNorm, typenZuKategorien } from '../investor';

describe('Investor-Abgleich', () => {
  it('übersetzt Begriffe aus dem Gespräch in die Objektarten des Bestands', () => {
    expect(typenZuKategorien(['MFH', 'Einfamilienhaus', 'Bauland'])).toEqual(['Mehrfamilienhaus', 'Einfamilienhaus']);
    expect(typenZuKategorien(['Büro', 'Wohn- und Geschäftshaus'])).toEqual(['Gebäude ohne Wohnnutzung', 'Gebäude mit teilweiser Wohnnutzung']);
    expect(typenZuKategorien(null)).toEqual([]);
  });
  it('schreibt Lagen wie im Bestand und ohne Doppel', () => {
    expect(lagenNorm([' zürich', 'Zürich', 'kloten', ''])).toEqual(['Zürich', 'Kloten']);
  });
});
