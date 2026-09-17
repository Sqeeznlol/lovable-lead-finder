import type { Abfragbar } from '@/lib/naechste';

/**
 * Die Reihe, die das Lesezeichen am Stück abarbeitet.
 *
 * Das Portal gibt zwanzig Auskuenfte am Tag frei. Bisher hiess das
 * zwanzigmal klicken, warten, wieder klicken. Statt dessen holt sich
 * das Lesezeichen die ganze Reihe auf einmal und geht sie durch.
 *
 * Die Reihenfolge ist dieselbe wie bei einer einzelnen Abfrage: das
 * groesste ungenutzte Potenzial zuerst. Wer zwanzig Auskuenfte hat,
 * soll sie nicht an das erstbeste Grundstueck haengen.
 */
export interface Reihenglied {
  id: string;
  egrid: string;
  address: string | null;
  parzelle: string | null;
  marge: number | null;
}

export function naechsteReihe(objekte: Abfragbar[], anzahl: number): Reihenglied[] {
  if (anzahl <= 0) return [];
  const offen = objekte.filter(o =>
    o.egrid && !String(o.eigentuemer ?? '').trim());

  // Ohne EGRID findet das Portal nichts, und zweimal dieselbe Parzelle
  // verbraucht zwei Auskuenfte fuer eine Antwort.
  const gesehen = new Set<string>();
  const einmalig = offen.filter(o => {
    const e = String(o.egrid);
    if (gesehen.has(e)) return false;
    gesehen.add(e);
    return true;
  });

  return einmalig
    .sort((a, b) => (b.marge ?? 0) - (a.marge ?? 0))
    .slice(0, anzahl)
    .map(o => ({
      id: o.id,
      egrid: String(o.egrid),
      address: o.address ?? null,
      parzelle: o.parzelle ?? null,
      marge: o.marge ?? null,
    }));
}
