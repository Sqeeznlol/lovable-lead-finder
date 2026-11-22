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

export interface WerbungTag { tag: string; kampagne: string; besuche: number; ergebnisse: number; kontakte: number; leads: number; schlechte?: number; kosten_chf: number | null; klicks: number | null }
export interface WerbungSumme { kampagne: string; besuche: number; ergebnisse: number; kontakte: number; leads: number; gute: number; kosten: number | null; klicks: number | null; jeLead: number | null; rat: string }

/**
 * Die Regeln des Werbeplans: Kosten pro Lead unter CHF 150 → Budget
 * verdoppeln, 150 bis 400 → Text oder Suchbegriffe verbessern, über 400 →
 * stoppen; 150 Klicks ohne Lead → stoppen oder Zielseite ändern. Ohne
 * Kosten zählen die Besuche als Klicks. Der Plan rechnet mit guten Leads:
 * wer als «kein guter Lead» markiert ist, zählt nicht (ohne Angabe zählt
 * jeder Lead, bis jemand urteilt).
 */
export function rat(s: Pick<WerbungSumme, 'besuche' | 'leads' | 'kosten' | 'klicks' | 'ergebnisse'> & { gute?: number }): string {
  const klicks = s.klicks ?? s.besuche;
  const gute = s.gute ?? s.leads;
  if (s.besuche >= 10 && s.ergebnisse === 0) return 'Seite prüfen: Besucher, aber kein Ergebnis';
  if (!gute) return s.leads ? (klicks >= 150 ? 'Stoppen oder Zielseite ändern: kein guter Lead' : 'Weiter beobachten: noch kein guter Lead') : klicks >= 150 ? 'Stoppen oder Zielseite ändern: 150 Klicks ohne Lead' : klicks ? 'Weiter beobachten' : 'Noch keine Klicks';
  if (s.kosten == null) return 'Kosten eintragen, dann zählt der Preis je Lead';
  const je = s.kosten / gute;
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
      leads: summe(x => Number(x.leads)), gute: summe(x => Number(x.leads) - Number(x.schlechte ?? 0)), kosten, klicks: mitKlicks.length ? mitKlicks.reduce((a, x) => a + Number(x.klicks), 0) : null,
    };
    return { ...s, jeLead: kosten != null && s.gute ? kosten / s.gute : null, rat: rat(s) };
  });
}

/** Die Grenze des Werbeplans: höchstens CHF 600 im Monat (google_ads.py, MONATSBUDGET). */
export const MONATSGRENZE = 600;

/**
 * Kosten im laufenden Monat und wohin sie bis Monatsende führen. Google darf
 * an einem Tag bis doppelt so viel ausgeben; darum zählt der Schnitt der
 * eingetragenen Tage, nicht der letzte Tag. Ohne Kosten keine Hochrechnung.
 */
export function monat(tage: WerbungTag[], heute: string): { bisher: number; tage: number; hochgerechnet: number; ueber: boolean } | null {
  const m = heute.slice(0, 7);
  const mit = tage.filter(t => t.tag.slice(0, 7) === m && t.kosten_chf != null);
  if (!mit.length) return null;
  const bisher = mit.reduce((a, t) => a + Number(t.kosten_chf), 0);
  const eingetragen = new Set(mit.map(t => t.tag)).size;
  const [j, mo] = m.split('-').map(Number);
  const imMonat = new Date(Date.UTC(j, mo, 0)).getUTCDate();
  const hochgerechnet = bisher / eingetragen * imMonat;
  return { bisher, tage: eingetragen, hochgerechnet, ueber: hochgerechnet > MONATSGRENZE };
}
