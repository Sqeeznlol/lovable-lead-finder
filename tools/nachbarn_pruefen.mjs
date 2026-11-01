// Stellt die Nachbarsuche der Karte nach, mit echten Parzellen: erst die
// Parzelle an einem Punkt holen (wie ein Klick), dann mit ihrem Umriss
// die Nachbarn fragen -- genau so, wie NachbarnBund.tsx es tut, und
// einmal mit gekuerzten Koordinaten. Ausgegeben werden Laenge der
// Adresse, HTTP-Status und Anzahl Treffer. Keine Personendaten.
const API = 'https://api3.geo.admin.ch/rest/services/all/MapServer/identify';
const PUNKTE = [ // LV95, Zuerich
  ['Stadelhofen', 2683853, 1246722], ['Seefeld', 2684350, 1246050],
  ['Oerlikon', 2683300, 1251400], ['Altstetten', 2678900, 1248700],
];
const ringe = g => (g.type === 'Polygon' ? g.coordinates : g.coordinates.flat());
async function nachbarn(r, runden) {
  const rr = runden ? r.map(ring => ring.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10])) : r;
  const p = rr.flat(); const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
  const q = new URLSearchParams({
    geometry: JSON.stringify({ rings: rr }), geometryType: 'esriGeometryPolygon', sr: '2056', tolerance: '0',
    returnGeometry: 'false', layers: 'all:ch.kantone.cadastralwebmap-farbe',
    mapExtent: [Math.min(...xs) - 50, Math.min(...ys) - 50, Math.max(...xs) + 50, Math.max(...ys) + 50].join(','),
    imageDisplay: '600,600,96', lang: 'de' });
  const url = `${API}?${q}`;
  const a = await fetch(url); const t = await a.text(); let n = '-';
  try { n = JSON.parse(t).results.length; } catch { n = 'keine JSON-Antwort: ' + t.slice(0, 60).replace(/\s+/g, ' '); }
  return `Laenge ${url.length}, HTTP ${a.status}, Treffer ${n}`;
}
for (const [name, E, N] of PUNKTE) {
  const u = `${API}?geometryType=esriGeometryPoint&geometry=${E},${N}&sr=2056&tolerance=0&returnGeometry=true&geometryFormat=geojson`
    + `&layers=all:ch.kantone.cadastralwebmap-farbe&mapExtent=${E - 300},${N - 300},${E + 300},${N + 300}&imageDisplay=600,600,96&lang=de`;
  const j = await (await fetch(u)).json(); const g = j?.results?.[0]?.geometry;
  if (!g) { console.log(`${name}: keine Parzelle`); continue; }
  const r = ringe(g);
  console.log(`${name}: ${g.type}, ${r.flat().length} Eckpunkte`);
  console.log(`  wie heute:  ${await nachbarn(r, false)}`);
  console.log(`  gerundet:   ${await nachbarn(r, true)}`);
}
