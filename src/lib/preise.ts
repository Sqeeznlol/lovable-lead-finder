/**
 * Was Wohnungen und Bauland in der Gemeinde kosten, aus amtlicher
 * Statistik (public/preise.json, geschrieben von tools/preise.py). Je
 * Gemeinde veröffentlichen das nur Zürich (Einfamilienhaus,
 * Eigentumswohnung, Wohnbauland) und Baselland (Wohnbauland).
 *
 * Für die Machbarkeitsstudie ist das der Massstab: was nach der
 * Rechnung für das Land bleibt, steht neben dem, was in der Gemeinde
 * für Land wirklich bezahlt wurde.
 */
export interface Wert { m: number; q25?: number | null; q75?: number | null; n?: number | null; z: string; art?: 'bezahlt' | 'modell' | 'durchschnitt' }
export interface GemeindePreise { k: string; name: string; efh?: Wert; stwe?: Wert; land?: Wert }
interface Preise { quellen: Record<string, string>; gemeinden: Record<string, GemeindePreise> }

let geladen: Promise<Preise | null> | null = null;
const laden = () => (geladen ??= fetch('/preise.json').then(r => (r.ok ? r.json() : null)).catch(() => null));

/** Die Preise der Gemeinde mit dieser BFS-Nummer; null, wo keine amtlichen vorliegen. */
export async function gemeindePreise(bfs: string | number | null | undefined): Promise<GemeindePreise | null> {
  if (bfs == null || bfs === '') return null;
  const p = await laden();
  return p?.gemeinden[String(Number(bfs))] ?? null;
}

const de = (n: number) => Math.round(n).toLocaleString('de-CH');
const zeitraum = (w: Wert) => (w.z.includes('-') ? w.z.split('-').map(Number).sort().join(' bis ') : w.z);

/** "Median CHF 2'810/m², mittlere Hälfte 2'356 bis 3'000, 5 Verkäufe 2023 bis 2025". */
export function landText(w: Wert): string {
  const art = w.art === 'durchschnitt' ? 'Durchschnitt' : w.art === 'modell' ? 'Modellwert des Statistischen Amts' : 'Median';
  return [`${art} CHF ${de(w.m)}/m²`, w.q25 && w.q75 ? `mittlere Hälfte ${de(w.q25)} bis ${de(w.q75)}` : null,
    w.n ? `${w.n} ${w.n === 1 ? 'Verkauf' : 'Verkäufe'} ${zeitraum(w)}` : zeitraum(w)].filter(Boolean).join(', ');
}

/** "Median CHF 1.13 Mio., 82 Verkäufe 2025". */
export function wohnungText(w: Wert): string {
  const chf = w.m >= 1e6 ? `${(w.m / 1e6).toLocaleString('de-CH', { maximumFractionDigits: 2 })} Mio.` : de(Math.round(w.m / 1000) * 1000);
  return [`Median CHF ${chf}`, w.n ? `${w.n} ${w.n === 1 ? 'Verkauf' : 'Verkäufe'} ${zeitraum(w)}` : zeitraum(w)].filter(Boolean).join(', ');
}
