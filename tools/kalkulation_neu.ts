/**
 * Rechnet alle Entwürfe von CALC YOU LATER mit der heutigen Rechnung neu
 * (Julian, 20. November, nach Tims Flächenwert: «berechne neu»). Ein Entwurf
 * speichert sein Ergebnis beim Speichern; ändert sich die Rechnung, steht
 * in der Liste die alte Empfehlung, bis jemand ihn öffnet und speichert.
 *
 * Liest die Zeilen als JSON (id, egrid, adresse, eingaben, empfehlung_chf),
 * holt die Gebäude frisch aus dem Register (seit dem 20. November mit
 * Kategorie: Häuser mit Gewerbe) und schreibt je Zeile eingaben, ergebnis
 * und empfehlung_chf als JSON. Was der Mensch eingetragen hat (Annahmen,
 * Mieten, Nachbarn), bleibt, wie es war.
 *
 *   npx vite-node tools/kalkulation_neu.ts -- ein.json aus.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { bewerten, type CalcEingabe } from '@/lib/calc';
import { gebaeudeFrisch } from '@/lib/calc-daten';

interface Zeile { id: string; egrid: string | null; adresse: string; empfehlung_chf: number | null; eingaben: { eingabe: CalcEingabe } & Record<string, unknown> }

const [ein, aus] = process.argv.slice(2).filter(a => a !== '--');
const zeilen: Zeile[] = JSON.parse(readFileSync(ein, 'utf8'));
const neu: { id: string; eingaben: unknown; ergebnis: unknown; empfehlung_chf: number | null }[] = [];
const fr = (n: number | null) => (n == null ? '–' : `CHF ${Math.round(n).toLocaleString('de-CH')}`);

for (const z of zeilen) {
  const e = z.eingaben?.eingabe;
  if (!e?.grundlage || !e.annahmen) { console.log(`${z.adresse}: ohne Eingabe, bleibt`); continue; }
  let gebaeude = e.grundlage.gebaeude ?? [];
  if (z.egrid) {
    try {
      const frisch = await gebaeudeFrisch(z.egrid);
      if (frisch.length) gebaeude = frisch;
    } catch { console.log(`${z.adresse}: Register antwortet nicht, rechnet mit den gespeicherten Gebäuden`); }
  }
  const eingabe: CalcEingabe = { ...e, grundlage: { ...e.grundlage, gebaeude } };
  const b = bewerten(eingabe);
  neu.push({ id: z.id, eingaben: { ...z.eingaben, eingabe }, ergebnis: b, empfehlung_chf: b.empfehlung });
  console.log(`${z.adresse}: ${fr(z.empfehlung_chf)} -> ${fr(b.empfehlung)} (massgebend ${b.massgebend ?? '–'}${b.bestand ? `, Bestand ${b.bestand.wertArt === 'flaeche' ? 'nach Fläche' : 'nach Miete'}` : ''})`);
}
writeFileSync(aus, JSON.stringify(neu));
