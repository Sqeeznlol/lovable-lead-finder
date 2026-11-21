/**
 * Google Ads je Kampagne (Julian, 21. November: «einen Tracker, der
 * permanent analysiert, jeden Tag»). Besuche und Leads zählt die Seite
 * selbst (werbung_tage, Migration 20261121150000); die Kosten kennt nur
 * Google und stehen in werbung_kosten. Was zu tun ist, folgt den Regeln des
 * Werbeplans (docs/kampagnenplan/werbeplan.py, Zweig akquise).
 */
export const KAMPAGNEN: { id: string; titel: string; domain: string }[] = [
  { id: 'zone', titel: 'Zone', domain: 'zonen-check.ch' },
  { id: 'ausnuetzung', titel: 'Ausnützung', domain: 'ausnuetzung-check.ch' },
  { id: 'erbe', titel: 'Erbe', domain: 'erbliegenschaft.ch' },
  { id: 'parzelle', titel: 'Parzelle', domain: 'parzellenchecker.ch' },
  { id: 'bauen', titel: 'Bauen', domain: 'was-kann-ich-bauen.ch' },
  { id: 'ausbau', titel: 'Ausbau', domain: 'aufstockungscheck.ch' },
  { id: 'steuer', titel: 'Steuer', domain: 'hauschecker.ch' },
];

export interface WerbungTag { tag: string; kampagne: string; besuche: number; ergebnisse: number; kontakte: number; leads: number; kosten_chf: number | null; klicks: number | null }
export interface WerbungSumme { kampagne: string; besuche: number; ergebnisse: number; kontakte: number; leads: number; kosten: number | null; klicks: number | null; jeLead: number | null; rat: string }

/**
 * Die Regeln des Werbeplans: Kosten pro Lead unter CHF 150 → Budget
 * verdoppeln, 150 bis 400 → Text oder Suchbegriffe verbessern, über 400 →
 * stoppen; 150 Klicks ohne Lead → stoppen oder Zielseite ändern. Ohne
 * Kosten zählen die Besuche als Klicks.
 */
export function rat(s: Pick<WerbungSumme, 'besuche' | 'leads' | 'kosten' | 'klicks' | 'ergebnisse'>): string {
  const klicks = s.klicks ?? s.besuche;
  if (s.besuche >= 10 && s.ergebnisse === 0) return 'Seite prüfen: Besucher, aber kein Ergebnis';
  if (!s.leads) return klicks >= 150 ? 'Stoppen oder Zielseite ändern: 150 Klicks ohne Lead' : klicks ? 'Weiter beobachten' : 'Noch keine Klicks';
  if (s.kosten == null) return 'Kosten eintragen, dann zählt der Preis je Lead';
  const je = s.kosten / s.leads;
  return je < 150 ? 'Budget verdoppeln' : je <= 400 ? 'Text oder Suchbegriffe verbessern' : 'Stoppen';
}

/** Die Tage zu einer Zeile je Kampagne, in der Reihenfolge des Werbeplans. */
export function zusammen(tage: WerbungTag[]): WerbungSumme[] {
  return KAMPAGNEN.map(k => {
    const t = tage.filter(x => x.kampagne === k.id);
    const summe = (f: (x: WerbungTag) => number) => t.reduce((a, x) => a + f(x), 0);
    const mitKosten = t.filter(x => x.kosten_chf != null);
    const kosten = mitKosten.length ? mitKosten.reduce((a, x) => a + Number(x.kosten_chf), 0) : null;
    const mitKlicks = t.filter(x => x.klicks != null);
    const s = {
      kampagne: k.id, besuche: summe(x => Number(x.besuche)), ergebnisse: summe(x => Number(x.ergebnisse)), kontakte: summe(x => Number(x.kontakte)),
      leads: summe(x => Number(x.leads)), kosten, klicks: mitKlicks.length ? mitKlicks.reduce((a, x) => a + Number(x.klicks), 0) : null,
    };
    return { ...s, jeLead: kosten != null && s.leads ? kosten / s.leads : null, rat: rat(s) };
  });
}
