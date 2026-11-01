import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useParzellenImAusschnitt, type Ausschnitt, type ParzelleEigenschaften } from '@/hooks/use-karte';
import { Nachbarn } from '@/components/Nachbarn';
import { NachbarnBund } from '@/components/NachbarnBund';
import { supabase } from '@/integrations/supabase/client';
import { FENSTER } from '@/lib/fenster';
import { BAUZONEN, GRENZEN, GRUNDKARTEN, WMS_MAX, wmsAdresse, type Ebene, type Grund } from '@/lib/karte-ebenen';

/**
 * GIS-Parzellenkarte -- nach der Vorlage "gis-karte.html", mit dem
 * eigenen Bestand statt der Demo-Daten.
 *
 * Aufbau wie in der Vorlage: Kopfzeile mit Suche, Grundkarte und
 * Link ins Bundes-GIS; Karte links, Spalte rechts mit Auswahl,
 * Suchergebnissen, Bestand und Datenquellen; Koordinaten unten links.
 *
 * Was anders ist und warum: die Vorlage zeigt sechs erfundene
 * Portfolio-Pins in Zug. Hier liegen an ihrer Stelle die eigenen
 * Parzellenumrisse aus der Datenbank, und die Liste darunter zeigt den
 * Bestand im aktuellen Bildausschnitt, nach Marge sortiert. Ein Klick
 * auf einen eigenen Umriss zeigt die eigenen Angaben samt Eigentümer
 * und Nachbarn; ein Klick daneben fragt -- wie in der Vorlage -- die
 * offenen Bundesdienste ab.
 */

/** Rand um den Bildschirm, der mitgeladen wird. Klein gehalten: jeder
 *  Rand kostet Pixel, die innerhalb des Deckels fehlen -- und Schärfe
 *  zählt mehr als seltenes Nachladen. */
const RAND = 0.1;

/**
 * Ein WMS-Bild für den ganzen Ausschnitt statt Kacheln.
 *
 * Mit Kacheln liefen Striche über die Karte: an jeder Kachelkante
 * versetzen sich die Linien, Parzellennummern werden abgeschnitten,
 * und wo sich halb durchsichtige Kacheln um einen Pixel überlappen,
 * ist die Farbe doppelt. Ein Bild hat keine Kanten.
 *
 * Geladen wird mit Rand. Wer nur ein Stück verschiebt, bleibt im
 * geladenen Bild; erst darüber hinaus oder bei anderem Zoom wird neu
 * gerechnet. Bis das neue Bild da ist, bleibt das alte stehen -- ein
 * Flackern wäre schlimmer als ein kurzer Versatz.
 */
class EinBildWms extends L.Layer {
  private bild: L.ImageOverlay | null = null;
  private geladen: { grenzen: L.LatLngBounds; zoom: number } | null = null;
  private lauf = 0;

  constructor(private readonly ebene: Ebene) { super(); }

  onAdd(m: L.Map): this {
    m.on('moveend', this.nachsehen, this);
    this.nachsehen();
    return this;
  }

  onRemove(m: L.Map): this {
    m.off('moveend', this.nachsehen, this);
    this.bild?.remove(); this.bild = null; this.geladen = null;
    return this;
  }

  private nachsehen() {
    const m = this._map;
    if (!m) return;
    const zoom = m.getZoom();
    if (zoom < (this.ebene.minZoom ?? 0)) {
      this.bild?.remove(); this.bild = null; this.geladen = null;
      return;
    }
    const sicht = m.getBounds();
    if (this.geladen && this.geladen.zoom === zoom && this.geladen.grenzen.contains(sicht)) return;

    const grenzen = sicht.pad(RAND);
    const px = m.getSize().multiplyBy(1 + 2 * RAND);
    // Scharf auf Retina, aber nie über den Deckel des Dienstes.
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const faktor = Math.min(dpr, WMS_MAX / Math.max(px.x, px.y));
    const sw = L.CRS.EPSG3857.project(grenzen.getSouthWest());
    const ne = L.CRS.EPSG3857.project(grenzen.getNorthEast());
    const url = wmsAdresse(this.ebene, { west: sw.x, sued: sw.y, ost: ne.x, nord: ne.y },
      Math.round(px.x * faktor), Math.round(px.y * faktor));

    // Erst zeigen, wenn es da ist -- und nur, wenn inzwischen nichts
    // Neueres verlangt wurde.
    const lauf = ++this.lauf;
    const img = new Image();
    img.onload = () => {
      if (lauf !== this.lauf || !this._map) return;
      const neu = L.imageOverlay(url, grenzen, {
        opacity: this.ebene.deckkraft ?? 1, interactive: false, pane: 'wms',
      }).addTo(this._map);
      this.bild?.remove();
      this.bild = neu;
      this.geladen = { grenzen, zoom };
    };
    img.src = url;
  }
}

/** Eine Ebenenbeschreibung aus karte-ebenen.ts als Leaflet-Ebene. */
function ebene(e: Ebene): L.Layer {
  if (e.art === 'wmts') {
    return L.tileLayer(`https://wmts.geo.admin.ch/1.0.0/${e.id}/default/current/3857/{z}/{x}/{y}.${e.ext}`, {
      maxZoom: 21, maxNativeZoom: e.maxNativeZoom, crossOrigin: true,
      attribution: '&copy; swisstopo und Kantone',
    });
  }
  return new EinBildWms(e);
}

/** Erst ab hier werden eigene Umrisse geholt -- darunter sind sie Pixel. */
const AB_ZOOM = 15;

// Die Karte zeigt den ganzen Bestand, nicht einen Kanton: sie startet
// deshalb über der ganzen Schweiz und hängt nicht an der Kantonswahl.
const SCHWEIZ: [number, number] = [46.82, 8.23];

/** WGS84 nach LV95, Näherungsformeln swisstopo (aus der Vorlage). */
function toLV95(lat: number, lon: number) {
  const p = (lat * 3600 - 169028.66) / 10000, l = (lon * 3600 - 26782.5) / 10000;
  const E = 2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p * p - 44.54 * l ** 3;
  const N = 1200147.07 + 308807.95 * p + 3745.25 * l * l + 76.63 * p * p - 194.56 * l * l * p + 119.79 * p ** 3;
  return { E: Math.round(E), N: Math.round(N) };
}
/** LV95 nach WGS84, für Treffer des Suchdienstes (aus der Vorlage). */
function fromLV95(E: number, N: number): [number, number] {
  const y = (E - 2600000) / 1000000, x = (N - 1200000) / 1000000;
  const lat = (16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x
    - 0.0447 * y * y * x - 0.0140 * x * x * x) * 100 / 36;
  const lon = (2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x
    - 0.0436 * y * y * y) * 100 / 36;
  return [lat, lon];
}
const gr = (n: number | null | undefined) =>
  n == null ? '' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
function geoadminLink(lat: number, lon: number, z = 11) {
  const c = toLV95(lat, lon);
  return `https://map.geo.admin.ch/?lang=de&E=${c.E}&N=${c.N}&zoom=${z}`
    + '&bgLayer=ch.swisstopo.pixelkarte-farbe&layers=ch.kantone.cadastralwebmap-farbe';
}

