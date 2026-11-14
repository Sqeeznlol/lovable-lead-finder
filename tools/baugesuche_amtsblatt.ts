// Lädt die Baugesuche der Kantone ausser Zürich aus dem Amtsblattportal
// und ergänzt beim Bund Punkt, EGRID und Nachbarn. Ausgabe: CSV für \copy
// in die Staging-Tabelle des Ablaufs "Baugesuche", Spalten wie beim
// Zürcher Lader und dazu kanton, e, n.
//
// Unterrubriken gezählt am 14. November 2026 (30 Tage, rund 1900 Gesuche).
// Nicht dabei: Zürich (kommt vollständiger vom Statistischen Amt), der
// Aargau (seine Nutzungsbedingungen verbieten das automatisierte Einlesen),
// St. Gallen und Luzern (erst schriftlich anfragen).
//
// Aufruf: npx tsx tools/baugesuche_amtsblatt.ts <tage> <ausgabe.csv>
// Keine Personendaten: von der Bauherrschaft nur die Rechtsform.
import { writeFileSync } from 'node:fs';
import { parallel } from '../src/lib/parallel';
import { gesuchAus, suchtexte, type Gesuch } from '../src/lib/amtsblatt';
import { egridAmPunkt, nachbarn, ortZurAdresse } from './baugesuche_laden';

export const RUBRIKEN = ['BP-BE10', 'AM-DA50', 'BP-BS10', 'BP-BS20', 'BP-BL05', 'BP-ZG10', 'BP-AR10', 'BP-TI10',
  'BA-SZ05', 'BA-SO05', 'BA-SH05', 'BA-NW05', 'BA-OW05', 'BA-VS05'];
// Die Mitteilungen AM-DA50 führen auch Zürcher Gesuche (zwei in drei Tagen, 14. November 2026).
const AUSGESCHLOSSEN = new Set(['ZH', 'AG', 'SG', 'LU']);
const PORTAL = 'https://amtsblattportal.ch/api/v1/publications';
const KENNUNG = { 'User-Agent': 'Mozilla/5.0 (bauraum-lead-finder; Baugesuche)' };
const csvFeld = (v: string | number | null | undefined) => (v == null || v === '' ? '' : `"${String(v).replace(/"/g, '""')}"`);

async function holen(url: string, art: 'json' | 'text') {
  for (let versuch = 0; versuch < 3; versuch++) {
    const r = await fetch(url, { headers: { ...KENNUNG, Accept: art === 'json' ? 'application/json' : 'application/xml' } }).catch(() => null);
    if (r?.ok) return art === 'json' ? r.json() : r.text();
    await new Promise(z => setTimeout(z, 1500 * (versuch + 1)));
  }
  return null;
}

async function ids(rubrik: string, ab: string, bis: string): Promise<string[]> {
  const aus: string[] = [];
  for (let seite = 0; seite < 50; seite++) {
    const q = new URLSearchParams({ publicationStates: 'PUBLISHED', subRubrics: rubrik, 'publicationDate.start': ab,
      'publicationDate.end': bis, 'pageRequest.size': '100', 'pageRequest.page': String(seite) });
    const j = await holen(`${PORTAL}?${q}`, 'json');
    const c: { meta: { id: string } }[] = j?.content ?? [];
    aus.push(...c.map(x => x.meta.id));
    if (c.length < 100) break;
  }
  return aus;
}

if (process.argv[1]?.endsWith('baugesuche_amtsblatt.ts')) {
  const tage = Number(process.argv[2] ?? 3), aus = process.argv[3] ?? '/tmp/baugesuche_amtsblatt.csv';
  const bis = new Date().toISOString().slice(0, 10), ab = new Date(Date.now() - tage * 864e5).toISOString().slice(0, 10);
  const liste: { rubrik: string; id: string }[] = [];
  for (const r of RUBRIKEN) {
    const i = await ids(r, ab, bis);
    console.log(`${r.padEnd(8)} ${i.length}`);
    liste.push(...i.map(id => ({ rubrik: r, id })));
  }
  const zeilen: string[] = [], zaehler: Record<string, { n: number; egrid: number; punkt: number }> = {};
  let fehlt = 0, ausgeschlossen = 0;
  await parallel(liste, 6, async ({ id }) => {
    const xml = await holen(`${PORTAL}/${id}/xml`, 'text');
    const g: Gesuch | null = xml ? gesuchAus(xml) : null;
    if (!g) { fehlt++; return; }
    if (g.kanton && AUSGESCHLOSSEN.has(g.kanton)) { ausgeschlossen++; return; }
    // Zuerst die Adresse, denn die Punkte der Kantone liegen teils auf der
    // Kartenmitte (Basel-Landschaft: Geoview-Link); der Punkt nur als Rückfall.
    let p: { e: number; n: number } | null = null;
    for (const s of suchtexte(g)) {
      p = await ortZurAdresse(s.text).catch(() => null);
      // Aus dem Titel nur, was der Bund als genau eine Adresse erkennt -- ein Name tut das nicht.
      if (p) { if (s.ausTitel) g.strasse = s.text.split(',')[0]; break; }
    }
    p ??= g.punkt;
    const egrid = p ? await egridAmPunkt(p.e, p.n).catch(() => null) : null;
    const nb = egrid ? await nachbarn(egrid).catch(() => [] as string[]) : [];
    const k = (zaehler[g.kanton ?? '?'] ??= { n: 0, egrid: 0, punkt: 0 });
    k.n++; if (p) k.punkt++; if (egrid) k.egrid++;
    zeilen.push([
      g.id, g.nummer, g.datum, g.bfs, g.gemeinde, g.strasse, g.parzelle, egrid, g.bauherrschaft, g.beschreibung,
      nb.length ? `{${nb.join(',')}}` : null, g.nummer, g.id, g.einspracheBis, g.publiziertBis,
      `https://amtsblattportal.ch/#!/search/publications/detail/${g.id}`, g.kanton, p?.e ?? null, p?.n ?? null,
    ].map(csvFeld).join(','));
  });
  writeFileSync(aus, zeilen.join('\n') + (zeilen.length ? '\n' : ''));
  console.log(`\nZeitraum ${ab} bis ${bis}: ${liste.length} Publikationen, gelesen ${zeilen.length}, nicht lesbar ${fehlt}, ausgeschlossen (ZH, AG, SG, LU) ${ausgeschlossen}`);
  console.log('Kanton  Gesuche  mit Punkt  mit EGRID');
  for (const [k, z] of Object.entries(zaehler).sort()) console.log(`${k.padEnd(7)} ${String(z.n).padStart(7)} ${String(z.punkt).padStart(10)} ${String(z.egrid).padStart(10)}`);
}
