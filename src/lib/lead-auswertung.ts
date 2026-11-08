/**
 * Auswertung der Check-Seiten: aus den Zeilen von check_trichter() je
 * Webseite (Domain), wie viele Besucher jeden Schritt erreicht haben, und
 * wo sie aussteigen. Je Webseite, nicht je Marke (Julian, 8. November):
 * eine Marke kann mehrere Domains haben, und die Werbung läuft je Domain. Rein und ohne Datenbank, damit es ein Test prüfen kann.
 */
export const SCHRITTE = ['aufruf', 'suche', 'ergebnis', 'rechner', 'kontakt', 'lead'] as const;
export type Schritt = typeof SCHRITTE[number];
export const SCHRITT_TEXT: Record<Schritt, string> = {
  aufruf: 'Besucher', suche: 'Adresse gesucht', ergebnis: 'Ergebnis gesehen',
  rechner: 'Rechner geöffnet', kontakt: 'Fragen beantwortet', lead: 'Leads',
};

export interface TrichterZeile { marke: string; domain: string; ereignis: string; sitzungen: number; quelle: string }
export interface SeitenTrichter { domain: string; marke: string; werte: Record<Schritt, number>; quote: number | null }

export function trichterJeSeite(zeilen: TrichterZeile[]): SeitenTrichter[] {
  const je = new Map<string, { marke: string; werte: Record<Schritt, number> }>();
  for (const z of zeilen) {
    if (!(SCHRITTE as readonly string[]).includes(z.ereignis)) continue;
    const domain = z.domain.replace(/^www\./, '');
    const e = je.get(domain) ?? { marke: z.marke, werte: Object.fromEntries(SCHRITTE.map(s => [s, 0])) as Record<Schritt, number> };
    e.werte[z.ereignis as Schritt] += Number(z.sitzungen) || 0;
    je.set(domain, e);
  }
  return [...je.entries()]
    .map(([domain, { marke, werte }]) => ({ domain, marke, werte, quote: werte.aufruf ? werte.lead / werte.aufruf : null }))
    .sort((a, b) => b.werte.lead - a.werte.lead || b.werte.aufruf - a.werte.aufruf);
}

/** Summe über alle Webseiten, für die Kennzahlenleiste. */
export function gesamt(t: SeitenTrichter[]): Record<Schritt, number> {
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

/** Die Antworten aus dem Fragebogen der Check-Seiten, wie sie im Lead stehen. */
export const ANTWORT_TEXT: Record<'eigentuemer' | 'absicht' | 'zeitraum', Record<string, string>> = {
  eigentuemer: { allein: 'Ja, allein', gemeinsam: 'Ja, gemeinsam mit anderen', erbengemeinschaft: 'Ja, als Erbengemeinschaft',
    vertretung: 'Nein, ich vertrete den Eigentümer', nein: 'Nein' },
  absicht: { verkaufen: 'Verkaufen', bauen: 'Bauen, aus- oder umbauen', wert: 'Den Wert kennen', informieren: 'Nur informieren' },
  zeitraum: { 12: 'In den nächsten 12 Monaten', 36: 'In 1 bis 3 Jahren', offen: 'Noch offen' },
};

/** Testdaten der Testphase: markiert im Lead oder mit Quelle "test". */
export const istTest = (l: { angaben?: Record<string, unknown> | null }) => !!l.angaben?.test || l.angaben?.utm_source === 'test';
