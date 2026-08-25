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
