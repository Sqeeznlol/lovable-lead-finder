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
import { bewerten, CALC_ANNAHMEN, type CalcEingabe } from '@/lib/calc';
import { gebaeudeFrisch } from '@/lib/calc-daten';
import { erloesHerleiten, quartierLaden, type PreisReihen } from '@/lib/preis-herleitung';

// Der Verkaufspreis je m² wird mit hergeleitet, in der Stadt Zürich je Quartier
// (Julian, 21. November: «Quartierpreise in Zürich nehmen»). Wer ihn selbst
// gesetzt hat (von Hand, aus Inseraten, aus dem Landpreis), behält ihn.
const reihen: PreisReihen = JSON.parse(readFileSync('public/preise-reihen.json', 'utf8'));
const bfsNach = new Map(Object.entries(reihen.gemeinden).map(([bfs, g]) => [g.name, bfs]));

interface Zeile { id: string; egrid: string | null; adresse: string; gemeinde: string | null; empfehlung_chf: number | null; eingaben: { eingabe: CalcEingabe; adresse?: { e?: number; n?: number } } & Record<string, unknown> }

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
  let { annahmen, erloesQuelle } = e;
  // Gespeichert ist der Anteil, der beim Speichern galt. Stand dort eine frühere Vorgabe, gilt die heutige;
  // was jemand von Hand eingetragen hat, bleibt.
  const FRUEHER = [0.578];
  if (annahmen.bestandAnteil != null && FRUEHER.includes(annahmen.bestandAnteil)) annahmen = { ...annahmen, bestandAnteil: CALC_ANNAHMEN.bestandAnteil };
  const ort = e.umfeld?.gemeinde ?? z.gemeinde ?? '';
  const bfs = e.kanton === 'ZH' && ort === 'Zürich' ? '261' : bfsNach.get(ort) ?? null;
  if (!['hand', 'inserate', 'land'].includes(erloesQuelle?.art ?? 'annahme') && bfs) {
    const p = z.eingaben.adresse;
    const quartier = bfs === '261' && p?.e && p?.n ? await quartierLaden(p.e, p.n) : null;
    const h = erloesHerleiten(reihen, bfs, quartier);
    if (h) {
      annahmen = { ...annahmen, erloes: h.m2 };
      erloesQuelle = { art: h.art, text: h.kurz, begruendung: h.saetze, verlauf: h.verlauf, spanne: h.spanne, spalten: h.spalten };
    }
  }
  const eingabe: CalcEingabe = { ...e, annahmen, erloesQuelle, grundlage: { ...e.grundlage, gebaeude } };
  const b = bewerten(eingabe);
  neu.push({ id: z.id, eingaben: { ...z.eingaben, eingabe }, ergebnis: b, empfehlung_chf: b.empfehlung });
  console.log(`${z.adresse}: ${fr(z.empfehlung_chf)} -> ${fr(b.empfehlung)} (Erlös ${fr(e.annahmen.erloes)} -> ${fr(annahmen.erloes)}, ${erloesQuelle?.text ?? 'Annahme'}; massgebend ${b.massgebend ?? '–'}${b.bestand ? `, Bestand ${b.bestand.wertArt === 'flaeche' ? 'nach Fläche' : 'nach Miete'}` : ''})`);
}
writeFileSync(aus, JSON.stringify(neu));
