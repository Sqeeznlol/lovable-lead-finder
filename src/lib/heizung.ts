// Der Heizungs-Check: dieselbe Prüfung wie die Check-Seite, mit der
// Heizung vorne (Julian, 14. November: "3 ist gut" zu "Heizungs-Check als
// eigener Einstieg"). Er läuft auf jeder Marken-Domain unter /heizung;
// bei Google zählt die Fassung auf hauschecker.ch (seo-marken.ts).
//
// Nur, was das Register und der Bund wissen: Energiequelle und
// Wärmeerzeuger (GWR), Baujahr, Wärmenetze und Sonnenpotenzial (BFE).
// Keine Aussagen über Pflichten beim Ersatz -- die sind kantonal und
// gehören in die persönliche Beratung.
import type { Befund, Haus } from './check-daten';
import { aeltestes, bauzeit, heizungText } from './check-daten';
import type { Umgebung, Zeile } from './check-modell';

export { HEIZUNG_TEXT } from './heizung-text';

// Gas und Heizöl (GENH1 7520, 7530): dort lohnt die Frage nach dem Ersatz am meisten.
export const FOSSIL = new Set([7520, 7530]);

export const ABSICHT_HEIZUNG = { ersetzen: 'Heizung ersetzen', bauen: 'Umbauen oder sanieren', verkaufen: 'Verkaufen', informieren: 'Nur informieren' };

export const FOERDERUNG = [
  { text: 'Das Gebäudeprogramm von Bund und Kantonen', url: 'https://www.dasgebaeudeprogramm.ch/de/' },
  { text: 'Förderbeiträge an Ihrer Postleitzahl (Energiefranken)', url: 'https://www.energiefranken.ch/de' },
];

/** Die Zeilen des Blocks "Ihre Heizung": Register zuerst, dann Bund. */
export function heizungZeilen(b: Befund | null, u: Umgebung | null): Zeile[] {
  if (!b) return [];
  const best = b.haeuser.filter((h: Haus) => h.status === 1004 || h.status === 1003);
  const mitHeizung = best.find(h => heizungText(h)) ?? null;
  const z: Zeile[] = [];
  const text = mitHeizung ? heizungText(mitHeizung) : null;
  const fossil = !!mitHeizung && FOSSIL.has(mitHeizung.energie ?? 0);
  z.push(text
    ? { titel: 'Heizung', wert: text, zusatz: mitHeizung && FOSSIL.has(mitHeizung.energie ?? 0) ? 'fossil: Ersatz und Förderung prüfen' : undefined, quelle: 'Gebäuderegister', art: mitHeizung && FOSSIL.has(mitHeizung.energie ?? 0) ? undefined : 'ok' }
    : { titel: 'Heizung', wert: 'Im Register nicht angegeben', quelle: 'Gebäuderegister' });
  const alt = aeltestes(best);
  if (alt) z.push({ titel: 'Baujahr', wert: mitHeizung && bauzeit(mitHeizung) ? String(bauzeit(mitHeizung)) : alt, quelle: 'Gebäuderegister' });
  if (u?.waermenetz) z.push({ titel: 'Fernwärme', wert: `${u.waermenetz.name ?? 'Wärmenetz'}, rund ${Math.round(u.waermenetz.meter / 10) * 10} m entfernt`, zusatz: u.waermenetz.betreiber ? `Anschluss beim Betreiber anfragen: ${u.waermenetz.betreiber}` : undefined, quelle: 'BFE', link: u.waermenetz.web ?? undefined });
  // Das BFE führt die Standorte der Heizzentralen, nicht die Leitungen: ein Haus kann
  // Fernwärme beziehen, ohne dass eine Zentrale in 1,5 km steht (Thalwil, Seestrasse 147,
  // am 15. November gesehen). Darum kein Rat, wo das Register schon nicht-fossil zeigt.
  else if (u) z.push({ titel: 'Fernwärme', wert: 'Keine Heizzentrale im Umkreis von 1,5 km', zusatz: fossil ? 'eher Wärmepumpe oder Holz' : undefined, quelle: 'BFE' });
  if (u?.solar) z.push({ titel: 'Solardach', wert: `${u.solar.eignung} geeignet`, zusatz: `bis ${u.solar.kwh.toLocaleString('de-CH')} kWh im Jahr, passt zur Wärmepumpe`, quelle: 'BFE' });
  return z;
}
