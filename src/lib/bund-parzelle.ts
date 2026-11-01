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

export interface BundParzelle { e: number; n: number; nachbarn: string[] }

type Ring = number[][];

/** Schwerpunkt einer Fläche aus ihren Ringen (der äussere zählt). */
export function mitte(ringe: Ring[]): { e: number; n: number } {
  const r = ringe[0];
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f;
  }
  if (Math.abs(a) < 1e-9) {
    // Entartete Fläche: Mittel der Ecken.
    return { e: r.reduce((s, p) => s + p[0], 0) / r.length, n: r.reduce((s, p) => s + p[1], 0) / r.length };
  }
  return { e: cx / (3 * a), n: cy / (3 * a) };
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
  const { e, n } = mitte(ringe);
  const p = ringe.flat(); const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
  const q = new URLSearchParams({ geometry: JSON.stringify({ rings: ringe }), geometryType: 'esriGeometryPolygon', sr: '2056',
    tolerance: '0', returnGeometry: 'false', layers: `all:${EBENE}`,
    mapExtent: [Math.min(...xs) - 50, Math.min(...ys) - 50, Math.max(...xs) + 50, Math.max(...ys) + 50].join(','),
    imageDisplay: '600,600,96', lang: 'de' });
  const ir = await fetch(`${API}/all/MapServer/identify?${q}`, { signal });
  const j = ir.ok ? await ir.json() : null;
  const nachbarn = [...new Set<string>(((j?.results ?? []) as { attributes?: Record<string, unknown> }[])
    .map(x => String(x.attributes?.egris_egrid ?? '')).filter(x => EGRID.test(x) && x !== egrid))];
  return { e, n, nachbarn };
}
