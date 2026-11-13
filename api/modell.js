import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import { gebaeudeAus, kacheln, STUFE } from './_lib/modell.js';

// Gebäude rund um eine Adresse für das Ladebild der Check-Seiten. Hier
// statt im Browser, weil die Kacheln Binärdaten sind und der Browser sonst
// zwei Bibliotheken und bis zu vier Kacheln laden müsste.
export default async function handler(req, res) {
  const e = Number(req.query.e), n = Number(req.query.n);
  // Nur Punkte in der Schweiz; alles andere ist kein Aufruf unserer Seiten.
  if (!(e > 2480000 && e < 2840000 && n > 1070000 && n < 1300000)) { res.status(400).json({ fehler: 'Punkt ausserhalb der Schweiz' }); return; }
  try {
    const ringe = [];
    await Promise.all(kacheln(e, n).map(async ([x, y]) => {
      const r = await fetch(`https://vectortiles.geo.admin.ch/tiles/ch.swisstopo.base.vt/v1.0.0/${STUFE}/${x}/${y}.pbf`, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return;
      const L = new VectorTile(new Pbf(Buffer.from(await r.arrayBuffer()))).layers.building;
      for (let i = 0; L && i < L.length; i++) {
        const f = L.feature(i), g = f.toGeoJSON(x, y, STUFE).geometry;
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        for (const p of polys) ringe.push({ h: f.properties.render_height, ring: p[0] });
      }
    }));
    res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=2592000');
    res.status(200).json({ gebaeude: gebaeudeAus(ringe, e, n) });
  } catch {
    res.status(502).json({ fehler: 'swisstopo antwortet nicht' });
  }
}
