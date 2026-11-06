/**
 * Lage und Nachbarn einer Parzelle beim Bund (geo.admin.ch), im Browser.
 *
 * Gebraucht, wenn ein Fonds seine Datensätze einspielt: Die Datenbank
 * hat für Zürich keine Umrisse (kein Platz), das Universum braucht aber
 * einen Punkt je Liegenschaft und die Nachbarn, damit auffällt, wo
 * Liegenschaften verschiedener Fonds aneinandergrenzen. Dieselben
 * Abfragen wie tools/baugesuche_laden.ts, das sie für die Baugesuche
 * seit Wochen täglich stellt.
 */
const API = 'https://api3.geo.admin.ch/rest/services';
const EBENE = 'ch.kantone.cadastralwebmap-farbe';
const EGRID = /^CH[0-9A-Z]{12}$/;

export interface BundParzelle { e: number; n: number; flaeche: number; nachbarn: string[] }

type Ring = number[][];

/** Schwerpunkt und Fläche in m² aus den Ringen (der äussere zählt, Löcher gehen ab). */
export function mitte(ringe: Ring[]): { e: number; n: number; flaeche: number } {
  const r = ringe[0];
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f;
  }
  let loch = 0;
  for (const h of ringe.slice(1)) {
    let b = 0;
    for (let i = 0, j = h.length - 1; i < h.length; j = i++) b += h[j][0] * h[i][1] - h[i][0] * h[j][1];
    loch += Math.abs(b) / 2;
  }
  if (Math.abs(a) < 1e-9) {
    // Entartete Fläche: Mittel der Ecken.
    return { e: r.reduce((s, p) => s + p[0], 0) / r.length, n: r.reduce((s, p) => s + p[1], 0) / r.length, flaeche: 0 };
  }
  return { e: cx / (3 * a), n: cy / (3 * a), flaeche: Math.max(0, Math.abs(a) / 2 - loch) };
}

export async function bundParzelle(egrid: string, signal?: AbortSignal): Promise<BundParzelle | null> {
  if (!EGRID.test(egrid)) return null;
  const f = new URLSearchParams({ layer: EBENE, searchField: 'egris_egrid', searchText: egrid, contains: 'false',
    returnGeometry: 'true', geometryFormat: 'geojson', sr: '2056' });
  const fr = await fetch(`${API}/all/MapServer/find?${f}`, { signal });
  if (!fr.ok) return null;
  const g = (await fr.json())?.results?.[0]?.geometry;
  if (!g) return null;
  const ringe: Ring[] = g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
  const { e, n, flaeche } = mitte(ringe);
  // Nur die Aussenringe an den Bund: mit Löchern antwortet er "Please
  // provide a valid geometry" (Starrkirch-Wil, 6. November). Die
  // eingeschlossene Parzelle liegt im Umriss und zählt so trotzdem.
  const aussen: Ring[] = g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((t: Ring[]) => t[0]);
  const p = aussen.flat(); const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
  const q = new URLSearchParams({ geometry: JSON.stringify({ rings: aussen }), geometryType: 'esriGeometryPolygon', sr: '2056',
    tolerance: '0', returnGeometry: 'false', layers: `all:${EBENE}`,
    mapExtent: [Math.min(...xs) - 50, Math.min(...ys) - 50, Math.max(...xs) + 50, Math.max(...ys) + 50].join(','),
    imageDisplay: '600,600,96', lang: 'de' });
  const ir = await fetch(`${API}/all/MapServer/identify?${q}`, { signal });
  const j = ir.ok ? await ir.json() : null;
  const nachbarn = [...new Set<string>(((j?.results ?? []) as { attributes?: Record<string, unknown> }[])
    .map(x => String(x.attributes?.egris_egrid ?? '')).filter(x => EGRID.test(x) && x !== egrid))];
  return { e, n, flaeche: Math.round(flaeche), nachbarn };
}
