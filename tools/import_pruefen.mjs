// Stellt die Zuordnung des Portfolio-Imports nach (src/lib/portfolio-import.ts):
// Adresse beim Bund suchen, am Punkt die Parzelle (EGRID) holen, und mit
// der erwarteten EGRID aus dem Bestand vergleichen. Eingabe auf stdin,
// je Zeile "EGRID<Tab>Adresse". Aus der Entwicklungsumgebung ist der
// Bund nicht erreichbar -- darum hier, im Ablauf.
import { readFileSync } from 'node:fs';
const zeilen = readFileSync(0, 'utf8').split('\n').map(z => z.split('\t')).filter(z => z.length === 2 && z[1].trim());
let passt = 0;
for (const [erwartet, adresse] of zeilen) {
  const s = await (await fetch('https://api3.geo.admin.ch/rest/services/ech/SearchServer?type=locations&origins=address&limit=3&sr=2056&lang=de&searchText='
    + encodeURIComponent(adresse))).json();
  const t = (s?.results ?? []).map(r => r.attrs ?? {});
  if (!t.length) { console.log(`${adresse} -> nicht gefunden`); continue; }
  const labels = [...new Set(t.map(x => String(x.label ?? '').replace(/<[^>]+>/g, '')))];
  const [e, n] = [Number(t[0].y), Number(t[0].x)];
  const q = new URLSearchParams({ geometryType: 'esriGeometryPoint', geometry: `${e},${n}`, sr: '2056', tolerance: '0',
    returnGeometry: 'false', layers: 'all:ch.kantone.cadastralwebmap-farbe',
    mapExtent: `${e - 100},${n - 100},${e + 100},${n + 100}`, imageDisplay: '400,400,96', lang: 'de' });
  const j = await (await fetch(`https://api3.geo.admin.ch/rest/services/all/MapServer/identify?${q}`)).json();
  const egrid = String(j?.results?.[0]?.attributes?.egris_egrid ?? '');
  const ok = egrid === erwartet.trim();
  if (ok) passt++;
  console.log(`${adresse} -> ${labels.length} Treffer, erster "${labels[0]}", E/N ${Math.round(e)}/${Math.round(n)}, EGRID ${egrid || '-'} ${ok ? 'PASST' : 'ABWEICHEND (erwartet ' + erwartet + ')'}`);
}
console.log(`\n${passt} von ${zeilen.length} richtig zugeordnet`);
