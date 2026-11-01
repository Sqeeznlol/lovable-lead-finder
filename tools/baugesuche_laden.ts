// Lädt die Zürcher Baugesuche der letzten Tage und ergänzt EGRID und
// Nachbarn beim Bund. Ausgabe: eine CSV-Datei für \copy in die
// Staging-Tabelle des Ablaufs "Baugesuche". Quelle und Spalten
// nachgesehen am 1. November (Auswerten -> baugesuche).
//
// Aufruf: npx tsx tools/baugesuche_laden.ts <tage> <ausgabe.csv>
// Keine Personendaten: von der Bauherrschaft nur die Rechtsform.
import { parallel } from '../src/lib/parallel';
import { writeFileSync } from 'node:fs';
import { adresseWaehlen } from '../src/lib/adresswahl';

const QUELLE = 'https://daten.statistik.zh.ch/ogd/daten/ressourcen/KTZH_00002982_00006183.csv';
const API = 'https://api3.geo.admin.ch/rest/services';
const KENNUNG = { 'User-Agent': 'Mozilla/5.0 (bauraum-lead-finder; Baugesuche)' };
const tage = Number(process.argv[2] ?? 3);
const aus = process.argv[3] ?? '/tmp/baugesuche.csv';

/** CSV mit Anführungszeichen und Zeilenumbrüchen in Feldern lesen. */
export function csvLesen(text: string, trenn = ','): string[][] {
  const zeilen: string[][] = []; let feld = ''; let zeile: string[] = []; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { feld += '"'; i++; } else if (c === '"') inQ = false; else feld += c;
    } else if (c === '"') inQ = true;
    else if (c === trenn) { zeile.push(feld); feld = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      zeile.push(feld); feld = '';
      if (zeile.some(f => f !== '')) zeilen.push(zeile);
      zeile = [];
    } else feld += c;
  }
  if (feld || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  return zeilen;
}

const csvFeld = (v: string | null) => (v == null ? '' : `"${String(v).replace(/"/g, '""')}"`);

async function json(url: string) {
  const r = await fetch(url, { headers: KENNUNG });
  return r.ok ? r.json() : null;
}

async function egridZurAdresse(adresse: string): Promise<string | null> {
  const s = await json(`${API}/ech/SearchServer?type=locations&origins=address&limit=3&sr=2056&lang=de&searchText=${encodeURIComponent(adresse)}`);
  const t: Record<string, unknown>[] = (s?.results ?? []).map((r: { attrs?: Record<string, unknown> }) => r.attrs ?? {});
  const w = adresseWaehlen(adresse, t.map(x => String(x.label ?? '')));
  if (!('index' in w)) return null;
  const [e, n] = [Number(t[w.index].y), Number(t[w.index].x)];
  const q = new URLSearchParams({ geometryType: 'esriGeometryPoint', geometry: `${e},${n}`, sr: '2056', tolerance: '0',
    returnGeometry: 'false', layers: 'all:ch.kantone.cadastralwebmap-farbe',
    mapExtent: `${e - 100},${n - 100},${e + 100},${n + 100}`, imageDisplay: '400,400,96', lang: 'de' });
  const g = String((await json(`${API}/all/MapServer/identify?${q}`))?.results?.[0]?.attributes?.egris_egrid ?? '');
  return /^CH[0-9A-Z]{12}$/.test(g) ? g : null;
}

