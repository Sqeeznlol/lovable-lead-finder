/**
 * Die Kartenebenen als Daten, ohne Leaflet -- damit ein Test sie
 * prüfen kann, ohne einen Browser zu brauchen.
 *
 * Was hier festgehalten ist, hat einen Nachmittag gekostet: Über dem
 * Luftbild lag der Plan der amtlichen Vermessung als zweite Ebene. Der
 * Plan ist für Papier gemacht, weisse Flächen und schwarze Linien, und
 * deckte das Bild darunter vollständig zu. Man sah einen Plan und kein
 * Luftbild, und der Knopf hiess trotzdem "Luftbild".
 *
 * Deshalb die Regel, die der Test hält: eine Grundkarte ist genau EINE
 * deckende Ebene. Alles darüber ist durchsichtig und abschaltbar.
 */
export type Grund = 'karte' | 'luftbild';

export interface Ebene {
  art: 'wmts' | 'wms';
  id: string;
  /** Nur WMTS: Dateiendung der Kachel. */
  ext?: 'jpeg' | 'png';
  /** Nur WMTS: bis zu welchem Zoom es echte Kacheln gibt; darüber wird vergrössert. */
  maxNativeZoom?: number;
  /** Nur WMS: ab welchem Zoom die Ebene erscheint. */
  minZoom?: number;
  /** 0 bis 1. Alles unter 1 lässt die Grundkarte durchscheinen. */
  deckkraft?: number;
}

/** Die Grundkarten: Bundesdaten, gratis, ohne Schlüssel, schweizweit. */
export const GRUNDKARTEN: Record<Grund, Ebene> = {
  karte:    { art: 'wmts', id: 'ch.swisstopo.pixelkarte-farbe', ext: 'jpeg', maxNativeZoom: 19 },
  luftbild: { art: 'wmts', id: 'ch.swisstopo.swissimage',       ext: 'jpeg', maxNativeZoom: 20 },
};

/**
 * Parzellengrenzen, zuschaltbar auf jeder Grundkarte.
 *
 * Als WMS und nicht als WMTS-Kachel: die Kacheln des Katasters sind in
 * Web-Mercator umgerechnet und versetzen sich an den Rändern um einige
 * Pixel, Linien und Nummern brechen dort. Ein WMS-Bild wird für genau
 * den Ausschnitt gerechnet und passt. Unter Zoom 14 malt der Kataster
 * ganze Gemeinden grün, dort zeigt die Landeskarte mehr.
 *
 * Halb durchsichtig, damit das Luftbild unter den Linien sichtbar
 * bleibt. Ob 0.55 die richtige Stärke ist, muss man am echten Bild
 * sehen -- aus der Entwicklungsumgebung sind die Kacheln nicht
 * erreichbar.
 */
export const GRENZEN: Ebene = {
  art: 'wms', id: 'ch.kantone.cadastralwebmap-farbe', minZoom: 14, deckkraft: 0.55,
};

/** Bauzonen Schweiz (ARE), harmonisiert aus den Nutzungsplänen der Kantone. */
export const BAUZONEN: Ebene = {
  art: 'wms', id: 'ch.are.bauzonen', minZoom: 11, deckkraft: 0.55,
};

/** Ein Ausschnitt in Web-Mercator-Metern (EPSG:3857), wie Leaflet ihn rechnet. */
export interface Ausschnitt3857 { west: number; sued: number; ost: number; nord: number }

/**
 * Grösstes Bild je Seite, das wir vom Dienst verlangen.
 *
 * Gemessen am 1. November (Ablauf "Auswerten", Frage "kartendienst"):
 * Die Capabilities nennen 10000 je Seite. 4096x4096 kam als Bild mit
 * 4.2 MB; 8192x8192 nur mit 261 KB -- das ist kein Bild mehr, sondern
 * ein Fehler als PNG. Also 4096: scharf auf Retina bis 2048 Pixel
 * Breite, und kein Bild über fünf Megabyte.
 */
export const WMS_MAX = 4096;

/**
 * Die Ringe eines Polygons in der Form, die der Bundesdienst `identify`
 * als Geometrie erwartet (ESRI-JSON). GeoJSON und ESRI nennen die Ringe
 * gleich, nur die Hülle heisst anders; ein MultiPolygon wird flach.
 */
export function esriRinge(g: GeoJSON.Polygon | GeoJSON.MultiPolygon): number[][][] {
  return g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
}

/**
 * Die Adresse für ein einzelnes WMS-Bild über den ganzen Ausschnitt.
 *
 * Warum ein Bild und nicht Kacheln: Jede Kachel wird für sich
 * gezeichnet. Am Rand versetzen sich die Linien um einen Pixel,
 * Parzellennummern werden abgeschnitten, und bei einer halb
 * durchsichtigen Ebene überlappen die Kacheln um einen Pixel -- dort
 * ist die Farbe doppelt, und über die Karte laufen Striche. Ein Bild
 * hat keine Kanten.
 *
 * Rein und ohne Leaflet, damit der Test die Anfrage prüfen kann.
 */
export function wmsAdresse(e: Ebene, a: Ausschnitt3857, breite: number, hoehe: number): string {
  const p = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetMap',
    LAYERS: e.id, STYLES: '', SRS: 'EPSG:3857',
    BBOX: [a.west, a.sued, a.ost, a.nord].join(','),
    WIDTH: String(breite), HEIGHT: String(hoehe),
    FORMAT: 'image/png', TRANSPARENT: 'TRUE',
  });
  return `https://wms.geo.admin.ch/?${p.toString()}`;
}
