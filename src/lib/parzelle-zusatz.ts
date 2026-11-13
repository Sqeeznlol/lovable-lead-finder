/**
 * Weitere amtliche Angaben zur Parzelle eines Leads (Julian, 13. November:
 * "weitere Infos auf der Parzelle, die der Kunde ausgefüllt hat?
 * Altlasten? irgendwelche Infos zusätzlich?").
 *
 * Nur, was sich am 13. November beim Bund und bei geodienste.ch für eine
 * Parzelle verlässlich abfragen liess (Benglen, Bodenacherstrasse 79, und
 * ein belasteter Standort in Zürich). Weggelassen, weil ohne Treffer oder
 * nicht abfragbar: Strassenlärm und Hochwasser (Fehler 400), ISOS und
 * Fernwärme (auch mitten in Zürich leer), Grundwasser (in Zürich nur
 * «RHEIN», ohne Erklärung nicht lesbar).
 *
 * Verbindlich ist der ÖREB-Auszug des Kantons: er steht als PDF oben.
 */
const API = 'https://api3.geo.admin.ch/rest/services/all/MapServer';
// Kataster der belasteten Standorte aller Kantone, zusammengeführt (geodienste.ch).
const KBS = 'https://wfs.geodienste.ch/kataster_belasteter_standorte_v1_5_0/deu';

export type Belastung = { typ: string; status: string; behoerde: string | null; nummer: string | null; link: string | null };
export type Zusatz = {
  oereb: { pdf: string; stelle: string | null } | null;
  belastet: Belastung[];
  oev: string | null;
  radon: number | null;
  baugrund: string | null;
  solar: { kwh: number; flaeche: number; eignung: string } | null;
};

type Attr = Record<string, unknown>;

async function identify(e: number, n: number, ebene: string, toleranz = 0): Promise<Attr[]> {
  const q = new URLSearchParams({
    geometryType: 'esriGeometryPoint', geometry: `${e},${n}`, sr: '2056', tolerance: String(toleranz), returnGeometry: 'false',
    layers: `all:${ebene}`, mapExtent: `${e - 200},${n - 200},${e + 200},${n + 200}`, imageDisplay: '400,400,96', lang: 'de',
  });
  const r = await fetch(`${API}/identify?${q}`);
  if (!r.ok) return [];
  return ((await r.json())?.results ?? []).map((x: { attributes?: Attr }) => x.attributes ?? {});
}

/** ÖREB-Auszug der Parzelle: Dienst des Kantons plus EGRID des Leads (nicht die zufällig getroffene Nachbarparzelle). */
export function oerebAus(a: Attr | undefined, egrid: string): Zusatz['oereb'] {
  if (!a) return null;
  const dienst = typeof a.oereb_webservice === 'string' ? a.oereb_webservice.replace(/\/$/, '') : null;
  const pdf = dienst ? `${dienst}/extract/pdf/?EGRID=${egrid}` : typeof a.oereb_extract_pdf === 'string' ? a.oereb_extract_pdf : null;
  return pdf ? { pdf, stelle: typeof a.firmenname === 'string' ? a.firmenname : null } : null;
}

/** Einträge des Katasters der belasteten Standorte (WFS, GML), die diese EGRID nennen. */
export function belastungenAus(gml: string, egrid: string): Belastung[] {
  const aus: Belastung[] = [];
  for (const block of gml.match(/<ms:belastete_standorte_(?:flaechen|punkte)\b[\s\S]*?<\/ms:belastete_standorte_(?:flaechen|punkte)>/g) ?? []) {
    const f = (name: string) => {
      const m = block.match(new RegExp(`<ms:${name}>([^<]*)</ms:${name}>`));
      return m && m[1].trim() ? m[1].trim().replace(/&amp;/g, '&') : null;
    };
    if (!(f('egrid') ?? '').split(/[;,\s]+/).includes(egrid)) continue;
    aus.push({ typ: f('standorttyp') ?? 'Belasteter Standort', status: f('statusaltlv') ?? '', behoerde: f('zustaendige_behoerde'),
      nummer: f('katasternummer'), link: f('url_kbs_auszug') ?? f('url_kataster') });
  }
  return aus;
}

/** Solar: alle Dachflächen des Gebäudes; gezählt wird, was mindestens «gut» geeignet ist (Klasse 3 von 5). */
export function solarAus(flaechen: Attr[]): Zusatz['solar'] {
  const gut = flaechen.filter(a => Number(a.klasse) >= 3);
  if (!gut.length) return null;
  const beste = gut.reduce((b, a) => (Number(a.klasse) > Number(b.klasse) ? a : b));
  return {
    kwh: Math.round(gut.reduce((s, a) => s + (Number(a.stromertrag) || 0), 0)),
    flaeche: Math.round(gut.reduce((s, a) => s + (Number(a.flaeche) || 0), 0)),
    eignung: String(beste.klasse_text ?? '').split('##')[0] || `Klasse ${beste.klasse}`,
  };
}

const text = (a: Attr | undefined, feld: string) => (a && typeof a[feld] === 'string' && a[feld] ? String(a[feld]) : null);

export async function zusatzAbfragen(egrid: string, e: number, n: number): Promise<Zusatz> {
  const kbs = async () => {
    const q = new URLSearchParams({ SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature',
      TYPENAMES: 'ms:belastete_standorte_flaechen,ms:belastete_standorte_punkte', BBOX: `${e - 150},${n - 150},${e + 150},${n + 150},urn:ogc:def:crs:EPSG::2056`, COUNT: '50' });
    const r = await fetch(`${KBS}?${q}`);
    return r.ok ? belastungenAus(await r.text(), egrid) : [];
  };
  const solar = async () => {
    const treffer = await identify(e, n, 'ch.bfe.solarenergie-eignung-daecher', 10);
    const id = treffer[0]?.building_id;
    if (!id) return null;
    const q = new URLSearchParams({ layer: 'ch.bfe.solarenergie-eignung-daecher', searchField: 'building_id', searchText: String(id), contains: 'false', returnGeometry: 'false' });
    const r = await fetch(`${API}/find?${q}`);
    return r.ok ? solarAus(((await r.json())?.results ?? []).map((x: { attributes?: Attr }) => x.attributes ?? {})) : null;
  };
  const [oereb, belastet, oev, radon, baugrund, dach] = await Promise.all([
    identify(e, n, 'ch.swisstopo-vd.stand-oerebkataster'), kbs().catch(() => []),
    identify(e, n, 'ch.are.gueteklassen_oev'), identify(e, n, 'ch.bag.radonkarte'),
    identify(e, n, 'ch.bafu.gefahren-baugrundklassen'), solar().catch(() => null),
  ]);
  const prozent = Number(radon[0]?.probability_prozent);
  return {
    oereb: oerebAus(oereb[0], egrid), belastet,
    oev: text(oev[0], 'klasse_de'), radon: Number.isFinite(prozent) && radon.length ? prozent : null,
    baugrund: text(baugrund[0], 'bgk'), solar: dach,
  };
}
