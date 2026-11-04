import { supabase } from '@/integrations/supabase/client';
import { lv95NachWgs84, wgs84NachLv95 } from '@/lib/koordinaten';
import { umrissVomBund } from '@/hooks/use-portfolio';
import { mitte } from '@/lib/bund-parzelle';

/**
 * Daten und Farben der 3D-Karte (Julian, 3. November: "genau so die 3D-Map
 * wie im Video, realistisch, du siehst den Umriss, wie hoch es ist, wie
 * sie heizen -- anhand von unseren Daten").
 *
 * Quellen, am 3. November nachgesehen:
 *   Gelände      3d.geo.admin.ch/ch.swisstopo.terrain.3d (quantized-mesh)
 *   Gebäude      3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d (3D Tiles,
 *                je Gebäude EGID, GESAMTHOEHE, DACH_MIN/MAX, OBJEKTART --
 *                nicht überall: am 4. November in Kloten an 0 von 1'386
 *                Gebäudeteilen eine EGID, keine Höhe; in Albisrieden und
 *                im Niederdorf an 98 bis 99 %. Siehe egidAmOrt.)
 *   Zonen        maps.zh.ch/wfs/OGDZHWFS, Grundnutzung aller Zürcher
 *                Gemeinden (typ_zh_code, vollgeschosse_max, gebaeudehoehe_max)
 *   Register     Tabelle `gebaeude` (Ablauf "Gebäude", aus dem BFS-Register)
 *   Fotos        tile.googleapis.com, Photorealistic 3D Tiles (mit Schlüssel)
 */

/**
 * Fotorealistische Häuser (Fassaden, Dächer, Bäume aus Luftaufnahmen,
 * Julian am 4. November: "es sollte genau so aussehen wie das Gebäude")
 * kommen von Google, "Photorealistic 3D Tiles" der Map Tiles API. Der
 * Schlüssel ist derselbe wie für Street View (Vercel,
 * VITE_GOOGLE_MAPS_KEY); ohne ihn bleibt das Modell des Bundes.
 */
export const GOOGLE_KEY: string | undefined = import.meta.env.VITE_GOOGLE_MAPS_KEY || undefined;
export const FOTO_MOEGLICH = !!GOOGLE_KEY;

export const GELAENDE_URL = 'https://3d.geo.admin.ch/ch.swisstopo.terrain.3d/v1/';
export const GEBAEUDE_URL = 'https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/tileset.json';
/**
 * Dieselben Gebäude, aber mit eigenem, schlankem Verzeichnis für den
 * Kanton Zürich (tools/gebaeude_kacheln.py, Ablauf "3D-Gebäude"): das des
 * Bundes kostete beim Öffnen 24 MB, unseres eine Wurzel von 105 kB und
 * Felder von höchstens 54 kB. Die Häuser selbst kommen weiter vom Bund.
 */
export const GEBAEUDE_ZH_URL = '/3d/zh/tileset.json';
/** Der Rahmen, für den das Zürcher Verzeichnis gebaut ist (Grad, wie im Werkzeug). */
export const inZuerich = (lat: number, lon: number) => lon >= 8.35 && lon <= 9.0 && lat >= 47.15 && lat <= 47.7;
export const LUFTBILD_URL = 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg';
/** Hell und ruhig, wie die Modellansicht im Video. */
export const MODELL_URL = 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg';
export const ZONEN_WFS = 'https://maps.zh.ch/wfs/OGDZHWFS';
export const ZONEN_EBENE = 'ms:ogd-0156_arv_basis_np_gn_zonenflaeche_f';

// ----------------------------------------------------------------- Zonen
/**
 * Farben der Grundnutzung nach dem kantonalen Code (typ_zh_code). Die
 * Gruppen sind die, die der Dienst für Albisrieden lieferte (Namen aus
 * typ_zh_bezeichnung). Wohnzonen werden mit den Geschossen dunkler, wie
 * die Zonenpläne der Gemeinden.
 */
