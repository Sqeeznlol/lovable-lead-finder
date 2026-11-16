/**
 * Verkaufspreise je m² Wohnfläche, die Julian aus dem Markt kennt -- dort,
 * wo kein Amt sie je m² veröffentlicht (der Kanton Zürich nennt nur den
 * Preis je Wohnung). Jede Zeile mit Datum; gerechnet wird mit der Mitte
 * der Spanne, und die Seite nennt die Spanne.
 *
 * Schlüssel ist die BFS-Nummer der Gemeinde.
 */
export const ERLOES_ANGABEN: Record<string, { von: number; bis: number; gemeinde: string; am: string }> = {
  // «Kilchberg ist zwischen 20 und 30k/m² Verkaufspreis» (16. November).
  135: { von: 20000, bis: 30000, gemeinde: 'Kilchberg', am: '16. November 2026' },
};
