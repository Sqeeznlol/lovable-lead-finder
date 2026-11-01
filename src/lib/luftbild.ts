/**
 * Luftbilder vom Bund (SWISSIMAGE) für Kopf und Karten -- statt der
 * Renderbilder der Vorlage echte Aufnahmen der Orte, um die es geht.
 *
 * Ein Ausschnitt als ein Bild (WMS) ist schärfer und braucht eine
 * Anfrage statt vieler Kacheln. Fällt der Dienst aus, nimmt die
 * Bildkomponente die Kachel (WMTS), die das Objektfenster schon zeigt.
 */
const WMS = 'https://wms.geo.admin.ch/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ch.swisstopo.swissimage&STYLES=&FORMAT=image/jpeg';

/** Ausschnitt in LV95 (Ost, Nord), Breite in Metern, Seitenverhältnis 16:9. */
export function luftbildLv95(ost: number, nord: number, breiteM: number, px = 1600): string {
  const h = (breiteM * 9) / 16;
  const bbox = [ost - breiteM / 2, nord - h / 2, ost + breiteM / 2, nord + h / 2].map(Math.round).join(',');
  return `${WMS}&CRS=EPSG:2056&BBOX=${bbox}&WIDTH=${px}&HEIGHT=${Math.round((px * 9) / 16)}`;
}

/** Ausschnitt um einen Punkt in WGS84; WMS 1.3.0 will Breite vor Länge. */
export function luftbildWgs(lat: number, lon: number, breiteM = 160, px = 640): string {
  const dLon = breiteM / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
  const dLat = (breiteM * 9) / 16 / 2 / 110540;
  const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map(x => x.toFixed(6)).join(',');
  return `${WMS}&CRS=EPSG:4326&BBOX=${bbox}&WIDTH=${px}&HEIGHT=${Math.round((px * 9) / 16)}`;
}

/** Zürich, Gleisfeld und Europaallee: der Kopf des Cockpits. */
export const KOPFBILD = luftbildLv95(2682700, 1247925, 800);
