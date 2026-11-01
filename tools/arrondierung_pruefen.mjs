// Stellt die Nachbarsuche der Arrondierung nach (src/lib/arrondierung.ts):
// Umriss per EGRID beim Bund (find, sr=2056), dann identify mit dem
// Umriss als Polygon. Eingabe: EGRIDs auf stdin. Ausgabe je Parzelle die
// Anzahl Nachbarn, und alle Nachbar-EGRIDs als Liste fuer die Datenbank.
import { readFileSync } from 'node:fs';
const API = 'https://api3.geo.admin.ch/rest/services/all/MapServer';
const egrids = readFileSync(0, 'utf8').split('\n').map(s => s.trim()).filter(s => /^CH[0-9A-Z]{12}$/.test(s));
const alle = new Set();
for (const egrid of egrids) {
  const f = new URLSearchParams({ layer: 'ch.kantone.cadastralwebmap-farbe', searchField: 'egris_egrid', searchText: egrid,
    contains: 'false', returnGeometry: 'true', geometryFormat: 'geojson', sr: '2056' });
  const g = (await (await fetch(`${API}/find?${f}`)).json())?.results?.[0]?.geometry;
  if (!g) { console.log(`${egrid}: kein Umriss`); continue; }
  const ringe = g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
  const p = ringe.flat(); const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
  const q = new URLSearchParams({ geometry: JSON.stringify({ rings: ringe }), geometryType: 'esriGeometryPolygon', sr: '2056',
    tolerance: '0', returnGeometry: 'false', layers: 'all:ch.kantone.cadastralwebmap-farbe',
    mapExtent: [Math.min(...xs) - 50, Math.min(...ys) - 50, Math.max(...xs) + 50, Math.max(...ys) + 50].join(','),
    imageDisplay: '600,600,96', lang: 'de' });
  const r = await (await fetch(`${API}/identify?${q}`)).json();
  const n = [...new Set((r?.results ?? []).map(x => String(x.attributes?.egris_egrid ?? '')).filter(e => /^CH[0-9A-Z]{12}$/.test(e) && e !== egrid))];
  n.forEach(e => alle.add(e));
  console.log(`${egrid}: ${n.length} Nachbarn`);
}
console.log('LISTE ' + [...alle].join(','));
