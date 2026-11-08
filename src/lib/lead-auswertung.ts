/**
 * Auswertung der Check-Seiten: aus den Zeilen von check_trichter() je
 * Marke, wie viele Besucher jeden Schritt erreicht haben, und wo sie
 * aussteigen. Rein und ohne Datenbank, damit es ein Test prüfen kann.
 */
export const SCHRITTE = ['aufruf', 'suche', 'ergebnis', 'rechner', 'kontakt', 'lead'] as const;
export type Schritt = typeof SCHRITTE[number];
export const SCHRITT_TEXT: Record<Schritt, string> = {
  aufruf: 'Besucher', suche: 'Adresse gesucht', ergebnis: 'Ergebnis gesehen',
  rechner: 'Rechner geöffnet', kontakt: 'Fragen beantwortet', lead: 'Leads',
};

export interface TrichterZeile { marke: string; domain: string; ereignis: string; sitzungen: number; quelle: string }
export interface MarkenTrichter { marke: string; werte: Record<Schritt, number>; quote: number | null }

export function trichterJeMarke(zeilen: TrichterZeile[]): MarkenTrichter[] {
  const je = new Map<string, Record<Schritt, number>>();
  for (const z of zeilen) {
    if (!(SCHRITTE as readonly string[]).includes(z.ereignis)) continue;
    const w = je.get(z.marke) ?? Object.fromEntries(SCHRITTE.map(s => [s, 0])) as Record<Schritt, number>;
    w[z.ereignis as Schritt] += Number(z.sitzungen) || 0;
    je.set(z.marke, w);
  }
  return [...je.entries()]
    .map(([marke, werte]) => ({ marke, werte, quote: werte.aufruf ? werte.lead / werte.aufruf : null }))
    .sort((a, b) => b.werte.lead - a.werte.lead || b.werte.aufruf - a.werte.aufruf);
}

/** Summe über alle Marken, für die Kennzahlenleiste. */
export function gesamt(t: MarkenTrichter[]): Record<Schritt, number> {
  const s = Object.fromEntries(SCHRITTE.map(x => [x, 0])) as Record<Schritt, number>;
  for (const m of t) for (const x of SCHRITTE) s[x] += m.werte[x];
  return s;
}

/** Besucher je Quelle (facebook, google, direkt ...), meiste zuerst. */
export function quellen(zeilen: TrichterZeile[]): { quelle: string; besucher: number; leads: number }[] {
  const je = new Map<string, { besucher: number; leads: number }>();
  for (const z of zeilen) {
    const q = je.get(z.quelle) ?? { besucher: 0, leads: 0 };
    if (z.ereignis === 'aufruf') q.besucher += Number(z.sitzungen) || 0;
    if (z.ereignis === 'lead') q.leads += Number(z.sitzungen) || 0;
    je.set(z.quelle, q);
  }
  return [...je.entries()].map(([quelle, v]) => ({ quelle, ...v })).sort((a, b) => b.besucher - a.besucher);
}

export const prozent = (x: number | null) => (x == null ? '–' : `${(x * 100).toFixed(x < 0.1 ? 1 : 0)} %`);