export interface ZonenArt { titel: string; farbe: string }
export function zonenArt(code: string | null | undefined): ZonenArt {
  const c = code ?? '';
  if (c.startsWith('C11')) {
    const g = Number(c.slice(-1)) || 3;
    const stufe = ['#F7E3A1', '#F7E3A1', '#F4CC74', '#F0B055', '#EA9142', '#E2733A'][Math.min(g, 5)];
    return { titel: g >= 5 ? 'Wohnzone 5+ Geschosse' : `Wohnzone ${g} Geschosse`, farbe: stufe };
  }
  if (c.startsWith('C12')) return { titel: 'Industrie und Gewerbe', farbe: '#A99BD6' };
  if (c === 'C1306') return { titel: 'Quartiererhaltung', farbe: '#E8823C' };
  if (c.startsWith('C13')) return { titel: 'Kernzone', farbe: '#C9603F' };
  if (c.startsWith('C14')) return { titel: 'Zentrumszone', farbe: '#E06190' };
  if (c.startsWith('C15')) return { titel: 'Öffentliche Bauten', farbe: '#7EA6DA' };
  if (c.startsWith('C16') || c.startsWith('C31')) return { titel: 'Freihalte- und Erholungszone', farbe: '#9CCB80' };
  if (c.startsWith('C32')) return { titel: 'Gewässer', farbe: '#7CC6E2' };
  if (c.startsWith('C44')) return { titel: 'Wald', farbe: '#5E9B5B' };
  return { titel: 'Übrige Zone', farbe: '#C8C8C8' };
}
// Gewässer und Wald fehlten, obwohl sie eingefärbt werden: in Zürich war
// die Limmat blau, und die Legende nannte nur "Öffentliche Bauten" (3D-
// Prüfung, 4. November).
export const ZONEN_LEGENDE: ZonenArt[] = [
  zonenArt('C1102'), zonenArt('C1104'), zonenArt('C1105'), zonenArt('C1306'), zonenArt('C1307'),
  zonenArt('C1401'), zonenArt('C1202'), zonenArt('C1501'), zonenArt('C3102'), zonenArt('C3201'), zonenArt('C4401'),
];

/** Die Zonen um einen Punkt, als GeoJSON in WGS84. Nur Kanton Zürich. */
export async function zonenUm(lat: number, lon: number, radiusM = 650, signal?: AbortSignal): Promise<GeoJSON.FeatureCollection | null> {
  const { e, n } = wgs84NachLv95(lat, lon);
  const bbox = [e - radiusM, n - radiusM, e + radiusM, n + radiusM].map(Math.round).join(',');
  const p = new URLSearchParams({
    SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature', TYPENAMES: ZONEN_EBENE,
    BBOX: `${bbox},urn:ogc:def:crs:EPSG::2056`, OUTPUTFORMAT: 'geojson', SRSNAME: 'urn:ogc:def:crs:EPSG::4326',
  });
  const r = await fetch(`${ZONEN_WFS}?${p}`, { signal });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.type === 'FeatureCollection' ? j : null;
}

// --------------------------------------------------------------- Register
export interface Gebaeude {
  egid: number; egrid: string | null; baujahr: number | null; geschosse: number | null; wohnungen: number | null;
  grundflaeche: number | null; energieflaeche: number | null; heizung: number | null; heizung_energie: number | null;
  warmwasser_energie: number | null; heizung_seit: string | null;
}
const FELDER = 'egid, egrid, baujahr, geschosse, wohnungen, grundflaeche, energieflaeche, heizung, heizung_energie, warmwasser_energie, heizung_seit';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

/** Registerangaben zu vielen Gebäuden, in Stapeln (die Adresse hat eine Längengrenze). */
export async function gebaeudeLaden(egids: number[]): Promise<Gebaeude[]> {
  const aus: Gebaeude[] = [];
  for (let i = 0; i < egids.length; i += 200) {
    const r = await db().from('gebaeude').select(FELDER).in('egid', egids.slice(i, i + 200));
    if (r.error) throw new Error(r.error.message);
    aus.push(...(r.data as Gebaeude[]));
  }
  return aus;
}

/**
 * Ein Gebäude direkt beim Bund (api3, Ebene des Gebäuderegisters) --
 * für die Tafel beim Klick. Damit stehen Adresse und Zahlen auch dann da,
 * wenn die Tabelle `gebaeude` noch leer ist oder das Haus fehlt, und sie
 * sind tagesaktuell. Feldnamen am 3. November an EGID 302061147
 * (Freilagerstrasse 99) nachgesehen; der Dienst erlaubt fremde Seiten.
 */
