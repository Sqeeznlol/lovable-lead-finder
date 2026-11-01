/**
 * Die Filter der Karte neben der Zone: Parzellengrösse, Potenzial und
 * Objektart -- Abschnitt 2 von Tims Anforderungen.
 *
 * Gefiltert wird im Browser über den Ausschnitt, den parzellen_karte
 * liefert (höchstens 1200 Parzellen). Eine eigene Abfrage je Filter
 * wäre bei dieser Menge Aufwand ohne Gewinn.
 */
export interface KartenFilter {
  /** Mindestfläche in m², 0 = alle. */
  flaecheAb: number;
  /** Mindestmarge in CHF; 0 = alle, 1 = nur mit Marge. */
  margeAb: number;
  /** Objektart wie in `properties.kategorie`, leer = alle. */
  art: string;
}

export const OHNE_FILTER: KartenFilter = { flaecheAb: 0, margeAb: 0, art: '' };

export const FLAECHEN: [number, string][] = [
  [0, 'Jede Grösse'], [500, 'ab 500 m²'], [1000, 'ab 1000 m²'], [2000, 'ab 2000 m²'], [5000, 'ab 5000 m²'],
];
export const MARGEN: [number, string][] = [
  [0, 'Jedes Potenzial'], [1, 'mit Marge'], [500_000, 'ab 0,5 Mio.'], [1_000_000, 'ab 1 Mio.'], [5_000_000, 'ab 5 Mio.'],
];
// Die Werte so, wie sie in `kategorie` stehen -- gezählt am 1. November
// ("Auswerten -> arten"). "1010" (5 Fälle) ist ein Code, keine Art.
export const ARTEN: [string, string][] = [
  ['', 'Jede Objektart'],
  ['Einfamilienhaus', 'Einfamilienhaus'],
  ['Mehrfamilienhaus', 'Mehrfamilienhaus'],
  ['Wohngebäude mit Nebennutzung', 'Wohnen mit Nebennutzung'],
  ['Gebäude mit teilweiser Wohnnutzung', 'Teilweise Wohnen'],
  ['Gebäude ohne Wohnnutzung', 'Ohne Wohnnutzung'],
];

export function passtFilter(
  e: { flaeche?: number | null; marge?: number | null; art?: string | null },
  f: KartenFilter,
): boolean {
  if (f.flaecheAb > 0 && !(Number(e.flaeche) >= f.flaecheAb)) return false;
  if (f.margeAb > 0 && !(Number(e.marge) >= f.margeAb)) return false;
  if (f.art && String(e.art ?? '').trim() !== f.art) return false;
  return true;
}

export function filterAktiv(f: KartenFilter): boolean {
  return f.flaecheAb > 0 || f.margeAb > 0 || f.art !== '';
}
