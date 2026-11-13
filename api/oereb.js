import { auszugKurz, dienstBasis } from './_lib/oereb.js';

// ÖREB-Auszug einer Parzelle, gekürzt. Über den Server, weil rund die
// Hälfte der Kantone keinen Abruf aus dem Browser erlaubt (CORS, gemessen
// am 13. November 2026: Schwyz, Ob- und Nidwalden, Zug, Solothurn,
// Basel-Land, Schaffhausen, beide Appenzell, St. Gallen, Graubünden,
// Neuenburg, Jura). Die Adresse des Kantonsdienstes kommt immer von
// swisstopo, nie vom Aufrufer; so taugt die Funktion nicht als offener
// Umweg zu beliebigen Servern.
const API = 'https://api3.geo.admin.ch/rest/services';

async function ebene(e, n, layer, toleranz = 0) {
  const q = new URLSearchParams({ geometryType: 'esriGeometryPoint', geometry: `${e},${n}`, sr: '2056', tolerance: String(toleranz), returnGeometry: 'false',
    layers: `all:${layer}`, mapExtent: `${e - 100},${n - 100},${e + 100},${n + 100}`, imageDisplay: '400,400,96', lang: 'de' });
  const r = await fetch(`${API}/all/MapServer/identify?${q}`, { signal: AbortSignal.timeout(8000) });
  return ((await r.json())?.results ?? []).map(x => x.attributes ?? x.properties ?? {});
}

export default async function handler(req, res) {
  const e = Number(req.query.e), n = Number(req.query.n);
  if (!(e > 2480000 && e < 2840000 && n > 1070000 && n < 1300000)) { res.status(400).json({ fehler: 'Punkt ausserhalb der Schweiz' }); return; }
  try {
    // Kulturgüter (KGS) als Punkte, darum 15 m Toleranz; geprüft an der Kirche Elgg. Das ISOS
    // liefert am Punkt nichts (Elgg, 13. November 2026) und taugt für eine Parzelle nicht.
    const [parzelle, stand, kgs] = await Promise.all([
      ebene(e, n, 'ch.kantone.cadastralwebmap-farbe'), ebene(e, n, 'ch.swisstopo-vd.stand-oerebkataster'),
      ebene(e, n, 'ch.babs.kulturgueter', 15).catch(() => null),
    ]);
    const egrid = parzelle[0]?.egris_egrid, basis = dienstBasis(stand[0]?.oereb_webservice);
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
    res.status(200).json({ egrid: egrid ?? null, pdf, auszug, bund });
  } catch {
    res.status(502).json({ fehler: 'Dienst antwortet nicht' });
  }
}