const GWR_FIND = 'https://api3.geo.admin.ch/rest/services/ech/MapServer/find';
export async function gebaeudeBeimBund(egid: number, signal?: AbortSignal): Promise<{ adresse: string | null; geb: Gebaeude } | null> {
  const p = new URLSearchParams({
    layer: 'ch.bfs.gebaeude_wohnungs_register', searchField: 'egid', searchText: String(egid),
    contains: 'false', returnGeometry: 'false',
  });
  const r = await fetch(`${GWR_FIND}?${p}`, { signal });
  if (!r.ok) return null;
  const a = (await r.json())?.results?.[0]?.attributes as Record<string, unknown> | undefined;
  if (!a) return null;
  const zahl = (k: string) => { const x = Number(a[k]); return Number.isFinite(x) && a[k] !== null && a[k] !== '' ? x : null; };
  const seit = typeof a.gwaerdath1 === 'string' ? a.gwaerdath1.match(/^(\d{2})\.(\d{2})\.(\d{4})$/) : null;
  const strasse = typeof a.strname_deinr === 'string' && a.strname_deinr.trim() ? a.strname_deinr.trim() : null;
  const ort = [a.dplz4, a.dplzname].filter(x => x != null && x !== '').join(' ');
  return {
    adresse: strasse ? (ort ? `${strasse}, ${ort}` : strasse) : null,
    geb: {
      egid, egrid: typeof a.egrid === 'string' && a.egrid ? a.egrid : null,
      baujahr: zahl('gbauj'), geschosse: zahl('gastw'), wohnungen: zahl('ganzwhg'),
      grundflaeche: zahl('garea'), energieflaeche: zahl('gebf'),
      heizung: zahl('gwaerzh1'), heizung_energie: zahl('genh1'), warmwasser_energie: zahl('genw1'),
      heizung_seit: seit ? `${seit[3]}-${seit[2]}-${seit[1]}` : null,
    },
  };
}

/**
 * Das Gebäude des Registers an einem Ort. Nicht jede Kachel des Bundes
 * trägt eine EGID: gemessen am 4. November in Kloten 0 von 1'386
 * Gebäudeteilen, in Albisrieden und im Niederdorf 98 bis 99 %. Ohne EGID
 * fragt die Karte das Register beim Bund nach dem nächsten Gebäude um
 * die Mitte des angeklickten Hauses (api3, identify; Felder am selben
 * Tag an Klotener Häusern nachgesehen: egid, Lage als x/y in LV95).
 */
const GWR_IDENTIFY = 'https://api3.geo.admin.ch/rest/services/ech/MapServer/identify';
export async function egidAmOrt(lat: number, lon: number, radiusM = 25, signal?: AbortSignal): Promise<number | null> {
  const { e, n } = wgs84NachLv95(lat, lon);
  const r = Math.min(Math.max(radiusM, 1), 50);
  const p = new URLSearchParams({
    geometryType: 'esriGeometryPoint', geometry: `${e.toFixed(1)},${n.toFixed(1)}`, layers: 'all:ch.bfs.gebaeude_wohnungs_register',
    // Ausschnitt 100 m auf 100 Pixel: die Toleranz in Pixeln ist der Umkreis in Metern.
    tolerance: String(Math.round(r)), mapExtent: [e - 50, n - 50, e + 50, n + 50].map(x => x.toFixed(1)).join(','),
    imageDisplay: '100,100,96', sr: '2056', returnGeometry: 'true', lang: 'de',
  });
  const a = await fetch(`${GWR_IDENTIFY}?${p}`, { signal });
  if (!a.ok) return null;
  return naechsteEgid((await a.json())?.results, e, n);
}

