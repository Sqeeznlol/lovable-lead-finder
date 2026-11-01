// Was liefert der Bund an einem Punkt, das ein Potenzialcheck zeigen
// kann? Bauzone (ch.are.bauzonen) und Parzelle (cadastralwebmap), mit
// allen Attributnamen -- nachsehen statt annehmen. Punkt: Sonneggstrasse
// 47, Zuerich (LV95 aus dem Import-Lauf vom 1. November).
const [E, N] = [2683596, 1248364];
for (const layer of ['ch.are.bauzonen', 'ch.kantone.cadastralwebmap-farbe']) {
  const q = new URLSearchParams({ geometryType: 'esriGeometryPoint', geometry: `${E},${N}`, sr: '2056', tolerance: '0',
    returnGeometry: 'true', geometryFormat: 'geojson', layers: `all:${layer}`,
    mapExtent: `${E - 100},${N - 100},${E + 100},${N + 100}`, imageDisplay: '400,400,96', lang: 'de' });
  const r = await fetch(`https://api3.geo.admin.ch/rest/services/all/MapServer/identify?${q}`);
  const j = await r.json();
  const t = j?.results?.[0];
  console.log(`\n${layer}: HTTP ${r.status}, ${j?.results?.length ?? 0} Treffer`);
  if (t) {
    console.log('  Attribute:', JSON.stringify(t.attributes ?? t.properties));
    console.log('  Geometrie:', t.geometry?.type, 'Punkte', JSON.stringify(t.geometry?.coordinates ?? '').length);
  }
}
