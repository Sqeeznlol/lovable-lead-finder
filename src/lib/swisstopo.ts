/**
 * Kostenlose Geodaten von swisstopo / geo.admin.ch.
 *
 * Beide Dienste sind ohne API-Key und ohne Kontingent nutzbar (Open Government
 * Data des Bundes) — im Gegensatz zur Google Static Maps / Street View API,
 * die pro Bild abgerechnet wird. Damit lässt sich zu jeder Adresse ein
 * aktuelles Luftbild zeigen, ohne dass Kosten entstehen.
 */

const SEARCH_URL = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';

export interface GeoCoords {
  /** WGS84 */
  lat: number;
  lon: number;
  label: string;
}

const CACHE_PREFIX = 'swisstopo.geocode.';

function readCache(key: string): GeoCoords | null | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    return JSON.parse(raw) as GeoCoords | null;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, value: GeoCoords | null) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* Speicher voll oder gesperrt — Cache ist nur eine Optimierung. */
  }
}

/** Adresse → Koordinaten. Ergebnis wird lokal gecacht, damit jede Adresse nur einmal abgefragt wird. */
export async function geocode(address: string, signal?: AbortSignal): Promise<GeoCoords | null> {
  const key = address.trim().toLowerCase();
  if (!key) return null;

  const cached = readCache(key);
  if (cached !== undefined) return cached;

  const url = `${SEARCH_URL}?searchText=${encodeURIComponent(address)}&type=locations&origins=address&limit=1&sr=4326`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`geo.admin.ch antwortete mit ${res.status}`);

  const json = await res.json();
  const hit = json?.results?.[0]?.attrs;
  const result: GeoCoords | null =
    hit && typeof hit.lat === 'number' && typeof hit.lon === 'number'
      ? { lat: hit.lat, lon: hit.lon, label: String(hit.label || '').replace(/<[^>]*>/g, '') }
      : null;

  writeCache(key, result);
  return result;
}

/** WGS84 → WebMercator-Kachelindex. */
function tileIndex(lat: number, lon: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

/** Luftbild-Kachel (SWISSIMAGE) für Koordinaten — direkt als <img src> nutzbar. */
export function luftbildTileUrl(lat: number, lon: number, zoom = 19): string {
  const { x, y } = tileIndex(lat, lon, zoom);
  return `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/${zoom}/${x}/${y}.jpeg`;
}

/** Interaktive swisstopo-Karte an der Adresse — für den «grösser anschauen»-Link. */
export function swisstopoMapUrl(lat: number, lon: number, zoom = 12): string {
  return `https://map.geo.admin.ch/?swisssearch=${lat},${lon}&zoom=${zoom}&bgLayer=ch.swisstopo.swissimage`;
}

/**
 * Bauzonen-Kachel (ch.are.bauzonen) für dieselbe Kachelposition wie das
 * Luftbild — als halbtransparente Ebene darüber gelegt zeigt sie, wo die
 * Zone endet.
 *
 * Das ist die schweizweite Bauzonenkarte des Bundes. Sie ist gröber als der
 * ÖREB-Kataster des Kantons und ersetzt ihn nicht: für die verbindliche
 * Auskunft führt der Link auf maps.zh.ch. Für die Frage "reicht die Bauzone
 * über die ganze Parzelle oder nur über die Hälfte" genügt sie -- und sie ist
 * frei und ohne Schlüssel abrufbar.
 */
export function bauzonenTileUrl(lat: number, lon: number, zoom = 19): string {
  const { x, y } = tileIndex(lat, lon, zoom);
  return `https://wmts.geo.admin.ch/1.0.0/ch.are.bauzonen/default/current/3857/${zoom}/${x}/${y}.png`;
}

/** ÖREB-Kataster des Kantons Zürich an dieser Stelle — die verbindliche Auskunft. */
export function oerebUrl(lat: number, lon: number): string {
  return `https://maps.zh.ch/?topic=OerebKatasterZH&x=${lon}&y=${lat}&scale=1120&srid=4326`;
}

/**
 * Strassenansicht bei Google.
 *
 * Als Bild einbetten liesse sich das nur über die Maps Embed API, die einen
 * Schlüssel verlangt (das Einbetten selbst ist kostenlos, der Schlüssel aber
 * zwingend). Ohne Schlüssel bleibt der Link, der die Ansicht im neuen Tab
 * öffnet. Steht VITE_GOOGLE_MAPS_KEY bereit, wird stattdessen eingebettet.
 */
export function streetViewLinkUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
}

export function streetViewEmbedUrl(lat: number, lon: number): string | null {
  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (!key) return null;
  return `https://www.google.com/maps/embed/v1/streetview?key=${key}&location=${lat},${lon}&heading=0&pitch=0&fov=90`;
}

/** Dreidimensionale Ansicht bei swisstopo -- Gelände und Gebäude, frei nutzbar. */
export function swisstopo3dUrl(lat: number, lon: number): string {
  return `https://map.geo.admin.ch/#/map?center=${lon},${lat}&z=17&3d=true&bgLayer=ch.swisstopo.swissimage`;
}