/** Aus den Treffern des Registers das Gebäude, das dem Punkt (LV95) am nächsten liegt. */
export function naechsteEgid(treffer: unknown, e: number, n: number): number | null {
  if (!Array.isArray(treffer)) return null;
  let beste: { egid: number; d: number } | null = null;
  for (const t of treffer as { attributes?: Record<string, unknown>; geometry?: { x?: number; y?: number } }[]) {
    const egid = Number(t?.attributes?.egid);
    const x = Number(t?.geometry?.x ?? t?.attributes?.gkode), y = Number(t?.geometry?.y ?? t?.attributes?.gkodn);
    if (!Number.isFinite(egid) || egid <= 0 || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    const d = Math.hypot(x - e, y - n);
    if (!beste || d < beste.d) beste = { egid, d };
  }
  return beste?.egid ?? null;
}

/**
 * Kennung eines Gebäudes in den Kacheln des Bundes, auch ohne EGID: die
 * UUID. Ein Haus steht dort zweimal, einmal mit geschweiften Klammern,
 * einmal ohne (in Kloten an allen 14 Teilen einer Kachel gesehen).
 */
export function hausKennung(uuid: unknown): string | null {
  const s = String(uuid ?? '').replace(/[{}\s]/g, '').toUpperCase();
  return s || null;
}

// ---------------------------------------------------------------- Suche
/**
 * Ein Treffer der Ortssuche: Adresse (mit Gebäude), Parzelle (mit EGRID),
 * PLZ oder Gemeinde. Felder der Bundessuche am 3. November nachgesehen:
 * Adressen tragen in featureId "<EGID>_<Eingang>", Parzellen die EGRID
 * kleingeschrieben am Ende von detail ("ar6739 zurigo 261 ch739978917069").
 */
export interface Ort {
  art: 'adresse' | 'parzelle' | 'plz' | 'gemeinde';
  titel: string; unter: string; lat: number; lon: number;
  egid: number | null; egrid: string | null;
  /** Wie weit die Kamera weg bleibt: ein Haus nah, eine Gemeinde weit. */
  abstand: number;
}
const SUCHE_URL = 'https://api3.geo.admin.ch/rest/services/ech/SearchServer';
const ohneTags = (x: unknown) => String(x ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export function ortLesen(a: Record<string, unknown>): Ort | null {
  const lat = Number(a.lat), lon = Number(a.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const label = ohneTags(a.label);
  switch (a.origin) {
    case 'address': {
      const egid = Number(String(a.featureId ?? '').split('_')[0]);
      // "Freilagerstrasse 99 <b>8047 Zürich</b>": Strasse vorne, Ort fett.
      const fett = String(a.label ?? '').match(/<b>(.*?)<\/b>/)?.[1]?.trim() ?? '';
      // Ohne Hausnummer schreibt der Bund "Badenerstrasse #".
      const strasse = ohneTags(String(a.label ?? '').replace(/<b>.*?<\/b>/, '')).replace(/\s*#$/, '');
      return { art: 'adresse', titel: strasse || label, unter: fett, lat, lon, egid: Number.isFinite(egid) && egid > 0 ? egid : null, egrid: null, abstand: 360 };
    }
    case 'parcel': {
      const egrid = String(a.detail ?? '').match(/\b(ch\d{12})\b/i)?.[1]?.toUpperCase() ?? null;
      const nummer = label.replace(/\(.*\)/, '').trim().split(' ').pop() ?? label;
      return { art: 'parzelle', titel: `Parzelle ${nummer}`, unter: egrid ? `EGRID ${egrid}` : label, lat, lon, egid: null, egrid, abstand: 420 };
    }
    case 'zipcode':
      return { art: 'plz', titel: label.replace(/\s*-\s*/, ' '), unter: 'Postleitzahl', lat, lon, egid: null, egrid: null, abstand: 1600 };
    case 'gg25':
      return { art: 'gemeinde', titel: label, unter: 'Gemeinde', lat, lon, egid: null, egrid: null, abstand: 2200 };
    default:
      return null;
  }
}

/** Adressen, Strassen, Parzellennummern, PLZ und Gemeinden beim Bund. */
export async function ortSuchen(text: string, signal?: AbortSignal): Promise<Ort[]> {
  const p = new URLSearchParams({ type: 'locations', origins: 'address,parcel,zipcode,gg25', limit: '8', lang: 'de', searchText: text });
  const r = await fetch(`${SUCHE_URL}?${p}`, { signal });
  if (!r.ok) return [];
  const j = await r.json();
  return ((j?.results ?? []) as { attrs?: Record<string, unknown> }[])
    .map(x => (x.attrs ? ortLesen(x.attrs) : null)).filter((x): x is Ort => !!x);
}

/** Die amtlichen Texte der Codes (Tabelle gwr_kode). Leer, solange das Register nicht geladen ist. */
export async function kodesLaden(): Promise<Map<string, string>> {
  const r = await db().from('gwr_kode').select('merkmal, code, text');
  if (r.error) return new Map();
  return new Map((r.data as { merkmal: string; code: number; text: string }[]).map(k => [`${k.merkmal}:${k.code}`, k.text]));
}

// ---------------------------------------------------------------- Heizung
/**
 * Gruppen der Energiequelle. Eingeteilt wird nach dem amtlichen Text
 * aus der Codetabelle, nicht nach Codenummern -- die habe ich nicht in
 * der Hand gehabt, die Texte schon (Ablauf "Gebäude").
 */
export interface HeizGruppe { titel: string; farbe: string; fossil: boolean }
export const HEIZ_GRUPPEN: HeizGruppe[] = [
  { titel: 'Heizöl', farbe: '#E5B33B', fossil: true },
  { titel: 'Gas', farbe: '#8E6FD8', fossil: true },
  { titel: 'Wärmepumpe', farbe: '#3BB8A6', fossil: false },
  { titel: 'Fernwärme', farbe: '#E06A55', fossil: false },
  { titel: 'Holz', farbe: '#8A6A4B', fossil: false },
  { titel: 'Strom', farbe: '#6FA8DC', fossil: false },
  { titel: 'Andere', farbe: '#B9B9B9', fossil: false },
];
export function heizGruppe(text: string | null | undefined): HeizGruppe | null {
  if (!text) return null;
  const t = text.toLowerCase();
  const g = (titel: string) => HEIZ_GRUPPEN.find(x => x.titel === titel)!;
  if (/heizöl|heizoel|\böl\b/.test(t)) return g('Heizöl');
  if (/gas/.test(t)) return g('Gas');
  if (/fernwärme|fernwaerme/.test(t)) return g('Fernwärme');
  if (/luft|erdwärme|erdwaerme|erdsonde|wasser|wärmepumpe|waermepumpe/.test(t)) return g('Wärmepumpe');
  if (/holz|pellet|schnitzel/.test(t)) return g('Holz');
  if (/elektri|strom/.test(t)) return g('Strom');
  return g('Andere');
}

// ------------------------------------------------------------ Andere Farben
/** Baujahr: alt dunkelrot, neu hellblau -- je älter, desto eher Ersatzneubau. */
export const BAUJAHR_STUFEN: { bis: number; titel: string; farbe: string }[] = [
  { bis: 1919, titel: 'vor 1920', farbe: '#9E2A2B' },
  { bis: 1945, titel: '1920–1945', farbe: '#C8553D' },
  { bis: 1970, titel: '1946–1970', farbe: '#E8823C' },
  { bis: 1990, titel: '1971–1990', farbe: '#F2C14E' },
  { bis: 2010, titel: '1991–2010', farbe: '#9CCB80' },
  { bis: 9999, titel: 'ab 2011', farbe: '#6FA8DC' },
];
export const baujahrFarbe = (j: number | null) => (j ? BAUJAHR_STUFEN.find(s => j <= s.bis)!.farbe : null);

/** Höhe aus dem Modell des Bundes: flach hell, hoch dunkel. */
export const HOEHE_STUFEN: { bis: number; titel: string; farbe: string }[] = [
  { bis: 8, titel: 'bis 8 m', farbe: '#E8EEF7' },
  { bis: 14, titel: '8–14 m', farbe: '#BFD3EE' },
  { bis: 20, titel: '14–20 m', farbe: '#8DB2E2' },
  { bis: 30, titel: '20–30 m', farbe: '#5A8BD0' },
  { bis: 9999, titel: 'über 30 m', farbe: '#2F5DA8' },
];
export const hoeheFarbe = (h: number | null) => (h ? HOEHE_STUFEN.find(s => h <= s.bis)!.farbe : null);

/**
 * DACH_MIN und DACH_MAX (swissBUILDINGS3D) sind der tiefste und der
 * höchste Punkt aller Dächer eines Gebäudes, über Meer. Der tiefste kann
 * ein Anbau sein -- eine Dachform lässt sich daraus nicht ablesen, nur
 * die Spanne über dem Gelände.
 */
export function dachSpanne(dachMin: number | null, dachMax: number | null, gelaende: number | null): string {
  if (dachMin == null || dachMax == null || gelaende == null) return '–';
  const m = (x: number) => Math.round(x).toLocaleString('de-CH');
  const tief = dachMin - gelaende, hoch = dachMax - gelaende;
  return hoch - tief <= 1 ? `flach, ${m(hoch)} m` : `${m(tief)}–${m(hoch)} m`;
}

/**
 * Liegt der Punkt im Ring? (Strahl nach Osten, Kanten zählen.) Für die
 * Häuser markierter Parzellen: jede Kachel des Bundes trägt je Haus
 * Latitude und Longitude -- so färbt die Karte die Häuser eines Fonds
 * auch dann, wenn die Tabelle `gebaeude` die EGRID noch nicht kennt.
 */
export function punktImRing(lon: number, lat: number, ring: number[][]): boolean {
  let innen = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) innen = !innen;
  }
  return innen;
}

/** Die Mitte einer Parzelle in WGS84, über ihren Umriss beim Bund. */
export async function parzelleMitte(egrid: string): Promise<{ lat: number; lon: number } | null> {
  const g = await umrissVomBund(egrid, '2056').catch(() => null);
  if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return null;
  const ringe = (g.type === 'Polygon' ? g.coordinates : g.coordinates.flat()) as [number, number][][];
  const { e, n } = mitte(ringe);
  return lv95NachWgs84(e, n);
}