async function nachbarn(egrid: string): Promise<string[]> {
  const f = new URLSearchParams({ layer: 'ch.kantone.cadastralwebmap-farbe', searchField: 'egris_egrid', searchText: egrid,
    contains: 'false', returnGeometry: 'true', geometryFormat: 'geojson', sr: '2056' });
  const g = (await json(`${API}/all/MapServer/find?${f}`))?.results?.[0]?.geometry;
  if (!g) return [];
  const ringe = g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
  const p = ringe.flat(); const xs = p.map((q: number[]) => q[0]), ys = p.map((q: number[]) => q[1]);
  const q = new URLSearchParams({ geometry: JSON.stringify({ rings: ringe }), geometryType: 'esriGeometryPolygon', sr: '2056',
    tolerance: '0', returnGeometry: 'false', layers: 'all:ch.kantone.cadastralwebmap-farbe',
    mapExtent: [Math.min(...xs) - 50, Math.min(...ys) - 50, Math.max(...xs) + 50, Math.max(...ys) + 50].join(','),
    imageDisplay: '600,600,96', lang: 'de' });
  const r = await json(`${API}/all/MapServer/identify?${q}`);
  return [...new Set<string>((r?.results ?? []).map((x: { attributes?: Record<string, unknown> }) => String(x.attributes?.egris_egrid ?? ''))
    .filter((e: string) => /^CH[0-9A-Z]{12}$/.test(e) && e !== egrid))];
}

const istHaupt = process.argv[1]?.endsWith('baugesuche_laden.ts');
if (istHaupt) {
  const roh = await (await fetch(QUELLE, { headers: KENNUNG })).text();
  const [kopf, ...daten] = csvLesen(roh);
  const i = (n: string) => { const k = kopf.indexOf(n); if (k < 0) throw new Error(`Spalte fehlt: ${n}`); return k; };
  const ab = new Date(Date.now() - tage * 864e5).toISOString().slice(0, 10);
  const neu = daten.filter(z => z[i('publicationDate')] >= ab);
  console.log(`Quelle: ${daten.length} Gesuche, davon ${neu.length} seit ${ab}`);
  const zeilen: string[] = [];
  let mitEgrid = 0, mitNachbarn = 0, fertig = 0;
  // Sechs zugleich und je Adresse nur einmal fragen: für ein ganzes
  // Jahr (rund 6000 Gesuche, eines je Parzelle mehrfach) dauerte es
  // nacheinander über eine Stunde.
  const merk = new Map<string, Promise<{ egrid: string | null; nb: string[] }>>();
  const verorten = (adresse: string) => {
    if (!merk.has(adresse)) merk.set(adresse, (async () => {
      try {
        const egrid = await egridZurAdresse(adresse);
        return { egrid, nb: egrid ? await nachbarn(egrid) : [] };
      } catch { return { egrid: null, nb: [] }; }  // ohne EGRID bleibt die Parzellennummer
    })());
    return merk.get(adresse)!;
  };
  await parallel(neu, 6, async z => {
    const strasse = [z[i('projectLocation_address_street')], z[i('projectLocation_address_houseNumber')]].filter(Boolean).join(' ');
    const ort = [z[i('projectLocation_address_swissZipCode')], z[i('projectLocation_address_town')]].filter(Boolean).join(' ');
    const adresse = [strasse, ort].filter(Boolean).join(', ');
    const { egrid, nb } = strasse ? await verorten(adresse) : { egrid: null, nb: [] as string[] };
    if (egrid) { mitEgrid++; if (nb.length) mitNachbarn++; }
    zeilen.push([
      z[i('id')], z[i('publicationNumber')], z[i('publicationDate')], z[i('bfs_nr')], z[i('municipality_name')],
      strasse || null, z[i('districtCadastre_relation_cadastre')] || null, egrid,
      z[i('buildingContractor_company_legalForm_de')] || null, z[i('projectDescription')] || null,
      nb.length ? `{${nb.join(',')}}` : null,
      // Zum Nachprüfen: Publikation im Amtsblatt, Fristen, Quelle.
      z[i('publicationNumber')] || null, z[i('id')] || null,
      z[i('entryDeadline')] || null, z[i('expirationDate')] || null, QUELLE,
    ].map(csvFeld).join(','));
    if (++fertig % 500 === 0) console.log(`  ${fertig} von ${neu.length}`);
  });
  writeFileSync(aus, zeilen.join('\n') + (zeilen.length ? '\n' : ''));
  console.log(`Geschrieben: ${zeilen.length}, mit EGRID ${mitEgrid}, mit Nachbarn ${mitNachbarn}`);
}
