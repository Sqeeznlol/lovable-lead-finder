// Gebäudeumrisse mit Höhen aus den Vektorkacheln von swisstopo
// (ch.swisstopo.base.vt, Ebene "building", Feld render_height). Die
// Kacheln liegen in Web-Mercator; swisstopo liefert sie bis Stufe 14,
// Stufe 15 und 16 ergaben am 13. November 2026 "404".

/** Näherung von swisstopo, auf etwa einen Meter genau. */
export function lv95NachWgs84(e, n) {
  const y = (e - 2600000) / 1e6, x = (n - 1200000) / 1e6;
  const l = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
  const b = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.014 * x * x * x;
  return { lat: b * 100 / 36, lon: l * 100 / 36 };
}
export function wgs84NachLv95(lat, lon) {
  const b = (lat * 3600 - 169028.66) / 10000, l = (lon * 3600 - 26782.5) / 10000;
  return {
    e: 2600072.37 + 211455.93 * l - 10938.51 * l * b - 0.36 * l * b * b - 44.54 * l * l * l,
    n: 1200147.07 + 308807.95 * b + 3745.25 * l * l + 76.63 * b * b - 194.56 * l * l * b + 119.79 * b * b * b,
  };
}

export const STUFE = 14;
/** Alle Kacheln, die das Quadrat ±r Meter um den Punkt berühren. */
export function kacheln(e, n, r = 100) {
  const k = (lat, lon) => {
    const z = 2 ** STUFE, rad = lat * Math.PI / 180;
    return [Math.floor((lon + 180) / 360 * z), Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * z)];
  };
  const a = lv95NachWgs84(e - r, n + r), c = lv95NachWgs84(e + r, n - r);
  const [x0, y0] = k(a.lat, a.lon), [x1, y1] = k(c.lat, c.lon), aus = [];
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) aus.push([x, y]);
  return aus;
}

/**
 * Gebäude als Ringe in Metern relativ zum Punkt (Osten, Norden), nur was
 * ganz innerhalb von r Metern liegt. ringe: Ringe in Längen/Breitengrad.
 */
export function gebaeudeAus(ringe, e, n, r = 100) {
  const aus = [];
  for (const { h, ring } of ringe) {
    const rel = ring.map(([lon, lat]) => { const p = wgs84NachLv95(lat, lon); return [Math.round((p.e - e) * 10) / 10, Math.round((p.n - n) * 10) / 10]; });
    if (rel.length >= 4 && rel.every(([u, v]) => Math.hypot(u, v) < r)) aus.push({ h: Math.round((Number(h) || 3) * 10) / 10, r: rel });
  }
  return aus;
}
