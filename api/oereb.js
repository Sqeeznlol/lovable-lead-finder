import { auszugKurz, dienstBasis } from './_lib/oereb.js';
import { solarAus, waermenetzAus } from './_lib/umgebung.js';
import { ZH_EBENE, ZH_WFS, zhZiffernAus } from './_lib/ziffern.js';

// ÖREB-Auszug einer Parzelle, gekürzt. Über den Server, weil rund die
// Hälfte der Kantone keinen Abruf aus dem Browser erlaubt (CORS, gemessen
// am 13. November 2026: Schwyz, Ob- und Nidwalden, Zug, Solothurn,
// Basel-Land, Schaffhausen, beide Appenzell, St. Gallen, Graubünden,
// Neuenburg, Jura). Die Adresse des Kantonsdienstes kommt immer von
// swisstopo, nie vom Aufrufer; so taugt die Funktion nicht als offener
// Umweg zu beliebigen Servern.
const API = 'https://api3.geo.admin.ch/rest/services';

// Toleranz in Metern: Ausschnitt und Bild sind so gewählt, dass ein Bildpunkt ein Meter ist.
async function treffer(e, n, layer, toleranz = 0, geometrie = false) {
  const w = Math.max(100, toleranz + 50);
  const q = new URLSearchParams({ geometryType: 'esriGeometryPoint', geometry: `${e},${n}`, sr: '2056', tolerance: String(toleranz), returnGeometry: String(geometrie),
    geometryFormat: 'geojson', layers: `all:${layer}`, mapExtent: `${e - w},${n - w},${e + w},${n + w}`, imageDisplay: `${2 * w},${2 * w},96`, lang: 'de' });
  const r = await fetch(`${API}/all/MapServer/identify?${q}`, { signal: AbortSignal.timeout(8000) });
  return (await r.json())?.results ?? [];
}
const ebene = async (e, n, layer, toleranz = 0) => (await treffer(e, n, layer, toleranz)).map(x => x.attributes ?? x.properties ?? {});

async function solar(e, n) {
  const id = (await ebene(e, n, 'ch.bfe.solarenergie-eignung-daecher', 10))[0]?.building_id;
  if (!id) return null;
  const q = new URLSearchParams({ layer: 'ch.bfe.solarenergie-eignung-daecher', searchField: 'building_id', searchText: String(id), contains: 'false', returnGeometry: 'false' });
  const r = await fetch(`${API}/all/MapServer/find?${q}`, { signal: AbortSignal.timeout(8000) });
  return solarAus(((await r.json())?.results ?? []).map(x => x.attributes ?? {}));
}

async function ziffernZh(e, n) {
  const q = new URLSearchParams({ SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature', TYPENAMES: ZH_EBENE,
    BBOX: `${e - 1},${n - 1},${e + 1},${n + 1},urn:ogc:def:crs:EPSG::2056`, COUNT: '3' });
  const r = await fetch(`${ZH_WFS}?${q}`, { signal: AbortSignal.timeout(10000) });
  return r.ok ? zhZiffernAus(await r.text()) : null;
}

async function umgebung(e, n) {
  const [dach, netze, oev, radon] = await Promise.all([
    solar(e, n).catch(() => null),
    treffer(e, n, 'ch.bfe.thermische-netze', 1500, true).catch(() => []),
    ebene(e, n, 'ch.are.gueteklassen_oev').catch(() => []),
    ebene(e, n, 'ch.bag.radonkarte').catch(() => []),
  ]);
  const prozent = Number(radon[0]?.probability_prozent);
  return {
    solar: dach, waermenetz: waermenetzAus(netze, e, n),
    oev: typeof oev[0]?.klasse_de === 'string' ? oev[0].klasse_de : null,
    radon: radon.length && Number.isFinite(prozent) ? prozent : null,
  };
}

export default async function handler(req, res) {
  const e = Number(req.query.e), n = Number(req.query.n);
  if (!(e > 2480000 && e < 2840000 && n > 1070000 && n < 1300000)) { res.status(400).json({ fehler: 'Punkt ausserhalb der Schweiz' }); return; }
  try {
    // Kulturgüter (KGS) als Punkte, darum 15 m Toleranz; geprüft an der Kirche Elgg. Das ISOS
    // liefert am Punkt nichts (Elgg, 13. November 2026) und taugt für eine Parzelle nicht.
    const [parzelle, stand, kgs, lage] = await Promise.all([
      ebene(e, n, 'ch.kantone.cadastralwebmap-farbe'), ebene(e, n, 'ch.swisstopo-vd.stand-oerebkataster'),
      ebene(e, n, 'ch.babs.kulturgueter', 15).catch(() => null), umgebung(e, n).catch(() => null),
    ]);
    const egrid = parzelle[0]?.egris_egrid, basis = dienstBasis(stand[0]?.oereb_webservice);
    // Ziffern der Zone: Zürich hier (WFS je Zonenfläche); AG, ZG, SZ, SO, SH, LU fragt die Seite
    // selbst in der Tabelle zone_ziffer ab (Downloads von geodienste.ch).
    const ziffern = parzelle[0]?.ak === 'ZH' ? await ziffernZh(e, n).catch(() => null) : null;
    const bund = { kulturgueter: kgs ? kgs.map(a => ({ name: a.beschreibung ?? null, kategorie: a.kgs_kategorie ?? null })) : null };
    let auszug = null;
    if (egrid && basis.startsWith('https://')) {
      const r = await fetch(`${basis}/extract/json?EGRID=${egrid}&GEOMETRY=true`, { signal: AbortSignal.timeout(20000) }).catch(() => null);
      if (r?.ok && (r.headers.get('content-type') ?? '').includes('json')) auszug = auszugKurz(await r.json(), e, n);
    }
    // Den PDF-Link nur, wenn dort wirklich ein PDF liegt: Luzern antwortete am 13. November 2026
    // mit 204, Zug mit 500, Solothurn lieferte das PDF, aber kein JSON.
    let pdf = egrid && basis.startsWith('https://') ? `${basis}/extract/pdf?EGRID=${egrid}` : null;
    if (pdf && !auszug) {
      // Nur die Kopfzeilen lesen, dann abbrechen; das PDF selbst brauchen wir nicht.
      const ab = new AbortController(), t = setTimeout(() => ab.abort(), 10000);
      const r = await fetch(pdf, { signal: ab.signal }).catch(() => null);
      if (!(r?.status === 200 && (r.headers.get('content-type') ?? '').includes('pdf'))) pdf = null;
      clearTimeout(t); ab.abort();
    }
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json({ egrid: egrid ?? null, pdf, auszug, bund, umgebung: lage, ziffern });
  } catch {
    res.status(502).json({ fehler: 'Dienst antwortet nicht' });
  }
}