function Kopieren({ wert, text }: { wert: string; text?: string }) {
  const [fertig, setFertig] = useState(false);
  return (
    <button
      type="button"
      className={`copy${fertig ? ' done' : ''}`}
      onClick={() => {
        navigator.clipboard?.writeText(wert).then(() => {
          setFertig(true); setTimeout(() => setFertig(false), 1400);
        });
      }}
    >{text ?? wert}</button>
  );
}

/** Spaltennamen als Schweizer Beschriftung: mit ä, ö, ü, ohne ß. */
const BESCHRIFTUNG: Record<string, string> = {
  address: 'Adresse', area: 'Fläche (m²)', plot_number: 'Parzellennummer', parzelle: 'Parzelle',
  egrid: 'EGRID', gwr_egid: 'EGID', zone: 'Zone', kanton: 'Kanton', gemeinde: 'Gemeinde', bezirk: 'Bezirk',
  bezirksort: 'Bezirksort', bfs_nr: 'BFS-Nr.', plz: 'PLZ', plz_ort: 'PLZ, Ort', ortschaftsname: 'Ortschaft',
  strassenname: 'Strasse', hausnummer: 'Hausnummer', objektadresse: 'Objektadresse',
  owner_name: 'Eigentümer', owner_name_2: 'Eigentümer 2', owner_address: 'Adresse Eigentümer',
  owner_address_2: 'Adresse Eigentümer 2', owner_phone: 'Telefon', owner_phone_2: 'Telefon 2',
  owners_json: 'Alle Eigentümer', eigentuemer_name: 'Eigentümer (Auskunft)', eigentuemer_adresse: 'Adresse Eigentümer (Auskunft)',
  eigentuemer_plz_ort: 'PLZ, Ort Eigentümer', eigentuemer_fetched_at: 'Eigentümer abgefragt am',
  ausnuetzung: 'Ausnützung', baujahr: 'Baujahr', renovationsjahr: 'Renovationsjahr', geschosse: 'Geschosse',
  vollgeschosse: 'Vollgeschosse', vollgeschosse_zulaessig: 'Vollgeschosse zulässig', anrechenbare_geschosse: 'Anrechenbare Geschosse',
  gebaeudeflaeche: 'Gebäudefläche (m²)', gebaeudeart: 'Gebäudeart', gebaeude_anzahl: 'Anzahl Gebäude', geb_status: 'Gebäudestatus',
  wohnflaeche: 'Wohnfläche (m²)', nutzflaeche: 'Nutzfläche (m²)', wohnungen: 'Wohnungen',
  gf_bestand: 'Geschossfläche heute', gf_zulaessig: 'Geschossfläche zulässig', reserve_gf: 'Reserve Geschossfläche',
  reserve_quote: 'Reserve in %', bebaubar_m2: 'Bebaubar (m²)', hnf_bestand: 'HNF heute', hnf_neu: 'HNF neu',
  hnf_delta: 'HNF Zuwachs', hnf_faktor: 'HNF-Faktor', hnf_schaetzung: 'HNF-Schätzung',
  erloes_chf: 'Erlös (CHF)', investition_chf: 'Investition (CHF)', marge_chf: 'Marge (CHF)', marge_quote: 'Marge in %',
  potenzial_score: 'Potenzial', deal_score: 'Deal-Bewertung', score_tier: 'Stufe', score_reasons: 'Gründe',
  score_killers: 'Ausschlussgründe', ai_score: 'KI-Bewertung', ai_summary: 'KI-Zusammenfassung',
  ai_recommendation: 'KI-Empfehlung', ai_priority: 'KI-Priorität', ausgeschlossen: 'Ausgeschlossen',
  ausschluss_grund: 'Ausschlussgrund', denkmalschutz: 'Denkmalschutz', denkmalschutz_titel: 'Denkmalschutz, Titel',
  isos: 'ISOS', isos_titel: 'ISOS, Titel', az_quelle: 'Quelle Ausnützung', kategorie: 'Kategorie', status: 'Status',
  acquisition_status: 'Akquise-Status', notes: 'Notizen', created_at: 'Erfasst am', updated_at: 'Geändert am',
  gis_url: 'GIS-Link', google_maps_url: 'Google Maps', streetview_url: 'Street View', housing_stat_url: 'Gebäuderegister-Link',
  pipedrive_deal_id: 'Pipedrive-Deal', contact_attempts: 'Kontaktversuche', last_contact_at: 'Letzter Kontakt',
  follow_up_at: 'Nachfassen am', data_quality: 'Datenqualität', source_file: 'Quelldatei', imported_at: 'Importiert am',
};
function beschriften(k: string) {
  if (BESCHRIFTUNG[k]) return BESCHRIFTUNG[k];
  // Unbekannte Spalten: Umlaute zurück, ausser in Wörtern wie "Quelle" oder "neue".
  const t = k.replace(/_/g, ' ').replace(/(?<![qQ]|ne|tu)ue/g, 'ü').replace(/ae/g, 'ä').replace(/oe/g, 'ö');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Alle gefüllten Spalten der Parzelle; leere und Umrisse bleiben weg. */
function AlleFelder({ z }: { z: Record<string, unknown> }) {
  const zeilen = Object.entries(z).filter(([k, v]) =>
    v !== null && v !== '' && !/geom|umriss|^id$/i.test(k)
    && !(Array.isArray(v) && v.length === 0));
  return (
    <details className="alle">
      <summary>Alle Angaben ({zeilen.length})</summary>
      <dl className="f">
        {zeilen.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{beschriften(k)}</dt>
            <dd>{wertZeigen(v)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

const STUFEN: [number, string, string][] = [
  [1_000_000, '#15803D', 'über 1 Mio.'], [500_000, '#65A30D', '0,5–1 Mio.'],
  [100_000, '#CA8A04', '0,1–0,5 Mio.'], [1, '#EA580C', 'bis 0,1 Mio.'], [-Infinity, '#1E3A8A', 'ohne Marge'],
];
function margeFarbe(m: number) { return (STUFEN.find(([ab]) => m >= ab) ?? STUFEN[4])[1]; }

/** Zonenart aus dem kantonalen Zonennamen -- die Kantone schreiben
 *  "W2", "Wohnzone W3" oder "Kernzone 2"; gefiltert wird nach Art. */
type Zonenart = 'W' | 'WG' | 'K' | 'Z' | 'IG' | 'U';
const ZONENARTEN: [Zonenart, string][] = [
  ['W', 'Wohnen'], ['WG', 'Wohnen/Gewerbe'], ['K', 'Kern'], ['Z', 'Zentrum'], ['IG', 'Industrie/Gewerbe'], ['U', 'Übrige'],
];
/** Ob eine Parzelle durch den Filter kommt: erst die genaue Zone, sonst die Art. */
function passtZone(zone: string | null | undefined, arten: Set<Zonenart>, genau: Set<string>): boolean {
  if (genau.size > 0) return genau.has(String(zone ?? '').trim());
  return arten.size === 0 || arten.has(zonenart(zone));
}
function zonenart(z: string | null | undefined): Zonenart {
  const t = String(z ?? '');
  if (/wohn.*gewerb|misch|\bWG\s?\d/i.test(t)) return 'WG';
  if (/wohn|\bW\s?\d/i.test(t)) return 'W';
  if (/kern|\bK\s?\d/i.test(t)) return 'K';
  if (/zentrum|\bZ\s?\d/i.test(t)) return 'Z';
  if (/industr|gewerb|arbeit|\bI\s?\d|\bG\s?\d/i.test(t)) return 'IG';
  return 'U';
}

/** Werte lesbar: Datum als Tag.Monat.Jahr, Ja/Nein, Zahlen mit Hochkomma, Links als Link. */
function wertZeigen(v: unknown) {
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nein';
  if (typeof v === 'number') return gr(v);
  const t = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/^https?:\/\//.test(t)) return <a href={t} target={FENSTER.portal}>öffnen ↗</a>;
  const d = /^(\d{4})-(\d{2})-(\d{2})T/.exec(t);
  if (d) return `${d[3]}.${d[2]}.${d[1]}`;
  if (/^-?\d+(\.\d+)?$/.test(t)) return gr(Number(t));
  return t;
}

/** Ein Umriss vom Bund, in LV95 -- so, wie identify ihn liefert. */
type Umriss = GeoJSON.Polygon | GeoJSON.MultiPolygon;

type Auswahl =
  | { art: 'leer' }
  | { art: 'eigen'; id: string; e: ParzelleEigenschaften; lat: number; lon: number;
      eigentuemer?: string | null; geholt: boolean; zeile?: Record<string, unknown> | null;
      umriss?: Umriss | null; egrid?: string | null }
  | { art: 'bund'; lat: number; lon: number; laeuft: boolean; fehler?: boolean;
      treffer: { titel: string; adresse: string; info: string; egid?: string }[];
      umriss?: Umriss | null; egrid?: string | null };

interface Treffer { label: string; origin: string; lat: number; lon: number; eigen?: { id: string; e: ParzelleEigenschaften } }

export function Karte({ onSchliessen }: { onSchliessen?: () => void }) {
  const box = useRef<HTMLDivElement | null>(null);
  const karte = useRef<L.Map | null>(null);
  const grundLagen = useRef<L.Layer[]>([]);
  const eigenEbene = useRef<L.GeoJSON | null>(null);
  // Die angeklickte Parzelle als eigener, kräftiger Umriss -- man soll
  // sehen, welche gemeint ist, auch wenn sie nicht zum Bestand gehört.
  const markiert = useRef<L.GeoJSON | null>(null);
  function markieren(g: GeoJSON.GeoJsonObject | null) {
    markiert.current?.remove(); markiert.current = null;
    if (!g || !karte.current) return;
    markiert.current = L.geoJSON(g, {
      interactive: false,
      style: { color: '#DC2626', weight: 4, fillColor: '#DC2626', fillOpacity: 0.15 },
    }).addTo(karte.current);
  }

  const [grund, setGrund] = useState<Grund>('karte');
  const [grenzenAn, setGrenzenAn] = useState(true);
  const grenzenEbene = useRef<L.Layer | null>(null);
  const [zonenAn, setZonenAn] = useState(false);
  const [zonenFilter, setZonenFilter] = useState<Set<Zonenart>>(new Set());
  // Die genaue Zone -- W2, W3, Kernzone 2 -- so, wie der Kanton sie schreibt.
  const [zonenGenau, setZonenGenau] = useState<Set<string>>(new Set());
  const zonenEbene = useRef<L.Layer | null>(null);
  // Bauzonen Schweiz (ARE, harmonisiert aus den Nutzungsplänen der
  // Kantone -- dieselbe Grundlage wie der ÖREB-Kataster).
  useEffect(() => {
    const m = karte.current;
    if (!m) return;
    zonenEbene.current?.remove(); zonenEbene.current = null;
    if (zonenAn) {
      zonenEbene.current = ebene(BAUZONEN).addTo(m);
    }
  }, [zonenAn]);
  const [ausschnitt, setAusschnitt] = useState<Ausschnitt | null>(null);
  const [zoom, setZoom] = useState(0);
  const [mitte, setMitte] = useState<{ lat: number; lng: number }>({ lat: 0, lng: 0 });
  const [auswahl, setAuswahl] = useState<Auswahl>({ art: 'leer' });
  const [suche, setSuche] = useState('');
  const [treffer, setTreffer] = useState<Treffer[] | null>(null);
  const [sucheStatus, setSucheStatus] = useState<'ruhe' | 'laeuft' | 'fehler'>('ruhe');

  const genugNah = zoom >= AB_ZOOM;
  const { data } = useParzellenImAusschnitt(ausschnitt, genugNah);

  // Schriften der Vorlage, einmal geladen.
  useEffect(() => {
    if (document.getElementById('gisk-fonts')) return;
    const l = document.createElement('link');
    l.id = 'gisk-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap';
    document.head.appendChild(l);
  }, []);

  // ------------------------------------------------------------ Karte
  useEffect(() => {
    if (!box.current || karte.current) return;
    const m = L.map(box.current, {
      center: SCHWEIZ, zoom: 8, maxZoom: 21,
      zoomControl: false, preferCanvas: true,
    });
    // Unten rechts, wie bei Google Maps: oben links stehen die Zonen.
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(m);
    // Grenzen und Bauzonen liegen in einer eigenen Schicht zwischen der
    // Grundkarte (200) und den eigenen Umrissen (400): so bleibt der
    // Bestand immer oben, egal in welcher Reihenfolge geschaltet wird.
    m.createPane('wms').style.zIndex = '350';
    const merken = () => {
      const b = m.getBounds();
      setZoom(m.getZoom());
      setMitte(m.getCenter());
      setAusschnitt({ west: b.getWest(), sued: b.getSouth(), ost: b.getEast(), nord: b.getNorth() });
    };
    m.on('moveend', merken);
    m.on('move zoom', () => { setMitte(m.getCenter()); setZoom(m.getZoom()); });
    // Klick daneben: die offenen Bundesdienste fragen, wie in der Vorlage.
    m.on('click', (ev: L.LeafletMouseEvent) => bundAbfragen(ev.latlng.lat, ev.latlng.lng));
    merken();
    karte.current = m;
    return () => { m.remove(); karte.current = null; };
  }, []);

  useEffect(() => {
    const m = karte.current;
    if (!m) return;
    grundLagen.current.forEach(l => m.removeLayer(l));
    grundLagen.current = [ebene(GRUNDKARTEN[grund])];
    grundLagen.current.forEach(l => l.addTo(m));
  }, [grund]);

  // Die Grenzen stehen hinter dem Karten-Effekt: beim ersten Durchlauf
  // gibt es die Karte sonst noch nicht, und ein Effekt, der dann abbricht,
  // läuft erst beim nächsten Umschalten wieder.
  useEffect(() => {
    const m = karte.current;
    if (!m) return;
    grenzenEbene.current?.remove(); grenzenEbene.current = null;
    if (grenzenAn) {
      grenzenEbene.current = ebene(GRENZEN).addTo(m);
    }
  }, [grenzenAn]);


  // ---------------------------------------------- eigene Umrisse
  useEffect(() => {
    const m = karte.current;
    if (!m) return;
    eigenEbene.current?.remove();
    eigenEbene.current = null;
    if (!data || !genugNah) return;
    eigenEbene.current = L.geoJSON(data, {
      filter: f => passtZone((f.properties as ParzelleEigenschaften)?.zone, zonenFilter, zonenGenau),
      // Farbe nach Marge in Stufen, wie bei Regrid/LandGlide: man sieht
      // die guten Parzellen, bevor man klickt. Legende unten links.
      style: f => {
        const e = (f?.properties ?? {}) as ParzelleEigenschaften;
        if (e.ausgeschlossen) return { color: '#64748B', weight: 1, fillOpacity: 0.04 };
        const c = margeFarbe(Number(e.marge) || 0);
        // Auf dem Luftbild muss die Linie gegen Dächer und Schatten
        // bestehen: dicker, und die Füllung zurückhaltender.
        return grund === 'luftbild'
          ? { color: c, weight: 3, fillColor: c, fillOpacity: 0.22 }
          : { color: c, weight: 2, fillColor: c, fillOpacity: 0.32 };
      },
      onEachFeature: (f, schicht) => {
        const e = (f.properties ?? {}) as ParzelleEigenschaften;
        // Beim Überfahren schon das Wichtigste, ohne zu klicken.
        schicht.bindTooltip(
          `<b>${e.parzelle ? 'Parzelle ' + e.parzelle : 'Parzelle'}</b>`
          + (e.adresse ? `<br>${String(e.adresse)}` : '')
          + (e.zone ? `<br>${String(e.zone)}` : '')
          + (Number(e.marge) > 0 ? `<br>Marge ${gr(Number(e.marge))} CHF` : ''),
          { sticky: true, direction: 'top', className: 'gisk-tip' });
        schicht.on('mouseover', () => (schicht as L.Path).setStyle({ weight: 4, fillOpacity: 0.5 }));
        schicht.on('mouseout', () => eigenEbene.current?.resetStyle(schicht as L.Path));
        schicht.on('click', (ev: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(ev);
          markieren(f as GeoJSON.Feature);
          eigeneZeigen(String(f.id), f.properties as ParzelleEigenschaften,
            ev.latlng.lat, ev.latlng.lng);
        });
      },
    }).addTo(m);
  }, [data, genugNah, zonenFilter, zonenGenau, grund]);

  async function eigeneZeigen(id: string, e: ParzelleEigenschaften, lat: number, lon: number) {
    setAuswahl({ art: 'eigen', id, e, lat, lon, geholt: false });
    // Der Eigentümer steht in properties und wird erst hier geholt;
    // die Kartenfunktion selbst trägt keine Personendaten.
    // Alle Spalten: wer anklickt, will sehen, was wir wissen -- nicht
    // eine Auswahl davon.
    const { data: p } = await supabase.from('properties')
      .select('*').eq('id', id).maybeSingle();
    const z = p as Record<string, unknown> | null;
    setAuswahl(a => (a.art === 'eigen' && a.id === id
      ? { ...a, eigentuemer: (z?.owner_name as string) ?? null, zeile: z, geholt: true } : a));
  }

  async function bundAbfragen(lat: number, lon: number) {
    const lv = toLV95(lat, lon);
    setAuswahl({ art: 'bund', lat, lon, laeuft: true, treffer: [] });
    // Umriss und EGRID vom Bund bleiben erhalten: daran hängen die
    // Nachbarn dort, wo der Kanton noch nicht eingelesen ist.
    let umriss: Umriss | null = null;
    let egridBund: string | null = null;
    // Erst fragen, welche Parzelle hier liegt, und sie per EGRID im
    // eigenen Bestand suchen -- auch dort, wo noch kein Umriss geladen ist.
    try {
      const k = 'https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometryType=esriGeometryPoint'
        + `&geometry=${lv.E},${lv.N}&sr=2056&tolerance=0&returnGeometry=true&geometryFormat=geojson`
        + '&layers=all:ch.kantone.cadastralwebmap-farbe'
        + `&mapExtent=${lv.E - 300},${lv.N - 300},${lv.E + 300},${lv.N + 300}&imageDisplay=600,600,96&lang=de`;
      const kj = await (await fetch(k)).json();
      // Antwort in LV95: für Leaflet nach WGS84 umrechnen.
      const erster = kj?.results?.[0];
      markieren(null);
      if (erster?.geometry) {
        umriss = erster.geometry as Umriss;
        const um = (c: unknown): unknown => Array.isArray(c) && typeof c[0] === 'number'
          ? (([la, lo]) => [lo, la])(fromLV95(c[0] as number, c[1] as number)) : (c as unknown[]).map(um);
        markieren({ type: 'Feature', properties: {},
          geometry: { ...erster.geometry, coordinates: um(erster.geometry.coordinates) } } as GeoJSON.Feature);
      }
      // Gemessen am 1. November: die EGRID steht in `egris_egrid`.
      // Gesucht wird trotzdem nach der Form -- ändert der Dienst den
      // Namen, fällt es so nicht still aus.
      const egrid = (kj?.results ?? []).flatMap((x: { attributes?: Record<string, unknown>; properties?: Record<string, unknown> }) =>
        Object.values({ ...x.attributes, ...x.properties })).map(String).find((v: string) => /^CH[0-9A-Z]{12}$/.test(v));
      egridBund = egrid ?? null;
      if (egrid) {
        const { data: p } = await supabase.from('properties').select('*').eq('egrid', egrid).maybeSingle();
        const z = p as Record<string, unknown> | null;
        if (z) {
          setAuswahl({
            art: 'eigen', id: String(z.id), lat, lon, geholt: true, zeile: z,
            umriss, egrid,
            eigentuemer: (z.owner_name as string) ?? null,
            e: eigenschaftenAus(z),
          });
          return;
        }
      }
    } catch { /* weiter mit dem Bundesregister */ }
    const ebenen = 'ch.are.bauzonen,ch.bfs.gebaeude_wohnungs_register,ch.swisstopo.amtliches-strassenverzeichnis';
    const url = 'https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometryType=esriGeometryPoint'
      + `&geometry=${lv.E},${lv.N}&sr=2056&tolerance=12&layers=all:${ebenen}`
      + `&mapExtent=${lv.E - 300},${lv.N - 300},${lv.E + 300},${lv.N + 300}&imageDisplay=600,600,96&lang=de`;
    try {
      const j = await (await fetch(url)).json();
      const res = (j?.results ?? []).slice(0, 4);
      setAuswahl({
        art: 'bund', lat, lon, laeuft: false, umriss, egrid: egridBund,
        treffer: res.map((r: { layerName?: string; layerBodId?: string; attributes?: Record<string, string> }) => {
          const a = r.attributes ?? {};
          const adresse = [a.strname_deinr || a.strname1 || '', a.plz_plz6 || a.dplz4 || '', a.ggdename || '']
            .filter(Boolean).join(', ');
          const info = a.gbauj
            ? `Baujahr ${a.gbauj}${a.gastw ? `, ${a.gastw} Geschosse` : ''}${a.gebnutzbez ? `, ${a.gebnutzbez}` : ''}`
            : '';
          return { titel: r.layerName || r.layerBodId || 'Treffer', adresse, info, egid: a.egid };
        }),
      });
    } catch {
      setAuswahl({ art: 'bund', lat, lon, laeuft: false, fehler: true, treffer: [], umriss, egrid: egridBund });
    }
  }

  /** Die Kopfangaben einer Zeile des Bestands, wie die Kartenfunktion sie liefern würde. */
  function eigenschaftenAus(z: Record<string, unknown>): ParzelleEigenschaften {
    return { parzelle: z.plot_number, adresse: z.address, gemeinde: z.gemeinde ?? z.municipality,
             zone: z.zone, flaeche: z.area, marge: z.marge_chf ?? z.marge,
             ausgeschlossen: z.ausgeschlossen } as unknown as ParzelleEigenschaften;
  }

  // Eine Parzelle des Bestands per Kennung öffnen -- aus der Nachbarliste.
  async function oeffnePerId(id: string) {
    const { data: p } = await supabase.from('properties').select('*').eq('id', id).maybeSingle();
    const z = p as Record<string, unknown> | null;
    if (!z) return;
    markieren(null);
    setAuswahl({
      art: 'eigen', id, lat: mitte.lat, lon: mitte.lng, geholt: true, zeile: z,
      eigentuemer: (z.owner_name as string) ?? null, e: eigenschaftenAus(z),
    });
  }

  // ------------------------------------------------------------ Suche
  useEffect(() => {
    const s = suche.trim();
    if (s.length < 3) { setTreffer(null); setSucheStatus('ruhe'); return; }
    const t = setTimeout(async () => {
      setSucheStatus('laeuft');
      // Zuerst im eigenen Bestand: Adresse, Parzellennummer oder EGRID.
      // Die Bundessuche kennt unsere Parzellen nicht.
      const muster = `%${s.replace(/[%_,()]/g, ' ')}%`;
      const eigen = supabase.from('properties')
        .select('id, address, plot_number, gemeinde, zone, area, marge_chf, ausgeschlossen, egrid')
        .or(`address.ilike.${muster},plot_number.ilike.${muster},egrid.ilike.${muster}`)
        .limit(6);
      try {
        const [j, eig] = await Promise.all([
          fetch('https://api3.geo.admin.ch/rest/services/ech/SearchServer?type=locations&limit=6&sr=2056&lang=de&searchText='
            + encodeURIComponent(s)).then(x => x.json()).catch(() => null),
          eigen,
        ]);
        const eigeneTreffer: Treffer[] = ((eig.data ?? []) as Record<string, unknown>[]).map(z => ({
          label: String(z.address ?? `Parzelle ${z.plot_number ?? ''}`),
          origin: ['Bestand', z.gemeinde, z.plot_number ? `Parz. ${z.plot_number}` : null].filter(Boolean).join(' · '),
          lat: NaN, lon: NaN,
          eigen: { id: String(z.id), e: {
            adresse: (z.address as string) ?? null, parzelle: (z.plot_number as string) ?? null,
            gemeinde: (z.gemeinde as string) ?? null, flaeche: (z.area as number) ?? null, zone: (z.zone as string) ?? null,
            marge: (z.marge_chf as number) ?? null, ausgeschlossen: (z.ausgeschlossen as boolean) ?? null } },
        }));
        const rs = (j?.results ?? []) as { attrs?: Record<string, unknown> }[];
        setTreffer([...eigeneTreffer, ...rs.map(r => {
          const a = r.attrs ?? {};
          let lat = Number(a.lat), lon = Number(a.lon);
          // Mit sr=2056 kommt LV95 zurück -- zurückrechnen.
          if (lat > 90 || lon > 90) [lat, lon] = fromLV95(Number(a.y ?? a.lon), Number(a.x ?? a.lat));
          return {
            label: String(a.label ?? '').replace(/<[^>]+>/g, ''),
            origin: String(a.origin ?? ''), lat, lon,
          };
        })]);
        setSucheStatus('ruhe');
      } catch { setSucheStatus('fehler'); }
    }, 350);
    return () => clearTimeout(t);
  }, [suche]);

  // ---------------------------------------------- Bestand im Bild
  const bestand = useMemo(() => {
    if (!data) return [];
    return [...data.features]
      .filter(f => !f.properties?.ausgeschlossen)
      .filter(f => passtZone(f.properties?.zone, zonenFilter, zonenGenau))
      .sort((a, b) => (Number(b.properties?.marge) || 0) - (Number(a.properties?.marge) || 0))
      .slice(0, 15);
  }, [data, zonenFilter, zonenGenau]);

  // Die genauen Zonen der gewählten Arten, wie sie im Bild vorkommen.
  // Nur dann: ohne gewählte Art wären es dreissig Chips, und das hilft
  // niemandem. Sortiert so, dass W2 vor W10 steht.
  const zonenImBild = useMemo(() => {
    if (!data || zonenFilter.size === 0) return [] as string[];
    const menge = new Set<string>();
    for (const f of data.features) {
      const z = String(f.properties?.zone ?? '').trim();
      if (z && zonenFilter.has(zonenart(z))) menge.add(z);
    }
    return [...menge].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  }, [data, zonenFilter]);

  function mitteVon(f: GeoJSON.Feature): [number, number] {
    const b = L.geoJSON(f).getBounds().getCenter();
    return [b.lat, b.lng];
  }

  const lvMitte = toLV95(mitte.lat, mitte.lng);

  // Eigene Treffer haben keine Koordinaten in der Tabelle: die Adresse
  // wird über die Bundessuche verortet, dann die Parzelle geöffnet.
  async function trefferOeffnen(t: Treffer) {
    setTreffer(null); setSuche('');
    if (!t.eigen) { karte.current?.setView([t.lat, t.lon], 18); return; }
    let lat = NaN, lon = NaN;
    try {
      const q = [t.eigen.e.adresse, t.eigen.e.gemeinde].filter(Boolean).join(' ');
      const j = await (await fetch('https://api3.geo.admin.ch/rest/services/ech/SearchServer?type=locations&limit=1&lang=de&searchText='
        + encodeURIComponent(q))).json();
      const a = j?.results?.[0]?.attrs;
      if (a) { lat = Number(a.lat); lon = Number(a.lon); }
    } catch { /* ohne Ort: Angaben trotzdem zeigen */ }
    if (Number.isFinite(lat)) karte.current?.setView([lat, lon], 19);
    eigeneZeigen(t.eigen.id, t.eigen.e, Number.isFinite(lat) ? lat : mitte.lat, Number.isFinite(lon) ? lon : mitte.lng);
  }

  const umschalten = (z: Zonenart) => {
    setZonenGenau(new Set());
    setZonenFilter(alt => {
      const neu = new Set(alt);
      if (neu.has(z)) neu.delete(z); else neu.add(z);
      return neu;
    });
  };
  const genauUmschalten = (z: string) => setZonenGenau(alt => {
    const neu = new Set(alt);
    if (neu.has(z)) neu.delete(z); else neu.add(z);
    return neu;
  });

  return (
    <div className={`gisk${auswahl.art !== 'leer' ? ' offen' : ''}`}>
      <style>{STIL}</style>

      <div ref={box} className="map" />

      {/* Obere Leiste: eine Zeile, schwebend über der Karte. */}
      <header className="leiste">
        {onSchliessen && (
          <button type="button" className="rund" onClick={onSchliessen} title="Zurück zu Aurora">←</button>
        )}
        <div className="suche">
          <span className="lupe">⌕</span>
          <input type="search" value={suche} onChange={e => setSuche(e.target.value)}
                 placeholder="Adresse, Ort oder Parzelle" autoComplete="off" />
          {(treffer !== null || sucheStatus !== 'ruhe') && suche.trim().length >= 3 && (
            <div className="liste">
              {sucheStatus === 'laeuft' && <p className="leer">Suche läuft …</p>}
              {sucheStatus === 'fehler' && <p className="leer">Suchdienst nicht erreichbar.</p>}
              {sucheStatus === 'ruhe' && treffer?.length === 0 && <p className="leer">Kein Treffer.</p>}
              {sucheStatus === 'ruhe' && treffer?.map((t, i) => (
                <button type="button" key={i} className={`treffer${t.eigen ? ' eigen' : ''}`} onClick={() => trefferOeffnen(t)}>
                  <b>{t.label}</b><small>{t.eigen ? t.origin : 'Ort · swisstopo'}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="werkzeuge">
          <div className="segment">
            {([['karte', 'Karte'], ['luftbild', 'Luftbild']] as [Grund, string][]).map(([g, t]) => (
              <button type="button" key={g} className={grund === g ? 'an' : ''} onClick={() => setGrund(g)}>{t}</button>
            ))}
          </div>
          <button type="button" className={`schalter${grenzenAn ? ' an' : ''}`} onClick={() => setGrenzenAn(v => !v)}>
            Grenzen
          </button>
          <button type="button" className={`schalter${zonenAn ? ' an' : ''}`} onClick={() => setZonenAn(v => !v)}>
            Bauzonen
          </button>
        </div>
      </header>

      {/* Zonenfilter wie bei Immobilienportalen: Chips, mehrere wählbar. */}
      <div className="filter">
        <span className="titel">Zone</span>
        <button type="button" className={zonenFilter.size === 0 ? 'an' : ''} onClick={() => { setZonenFilter(new Set()); setZonenGenau(new Set()); }}>Alle</button>
        {ZONENARTEN.map(([z, t]) => (
          <button type="button" key={z} className={zonenFilter.has(z) ? 'an' : ''} onClick={() => umschalten(z)}>{t}</button>
        ))}
      </div>
      {zonenImBild.length > 0 && (
        <div className="filter genau">
          {zonenImBild.map(z => (
            <button type="button" key={z} className={zonenGenau.has(z) ? 'an' : ''} onClick={() => genauUmschalten(z)}>{z}</button>
          ))}
        </div>
      )}

      <div className="unten">
        {genugNah && (
          <div className="legende">
            {STUFEN.map(([, c, t]) => <span key={t}><i style={{ background: c }} />{t}</span>)}
          </div>
        )}
        {zonenAn && (
          <div className="legende bild">
            <img src="https://api3.geo.admin.ch/static/images/legends/ch.are.bauzonen_de.png" alt="Legende Bauzonen"
                 onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
          </div>
        )}
        <div className="readout">
          {!genugNah ? 'Näher heranzoomen für den Bestand · ' : ''}
          {genugNah && data ? `${data.features.length} eigene Parzellen im Bild · ` : ''}
          LV95 {gr(lvMitte.E)} / {gr(lvMitte.N)}
        </div>
      </div>

      <aside className="tafel">
        {auswahl.art === 'leer' && (
          <>
            <div className="kopf">
              <p className="ueber">Bestand im Bild</p>
              <h2>{genugNah ? `${bestand.length} Parzellen nach Marge` : 'Parzelle wählen'}</h2>
              <p className="sanft">Auf eine Parzelle klicken, um alle Angaben zu sehen.</p>
            </div>
            {!genugNah && <p className="sanft block">Näher heranzoomen, dann erscheinen die eigenen Parzellen.</p>}
            {genugNah && bestand.length === 0 && (
              <p className="sanft block">Keine eigenen Parzellen in diesem Ausschnitt.</p>
            )}
            <div className="karten">
              {bestand.map(f => {
                const e = f.properties as ParzelleEigenschaften;
                return (
                  <button type="button" key={String(f.id)} className="eintrag" onClick={() => {
                    const [lat, lon] = mitteVon(f);
                    karte.current?.setView([lat, lon], 19);
                    markieren(f);
                    eigeneZeigen(String(f.id), e, lat, lon);
                  }}>
                    <i style={{ background: margeFarbe(Number(e.marge) || 0) }} />
                    <span className="text">
                      <b>{e.adresse ?? (e.parzelle ? `Parzelle ${e.parzelle}` : 'Parzelle')}</b>
                      <small>{[e.gemeinde, e.zone, e.flaeche ? `${gr(e.flaeche)} m²` : null].filter(Boolean).join(' · ')}</small>
                    </span>
                    {Number(e.marge) > 0 && <span className="betrag">{gr(Math.round(Number(e.marge) / 1000))}k</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {auswahl.art === 'eigen' && (() => {
          const e = auswahl.e;
          const z = auswahl.zeile ?? {};
          const lv = toLV95(auswahl.lat, auswahl.lon);
          const maps = typeof z.google_maps_url === 'string' ? z.google_maps_url : null;
          return (
            <>
              <div className="kopf">
                <button type="button" className="zurueck" onClick={() => { setAuswahl({ art: 'leer' }); markieren(null); }}>← Liste</button>
                <p className="ueber">Parzelle {e.parzelle ?? '–'}{e.gemeinde ? ` · ${e.gemeinde}` : ''}</p>
                <h2>{e.adresse ?? 'Ohne Adresse'}</h2>
                <div className="marken">
                  <span className={`marke ${e.ausgeschlossen ? 'grau' : 'blau'}`}>{e.ausgeschlossen ? 'Ausgeschlossen' : 'Im Bestand'}</span>
                  {e.zone && <span className="marke">{ZONENARTEN.find(([k]) => k === zonenart(e.zone))?.[1]}</span>}
                </div>
              </div>

              <div className="zahlen">
                <div><small>Fläche</small><b>{e.flaeche ? `${gr(e.flaeche)} m²` : '–'}</b></div>
                <div><small>Marge</small><b style={{ color: Number(e.marge) > 0 ? margeFarbe(Number(e.marge)) : undefined }}>
                  {Number(e.marge) > 0 ? `${gr(e.marge)} CHF` : '–'}</b></div>
                <div className="breit"><small>Zone</small><b>{e.zone || '–'}</b></div>
                <div className="breit"><small>Eigentümer</small>
                  <b>{!auswahl.geholt ? '…' : auswahl.eigentuemer ?? <span className="sanft">noch nicht abgefragt</span>}</b></div>
              </div>

              <div className="aktionen">
                {e.adresse && <Kopieren wert={e.adresse} text="Adresse kopieren" />}
                {maps && <a className="knopf" href={maps} target={FENSTER.karte}>Google Maps</a>}
                <a className="knopf" href={geoadminLink(auswahl.lat, auswahl.lon, 12)} target={FENSTER.karte}>Bundes-GIS</a>
                <Kopieren wert={`${gr(lv.E)} / ${gr(lv.N)}`} text="LV95" />
              </div>

              {auswahl.zeile && <div className="abschnitt"><AlleFelder z={auswahl.zeile} /></div>}
              <div className="abschnitt">
                <Nachbarn parzelleId={auswahl.id} onOeffnen={oeffnePerId}
                  ohneUmriss={auswahl.umriss
                    ? <NachbarnBund umriss={auswahl.umriss} egrid={auswahl.egrid} onOeffnen={oeffnePerId} />
                    : undefined} />
              </div>
            </>
          );
        })()}

        {auswahl.art === 'bund' && (() => {
          const lv = toLV95(auswahl.lat, auswahl.lon);
          return (
            <>
              <div className="kopf">
                <button type="button" className="zurueck" onClick={() => { setAuswahl({ art: 'leer' }); markieren(null); }}>← Liste</button>
                <p className="ueber">Nicht im Bestand</p>
                <h2>{auswahl.laeuft ? 'Wird abgefragt …' : auswahl.fehler ? 'Abfrage nicht möglich' : 'Angaben vom Bund'}</h2>
              </div>
              {!auswahl.laeuft && auswahl.fehler && <p className="sanft block">Der Bundesdienst antwortet nicht.</p>}
              {!auswahl.laeuft && !auswahl.fehler && auswahl.treffer.length === 0 && (
                <p className="sanft block">Kein Eintrag an dieser Stelle.</p>
              )}
              <div className="karten">
                {auswahl.treffer.map((t, i) => (
                  <div key={i} className="eintrag still">
                    <span className="text">
                      <b>{t.adresse || t.titel}</b>
                      <small>{[t.adresse ? t.titel : null, t.info, t.egid ? `EGID ${t.egid}` : null].filter(Boolean).join(' · ')}</small>
                    </span>
                  </div>
                ))}
              </div>
              <div className="aktionen">
                <a className="knopf" href={geoadminLink(auswahl.lat, auswahl.lon, 12)} target={FENSTER.karte}>Bundes-GIS</a>
                <Kopieren wert={`${gr(lv.E)} / ${gr(lv.N)}`} text="LV95" />
              </div>
              {auswahl.umriss && (
                <div className="abschnitt">
                  <NachbarnBund umriss={auswahl.umriss} egrid={auswahl.egrid} onOeffnen={oeffnePerId} />
                </div>
              )}
            </>
          );
        })()}
      </aside>
    </div>
  );
}

/** Die Gestaltung der Vorlage, auf diesen Bereich beschränkt. */
const STIL = `
/* Karte zuerst, wie bei Immobilienplattformen: die Karte füllt alles,
   Leiste, Filter und Tafel schweben darüber. Eine Schrift, ruhige
   Grautöne, ein Akzent. */
.gisk{--bg:#F8FAFC;--weiss:#FFFFFF;--fl:#F1F5F9;--tinte:#0F172A;--grau:#64748B;--linie:#E2E8F0;--akzent:#2563EB;
  --schatten:0 10px 30px -12px rgba(15,23,42,.25),0 2px 6px rgba(15,23,42,.06);
  position:fixed;inset:0;z-index:50;height:100dvh;background:var(--bg);color:var(--tinte);
  font:14px/1.5 "Inter","Schibsted Grotesk",-apple-system,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
.gisk *{box-sizing:border-box}
.gisk button,.gisk input{font:inherit;color:inherit}
.gisk a{color:var(--akzent);text-decoration:none}
.gisk .map{position:absolute;inset:0;background:var(--fl)}
.gisk .leaflet-container{font:inherit}
/* Die weissen Linien im Raster: Leaflet legt die Kacheln Kante an
   Kante, und bei Windows-Skalierung (125 %, 150 %) oder Browserzoom
   rundet der Browser die Positionen auf Bruchteile von Pixeln -- dann
   bleibt zwischen zwei Kacheln ein Haarspalt, durch den der helle
   Hintergrund scheint. Jede Kachel ist deshalb einen Pixel grösser und
   überlappt die nächste.
   Dazu gehört zwingend mix-blend-mode:normal. Leaflet setzt auf jede
   Kachel "plus-lighter": die Farben zweier Kacheln werden addiert. Mit
   Überlappung wurde jede Kante damit doppelt hell -- das weisse Raster
   war danach schlimmer als vorher. Gemessen mit einfarbigen Kacheln bei
   125 % Skalierung, siehe Commit. */
.gisk img.leaflet-tile{width:257px!important;height:257px!important;mix-blend-mode:normal!important}
.gisk .leaflet-bar{border:0!important;box-shadow:var(--schatten)!important;border-radius:12px!important;overflow:hidden}
.gisk .leaflet-bar a{width:36px!important;height:36px!important;line-height:36px!important;color:var(--tinte)!important;border-color:var(--linie)!important}
.gisk .leaflet-bottom.leaflet-right{right:416px}
.gisk .leaflet-control-attribution{background:rgba(255,255,255,.8)!important;border-radius:6px 0 0 0;font-size:10px}

.gisk .leiste{position:absolute;z-index:700;top:16px;left:16px;right:416px;display:flex;gap:8px;align-items:center;
  background:var(--weiss);border-radius:16px;box-shadow:var(--schatten);padding:8px}
.gisk .rund{width:40px;height:40px;border-radius:12px;border:0;background:var(--fl);cursor:pointer;font-size:18px}
.gisk .rund:hover{background:var(--linie)}
.gisk .suche{position:relative;flex:1;min-width:160px}
.gisk .suche .lupe{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--grau);font-size:20px;line-height:1}
.gisk .suche input{width:100%;height:40px;border:0;border-radius:12px;background:var(--fl);padding:0 12px 0 36px;outline:none}
.gisk .suche input:focus{box-shadow:0 0 0 2px var(--akzent) inset;background:var(--weiss)}
.gisk .suche .liste{position:absolute;top:48px;left:0;right:0;background:var(--weiss);border-radius:12px;box-shadow:var(--schatten);
  max-height:320px;overflow:auto;padding:6px}
.gisk .treffer{display:block;width:100%;text-align:left;border:0;background:none;padding:9px 10px;border-radius:8px;cursor:pointer}
.gisk .treffer:hover{background:var(--fl)}
.gisk .treffer b{display:block;font-weight:600}.gisk .treffer small{color:var(--grau);font-size:12px}
.gisk .treffer.eigen b{color:var(--akzent)}
.gisk .leer{margin:0;padding:9px 10px;color:var(--grau)}
.gisk .werkzeuge{display:contents}
.gisk .segment{display:flex;background:var(--fl);border-radius:12px;padding:3px}
.gisk .segment button{border:0;background:none;padding:7px 12px;border-radius:9px;cursor:pointer;color:var(--grau);font-weight:500}
.gisk .segment button.an{background:var(--weiss);color:var(--tinte);box-shadow:0 1px 3px rgba(15,23,42,.12)}
.gisk .schalter{height:40px;border:1px solid var(--linie);background:var(--weiss);border-radius:12px;padding:0 14px;cursor:pointer;font-weight:500;color:var(--grau)}
.gisk .schalter.an{background:var(--tinte);border-color:var(--tinte);color:#fff}

.gisk .filter{position:absolute;z-index:650;top:76px;left:16px;right:416px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.gisk .filter .titel{font-size:12px;font-weight:600;color:var(--grau);background:var(--weiss);padding:6px 10px;border-radius:999px;box-shadow:var(--schatten)}
.gisk .filter button{border:0;background:var(--weiss);padding:6px 12px;border-radius:999px;cursor:pointer;font-size:13px;font-weight:500;box-shadow:var(--schatten)}
.gisk .filter button.an{background:var(--akzent);color:#fff}
.gisk .filter.genau{top:112px}
.gisk .filter.genau button{font-size:12px;padding:5px 10px}

.gisk .unten{position:absolute;z-index:650;left:16px;bottom:16px;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.gisk .legende{background:var(--weiss);border-radius:12px;box-shadow:var(--schatten);padding:8px 12px;display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--grau)}
.gisk .legende i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.gisk .legende.bild img{max-height:220px;display:block}
.gisk .readout{background:rgba(255,255,255,.92);border-radius:10px;box-shadow:var(--schatten);padding:6px 10px;font-size:12px;color:var(--grau);font-variant-numeric:tabular-nums}

.gisk .tafel{position:absolute;z-index:700;top:16px;right:16px;bottom:16px;width:384px;background:var(--weiss);
  border-radius:20px;box-shadow:var(--schatten);overflow-y:auto;padding:20px}
.gisk .kopf{margin-bottom:16px}
.gisk .zurueck{border:0;background:none;color:var(--grau);cursor:pointer;padding:0;margin-bottom:10px;font-size:13px}
.gisk .zurueck:hover{color:var(--tinte)}
.gisk .ueber{margin:0 0 4px;font-size:12px;font-weight:600;color:var(--grau);letter-spacing:.02em}
.gisk h2{font-family:inherit!important;margin:0;font-size:22px;line-height:1.2;font-weight:700;letter-spacing:-.02em}
.gisk .sanft{color:var(--grau);margin:6px 0 0;font-size:13px}
.gisk .sanft.block{margin:0 0 12px}
.gisk .marken{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.gisk .marke{font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;background:var(--fl);color:var(--tinte)}
.gisk .marke.blau{background:#DBEAFE;color:#1D4ED8}.gisk .marke.grau{color:var(--grau)}

.gisk .zahlen{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
.gisk .zahlen>div{background:var(--fl);border-radius:12px;padding:10px 12px;min-width:0}
.gisk .zahlen .breit{grid-column:1 / -1}
.gisk .zahlen small{display:block;font-size:11px;font-weight:600;color:var(--grau);margin-bottom:2px}
.gisk .zahlen b{font-size:15px;font-weight:600;word-break:break-word}

.gisk .aktionen{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}
.gisk .knopf,.gisk .copy{display:inline-flex;align-items:center;height:32px;padding:0 12px;border-radius:10px;border:1px solid var(--linie);
  background:var(--weiss);color:var(--tinte);font-size:13px;font-weight:500;cursor:pointer;font-family:inherit}
.gisk .knopf:hover,.gisk .copy:hover{border-color:var(--tinte)}
.gisk .copy.done{border-color:#16A34A;color:#16A34A}

.gisk .abschnitt{border-top:1px solid var(--linie);padding-top:14px;margin-top:14px}
.gisk .alle summary{cursor:pointer;font-weight:600;list-style:none;display:flex;justify-content:space-between}
.gisk .alle summary::after{content:"＋";color:var(--grau)}
.gisk .alle[open] summary::after{content:"－"}
.gisk dl.f{margin:10px 0 0;display:grid;grid-template-columns:minmax(0,44%) minmax(0,1fr);gap:0;font-size:13px}
.gisk dl.f dt,.gisk dl.f dd{padding:7px 0;border-bottom:1px solid var(--fl);margin:0;min-width:0;word-break:break-word}
.gisk dl.f dt{color:var(--grau);padding-right:10px}

.gisk .karten{display:flex;flex-direction:column;gap:6px}
.gisk .eintrag{display:flex;gap:10px;align-items:center;width:100%;text-align:left;border:1px solid var(--linie);background:var(--weiss);
  border-radius:12px;padding:10px 12px;cursor:pointer}
.gisk .eintrag:hover{border-color:var(--tinte)}
.gisk .eintrag.still{cursor:default}
.gisk .eintrag>i{width:10px;height:36px;border-radius:4px;flex:none}
.gisk .eintrag .text{flex:1;min-width:0}
.gisk .eintrag b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gisk .eintrag small{display:block;color:var(--grau);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gisk .betrag{font-weight:700;font-variant-numeric:tabular-nums}
.gisk-tip{font:13px/1.45 Inter,-apple-system,Arial,sans-serif;border-radius:10px;border:0;box-shadow:0 8px 24px rgba(15,23,42,.2);padding:8px 11px}

@media (max-width:900px){
  /* Handy: die Suche allein in der ersten Zeile, Grundkarte und Schalter
     als wischbare zweite Zeile, die Zonen als wischbare Zeile darunter.
     Die Zoomknöpfe und der Massstab fehlen mit Absicht: zwei Finger
     reichen, und der Platz ist knapp. Die Tafel wird ein Blatt am
     unteren Rand, das wächst, sobald eine Parzelle offen ist. */
  .gisk .leiste{top:12px;left:12px;right:12px;flex-wrap:wrap;gap:8px}
  .gisk .suche{flex:1 1 60%}
  .gisk .werkzeuge{display:flex;flex:1 1 100%;gap:6px;overflow-x:auto;scrollbar-width:none}
  .gisk .werkzeuge::-webkit-scrollbar{display:none}
  .gisk .segment{flex:1 0 auto}
  .gisk .segment button{padding:7px 10px}
  .gisk .schalter{flex:none;padding:0 12px}
  .gisk .filter{top:120px;left:12px;right:12px;flex-wrap:nowrap;overflow-x:auto;padding:0 0 6px;scrollbar-width:none}
  .gisk .filter::-webkit-scrollbar{display:none}
  .gisk .filter button,.gisk .filter .titel{flex:none}
  .gisk .filter.genau{top:158px}
  .gisk .leaflet-control-zoom,.gisk .leaflet-bottom.leaflet-right,.gisk .legende,.gisk .readout{display:none}
  .gisk .tafel{top:auto;left:0;right:0;bottom:0;width:auto;height:34vh;border-radius:20px 20px 0 0;padding:12px 16px 16px}
  .gisk .tafel::before{content:"";display:block;width:36px;height:4px;border-radius:2px;background:var(--linie);margin:0 auto 12px}
  .gisk.offen .tafel{height:64vh}
  .gisk .unten{left:12px;bottom:calc(34vh + 12px)}
  .gisk.offen .unten{bottom:calc(64vh + 12px)}
  .gisk h2{font-size:18px}
}
`;
