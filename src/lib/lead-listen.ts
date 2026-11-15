/**
 * Lead-Listen aus dem Gebäuderegister (Tabelle lead_gebaeude, Ablauf
 * "Lead-Listen"): bestehende Wohngebäude mit Öl- oder Gasheizung, bis 1980
 * gebaut. Rein und ohne Datenbank, damit ein Test Filter und CSV prüft.
 */
export interface LeadGebaeude {
  egid: number; egrid: string | null; kanton: string; bfs: number; gemeinde: string; strasse: string | null;
  plz: number | null; ort: string | null; baujahr: number | null; periode: number | null; wohnungen: number | null;
  klasse: number | null; heizung: number | null; e: number | null; n: number | null;
}
export interface Filter { kanton: string; bfs: string; heizung: '' | '7530' | '7520'; bisJahr: number; minWhg: number }

export const HEIZUNG_TEXT: Record<number, string> = { 7530: 'Heizöl', 7520: 'Gas' };
export const KLASSE_TEXT: Record<number, string> = { 1110: 'Einfamilienhaus', 1121: 'Zweifamilienhaus', 1122: 'Mehrfamilienhaus', 1130: 'Wohnheim' };
const PERIODE_ENDE: Record<number, number> = { 8011: 1918, 8012: 1945, 8013: 1960, 8014: 1970, 8015: 1980 };
const PERIODE_TEXT: Record<number, string> = { 8011: 'vor 1919', 8012: '1919–1945', 8013: '1946–1960', 8014: '1961–1970', 8015: '1971–1980' };

export const bauzeit = (g: Pick<LeadGebaeude, 'baujahr' | 'periode'>) => (g.baujahr ? String(g.baujahr) : g.periode ? PERIODE_TEXT[g.periode] ?? '–' : '–');

/** Die Perioden, die ganz vor dem gewählten Jahr enden (für Gebäude ohne genaues Baujahr). */
export const periodenBis = (jahr: number) => Object.entries(PERIODE_ENDE).filter(([, ende]) => ende <= jahr).map(([p]) => Number(p));

/** Ein PostgREST-Filter "or" für das Baujahr: genaues Jahr bis X, sonst Periode bis X. */
export const baujahrOder = (jahr: number) => `baujahr.lte.${jahr},and(baujahr.is.null,periode.in.(${periodenBis(jahr).join(',')}))`;

const feld = (v: unknown) => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** CSV mit Semikolon für Excel in der Schweiz. */
export function csv(zeilen: LeadGebaeude[]): string {
  const kopf = ['Strasse', 'PLZ', 'Ort', 'Gemeinde', 'Kanton', 'Baujahr', 'Gebäudeart', 'Wohnungen', 'Heizung', 'EGID', 'EGRID', 'Ost', 'Nord'];
  return [kopf.join(';'), ...zeilen.map(g => [g.strasse, g.plz, g.ort, g.gemeinde, g.kanton, bauzeit(g), g.klasse ? KLASSE_TEXT[g.klasse] ?? g.klasse : '',
    g.wohnungen, g.heizung ? HEIZUNG_TEXT[g.heizung] ?? g.heizung : '', g.egid, g.egrid, g.e, g.n].map(feld).join(';'))].join('\r\n');
}
