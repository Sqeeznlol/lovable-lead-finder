/**
 * Was die öffentlichen Seiten beim Bund nachschlagen: Adressvorschläge,
 * und zur gewählten Adresse Parzelle und Bauzone.
 *
 * Nachgesehen am 1. November ("Auswerten -> potenzial-bund") an der
 * Sonneggstrasse 47 in Zürich: cadastralwebmap liefert number, egris_egrid
 * und den Umriss (Polygon, LV95); ch.are.bauzonen die harmonisierte
 * Zonenart (ch_bez_d, z.B. "Wohnzonen"). Den eigenen Bestand fragen diese
 * Seiten bewusst nicht -- sie stehen ohne Anmeldung offen.
 */
const API = 'https://api3.geo.admin.ch/rest/services';

export interface Vorschlag { label: string; e: number; n: number }

export async function adressVorschlaege(text: string): Promise<Vorschlag[]> {
  if (text.trim().length < 4) return [];
  const r = await fetch(`${API}/ech/SearchServer?type=locations&origins=address&limit=6&sr=2056&lang=de&searchText=${encodeURIComponent(text)}`);
  const j = await r.json();
  return ((j?.results ?? []) as { attrs?: Record<string, unknown> }[]).map(x => ({
    label: String(x.attrs?.label ?? '').replace(/<[^>]+>/g, '').trim(),
    // Mit sr=2056 steht der Ostwert in y, der Nordwert in x.
    e: Number(x.attrs?.y), n: Number(x.attrs?.x),
  })).filter(v => v.label && Number.isFinite(v.e) && Number.isFinite(v.n));
}

/** Fläche eines Polygons in LV95 (Meter) nach der Gaussschen Trapezformel; Löcher werden abgezogen. */
export function flaecheLv95(g: { type: string; coordinates: unknown }): number {
  const ring = (r: number[][]) => {
    let s = 0;
    for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
    return Math.abs(s) / 2;
  };
  const poly = (p: number[][][]) => (p.length ? ring(p[0]) - p.slice(1).reduce((a, h) => a + ring(h), 0) : 0);
  if (g.type === 'Polygon') return poly(g.coordinates as number[][][]);
  if (g.type === 'MultiPolygon') return (g.coordinates as number[][][][]).reduce((a, p) => a + poly(p), 0);
  return 0;
}

export interface ParzellenAuskunft { nummer: string | null; egrid: string | null; flaeche: number | null; zone: string | null; gemeinde: string | null }

export async function parzelleAmPunkt(e: number, n: number): Promise<ParzellenAuskunft> {
  const frage = async (layer: string, geometrie: boolean) => {
    const q = new URLSearchParams({ geometryType: 'esriGeometryPoint', geometry: `${e},${n}`, sr: '2056', tolerance: '0',
      returnGeometry: String(geometrie), geometryFormat: 'geojson', layers: `all:${layer}`,
      mapExtent: `${e - 100},${n - 100},${e + 100},${n + 100}`, imageDisplay: '400,400,96', lang: 'de' });
    const j = await (await fetch(`${API}/all/MapServer/identify?${q}`)).json();
    return j?.results?.[0] ?? null;
  };
  const [p, z] = await Promise.all([frage('ch.kantone.cadastralwebmap-farbe', true), frage('ch.are.bauzonen', false)]);
  const a = (p?.attributes ?? p?.properties ?? {}) as Record<string, unknown>;
  const za = (z?.attributes ?? z?.properties ?? {}) as Record<string, unknown>;
  const egrid = String(a.egris_egrid ?? '');
  return {
    nummer: a.number ? String(a.number) : null,
    egrid: /^CH[0-9A-Z]{12}$/.test(egrid) ? egrid : null,
    flaeche: p?.geometry ? Math.round(flaecheLv95(p.geometry)) : null,
    zone: za.ch_bez_d ? String(za.ch_bez_d) : null,
    gemeinde: za.name ? String(za.name) : null,
  };
}
