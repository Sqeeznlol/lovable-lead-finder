// Was Häuser, Wohnungen und Bauland in der Gemeinde kosten, aus amtlicher
// Statistik (tools/preise.py im Repository der Webseite schreibt
// public/preise.json). Nur ZH und BL veröffentlichen das je Gemeinde
// (Recherche 15. November 2026); anderswo zeigt der Check nichts.
//
// Ein Richtwert für die Gemeinde, keine Schätzung der Liegenschaft: das
// bleibt das Angebot im Formular.
import type { Zeile } from './check-modell';

export interface Wert { m: number; q25?: number | null; q75?: number | null; n?: number | null; z: string; art?: 'bezahlt' | 'modell' | 'durchschnitt' }
export interface GemeindePreise { k: string; name: string; efh?: Wert; stwe?: Wert; land?: Wert }
export interface Preise { quellen: Record<string, string>; gemeinden: Record<string, GemeindePreise> }

const tausender = (x: number) => Math.round(x).toLocaleString('de-CH');
/** 1630000 -> "1.63 Mio." (de-CH); unter einer Million in Tausendern. */
export function chf(x: number): string {
  return x >= 1e6 ? `${(x / 1e6).toLocaleString('de-CH', { maximumFractionDigits: 2 })} Mio.` : tausender(Math.round(x / 1000) * 1000);
}
const zeitraum = (w: Wert) => (w.z.includes('-') ? w.z.split('-').map(Number).sort().join(' bis ') : w.z);
const verkaeufe = (w: Wert) => (w.n ? `${w.n} ${w.n === 1 ? 'Verkauf' : 'Verkäufe'} ${zeitraum(w)}` : zeitraum(w));
const spanne = (w: Wert, f: (x: number) => string) => (w.q25 && w.q75 ? `mittlere Hälfte ${f(w.q25)} bis ${f(w.q75)} · ` : '');

export function preisZeilen(p: GemeindePreise | null | undefined, flaeche: number | null): Zeile[] {
  if (!p) return [];
  const quelle = `Statistik ${p.k}`;
  const z: Zeile[] = [];
  if (p.efh) z.push({ titel: 'Einfamilienhaus', wert: `CHF ${chf(p.efh.m)}`, zusatz: `Median, ${spanne(p.efh, chf)}${verkaeufe(p.efh)}`, quelle });
  if (p.stwe) z.push({ titel: 'Eigentums­wohnung', wert: `CHF ${chf(p.stwe.m)}`, zusatz: `Median, ${spanne(p.stwe, chf)}${verkaeufe(p.stwe)}`, quelle });
  if (p.land) {
    const art = p.land.art === 'durchschnitt' ? 'Durchschnitt' : p.land.art === 'modell' ? 'Modellwert des Statistischen Amts' : 'Median';
    z.push({ titel: 'Bauland', wert: `CHF ${tausender(p.land.m)} pro m²`, zusatz: `${art}, ${spanne(p.land, tausender)}${verkaeufe(p.land)}`, quelle });
    if (flaeche && flaeche > 0) {
      const boden = p.land.m * flaeche;
      z.push({ titel: 'Ihr Boden', wert: `rund CHF ${chf(Math.round(boden / 1e4) * 1e4)}`,
        zusatz: `${tausender(flaeche)} m² zum Baulandpreis der Gemeinde. Ein Richtwert, keine Schätzung Ihrer Liegenschaft.`, quelle });
    }
  }
  return z;
}
