import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, SlidersHorizontal, X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { useParzellenImAusschnitt, type Ausschnitt, type ParzelleEigenschaften } from '@/hooks/use-karte';
import { Nachbarn } from '@/components/Nachbarn';
import { NachbarnBund } from '@/components/NachbarnBund';
import { usePortfolios, umrissVomBund, type Portfolio } from '@/hooks/use-portfolio';
import { alsKartengruppen, useGelegenheiten } from '@/hooks/use-gelegenheiten';
import { PortfolioImport } from '@/components/PortfolioImport';
import { Gespraeche } from '@/components/Gespraeche';
import { eigentuemerParzellen, eigentuemerSuchen, type EigentuemerTreffer } from '@/hooks/use-eigentuemer-suche';
import { supabase } from '@/integrations/supabase/client';
import { FENSTER } from '@/lib/fenster';
import { ARTEN, FLAECHEN, MARGEN, OHNE_FILTER, filterAktiv, passtFilter, type KartenFilter } from '@/lib/kartenfilter';
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
/**
 * Die Schweiz, Landesgrenze mit etwas Rand. Die Karte startet so, dass
 * sie den Bildschirm füllt, und lässt sich weder weiter heraus- noch
 * darüber hinaus schieben: ausserhalb liegt nichts, was hier jemand
 * braucht, und die Landeskarte endet dort ohnehin mit weissen Rändern.
 */
const SCHWEIZ_RAHMEN = L.latLngBounds([45.75, 5.9], [47.85, 10.55]);

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
  [100_000, '#CA8A04', '0,1–0,5 Mio.'], [1, '#94A3B8', 'bis 0,1 Mio.'], [-Infinity, '#1E3A8A', 'ohne Marge'],
];
/** Google-Maps-Adressen nach https://developers.google.com/maps/documentation/urls -- ohne Schlüssel. */
export function googleLink([lat, lon]: [number, number], strassenansicht: boolean): string {
  const p = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  return strassenansicht
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${p}`
    : `https://www.google.com/maps/search/?api=1&query=${p}`;
}
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

interface Treffer { label: string; origin: string; lat: number; lon: number; eigen?: { id: string; e: ParzelleEigenschaften };
  /** Ein Eigentümer statt eines Orts: öffnet alle seine Parzellen auf der Karte. */
  eigentuemer?: EigentuemerTreffer }

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
  // Portfolios der Mandanten: eine eigene Farbe, eine eigene Tafel.
  const [portfolioAn, setPortfolioAn] = useState(false);
  const { data: portfolios, isLoading: portfoliosLaden, error: portfolioFehler } = usePortfolios(portfolioAn);
  const portfolioEbene = useRef<L.GeoJSON | null>(null);
  // Alle Parzellen eines Eigentümers aus der Suche -- gezeigt wie ein
  // Portfolio: nur sie, violett, mit Liste. Ist das eine an, ist das
  // andere aus; zwei Gruppen übereinander wären nicht zu lesen.
  const [gruppe, setGruppe] = useState<Portfolio | null>(null);
  const [gruppeLaedt, setGruppeLaedt] = useState(false);
  // Im Portfolio-Modus zwei Ansichten: die Portfolios selbst, oder die
  // offenen Gelegenheiten (Arrondierung, Baugesuche) -- Tims "Display
  // opportunities directly on the map". Kein eigener Knopf in der
  // Leiste: auf dem iPhone ist dort kein Platz mehr (gemessen 0 px Rest).
  const [ansicht, setAnsicht] = useState<'portfolios' | 'gelegenheiten'>('portfolios');
  const gelAn = portfolioAn && ansicht === 'gelegenheiten';
  const { data: gelegenheiten, isLoading: gelLaedt, error: gelFehler } = useGelegenheiten(gelAn);
  const gelGruppen = useMemo(() => (gelegenheiten ? alsKartengruppen(gelegenheiten) : undefined), [gelegenheiten]);
  const gruppenModus = portfolioAn || !!gruppe || gruppeLaedt;
  // Die Ausdehnung je Portfolio, damit Aufklappen auf genau dieses zoomt.
  const portfolioRahmen = useRef<Record<string, L.LatLngBounds>>({});
  const [umrisseGeladen, setUmrisseGeladen] = useState<{ fertig: number; gesamt: number }>({ fertig: 0, gesamt: 0 });
  const grenzenEbene = useRef<L.Layer | null>(null);
  const [zonenAn, setZonenAn] = useState(false);
  const [zonenFilter, setZonenFilter] = useState<Set<Zonenart>>(new Set());
  const [filter, setFilter] = useState<KartenFilter>(OHNE_FILTER);
  const [legendeAuf, setLegendeAuf] = useState(false);
  // Handy (DESIGN.md, Karte): Filter und Ebenen in eigenen Blättern statt
  // vier Reihen Knöpfe über der Karte; die Tafel unten in drei Stufen.
  const [blatt, setBlatt] = useState<null | 'filter' | 'ebenen'>(null);
  const [stufe, setStufe] = useState<'klein' | 'mittel' | 'gross'>('klein');
  const griffY = useRef<number | null>(null);
  // Auf dem Handy ist die Suche schmal: ein kürzerer Platzhalter, sonst
  // steht dort "Adresse, Parzelle oder Eigen".
  const schmal = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 900px)').matches;
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
  // Im Portfolio-Modus zählt nur das Portfolio: der übrige Bestand wird
  // weder geholt noch gezeichnet, damit man sieht, wo die Parzellen
  // liegen, und nichts sonst.
  const { data } = useParzellenImAusschnitt(ausschnitt, genugNah && !gruppenModus);

  // Schriften der Vorlage, einmal geladen.
  useEffect(() => {
    if (document.getElementById('gisk-fonts')) return;
    const l = document.createElement('link');
    l.id = 'gisk-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Urbanist:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap';
    document.head.appendChild(l);
  }, []);

  // ------------------------------------------------------------ Karte
  useEffect(() => {
    if (!box.current || karte.current) return;
    const m = L.map(box.current, {
      center: SCHWEIZ, zoom: 8, maxZoom: 21,
      zoomControl: false, preferCanvas: true,
      maxBounds: SCHWEIZ_RAHMEN, maxBoundsViscosity: 1,
      // Bruchteile erlaubt, damit die Schweiz den Bildschirm wirklich
      // füllt und nicht auf die nächste ganze Stufe zurückfällt.
      zoomSnap: 0.25,
    });
    // Herauszoomen nur bis die Schweiz den Bildschirm füllt -- "inside":
    // die Schweiz deckt das ganze Bild, kein Rand darum.
    const schweizFuellen = () => {
      const z = m.getBoundsZoom(SCHWEIZ_RAHMEN, true);
      m.setMinZoom(z);
      if (m.getZoom() < z) m.setZoom(z);
    };
    m.fitBounds(SCHWEIZ_RAHMEN, { animate: false });
    schweizFuellen();
    m.on('resize', schweizFuellen);
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
    // Wer die Karte bewegt, will die Karte sehen: die Tafel klappt ein.
    m.on('dragstart', () => setStufe('klein'));
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
    if (!data || !genugNah || gruppenModus) return;
    eigenEbene.current = L.geoJSON(data, {
      filter: f => passtZone((f.properties as ParzelleEigenschaften)?.zone, zonenFilter, zonenGenau)
        && passtFilter(f.properties as ParzelleEigenschaften, filter),
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
  }, [data, genugNah, zonenFilter, zonenGenau, filter, grund, gruppenModus]);

  /**
   * Den Umriss einer Bestandsparzelle beim Bund holen, wenn der Bestand
   * keinen hat -- in Zürich keiner (gemessen: Kloten 0 von 1644). Ohne
   * ihn stand "kein Umriss eingelesen", obwohl der Bund ihn liefert; das
   * kam vor, wann immer eine Parzelle aus der Liste, der Suche oder einem
   * Portfolio geöffnet wurde statt per Klick in die Karte. Zwei Fassungen:
   * LV95 für die Nachbarsuche, WGS84 für den roten Umriss.
   */
  async function umrissNachholen(id: string, egrid: unknown, hin = false) {
    if (typeof egrid !== 'string' || !/^CH[0-9A-Z]{12}$/.test(egrid)) return;
    try {
      const [lv95, wgs] = await Promise.all([umrissVomBund(egrid, '2056'), umrissVomBund(egrid, '4326')]);
      if (wgs) {
        markieren({ type: 'Feature', properties: {}, geometry: wgs } as GeoJSON.Feature);
        if (hin && markiert.current) hinfliegen((markiert.current as L.GeoJSON).getBounds());
      }
      if (lv95 && (lv95.type === 'Polygon' || lv95.type === 'MultiPolygon')) {
        setAuswahl(a => (a.art === 'eigen' && a.id === id && !a.umriss
          ? { ...a, umriss: lv95 as Umriss, egrid } : a));
      }
    } catch { /* ohne Umriss bleibt der Hinweis stehen */ }
  }

  /**
   * Auf eine Parzelle fliegen, ohne dass sie unter der Tafel oder der
   * Knopfleiste landet: auf dem Desktop deckt die Tafel rechts 400 px,
   * auf dem iPhone unten zwei Drittel. Gemessen wird, was tatsächlich
   * liegt, statt Zahlen aus dem CSS abzuschreiben.
   */
  /** Wo die gewählte Parzelle liegt: Mitte des roten Umrisses, sonst der Klickpunkt. */
  function auswahlOrt(): [number, number] {
    const b = (markiert.current as L.GeoJSON | null)?.getBounds?.();
    if (b?.isValid()) { const c = b.getCenter(); return [c.lat, c.lng]; }
    return 'lat' in auswahl ? [auswahl.lat, auswahl.lon] : [mitte.lat, mitte.lng];
  }

  function hinfliegen(b: L.LatLngBounds, maxZoom = 19) {
    const m = karte.current;
    if (!m || !b.isValid()) return;
    const c = m.getContainer().getBoundingClientRect();
    const r = (sel: string) => document.querySelector(`.gisk ${sel}`)?.getBoundingClientRect();
    let oben = 40, rechts = 40, unten = 40;
    for (const k of [r('.leiste'), r('.filter')]) if (k && k.height) oben = Math.max(oben, k.bottom - c.top + 16);
    const t = r('.tafel');
    if (t && t.height) {
      if (t.width >= c.width - 40) unten = Math.max(unten, c.bottom - t.top + 16);
      else rechts = Math.max(rechts, c.right - t.left + 16);
    }
    m.flyToBounds(b, { paddingTopLeft: [40, oben], paddingBottomRight: [rechts, unten], maxZoom, duration: 0.8 });
  }

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
    void umrissNachholen(id, z?.egrid);
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
    // Aus Liste, Portfolio oder Nachbarliste: die Karte soll dorthin.
    void umrissNachholen(id, z.egrid, true);
  }

  // ---------------------------------------------- Portfolio
  // Violett, weil die Margen-Farben grün bis gelb sind und Rot die
  // angeklickte Parzelle ist: ein Portfolio soll man auf einen Blick
  // vom Bestand unterscheiden.
  useEffect(() => {
    const m = karte.current;
    portfolioEbene.current?.remove(); portfolioEbene.current = null;
    const sichtbar = gruppe ? [gruppe] : gelAn ? gelGruppen ?? [] : portfolioAn ? portfolios ?? [] : [];
    // Petrol für Gelegenheiten: man soll sie nicht mit einem Portfolio
    // verwechseln. Kein Orange (Julians Regel).
    const farbe = gelAn ? '#0E7490' : '#7C3AED';
    if (!m || !sichtbar.length) return;
    let abgebrochen = false;
    const ebene = L.geoJSON(undefined, {
      style: { color: farbe, weight: 3, fillColor: farbe, fillOpacity: 0.25 },
    }).addTo(m);
    portfolioEbene.current = ebene;
    const alle = sichtbar.flatMap(pf => pf.positionen.map(p => ({ pf, p }))).filter(x => x.p.egrid);
    portfolioRahmen.current = {};
    setUmrisseGeladen({ fertig: 0, gesamt: alle.length });
    (async () => {
      let fertig = 0;
      for (const { pf, p } of alle) {
        try {
          const g = await umrissVomBund(p.egrid!);
          if (abgebrochen) return;
          if (g) {
            const f = L.geoJSON(g as GeoJSON.GeoJsonObject, {
              style: { color: farbe, weight: 3, fillColor: farbe, fillOpacity: 0.25 },
            });
            f.bindTooltip(`<b>${p.adresse ?? 'Parzelle ' + (p.parzelle ?? '')}</b><br>${pf.name}`
              + (p.rolle ? `<br>${p.rolle}` : '')
              + (pf.manager.length ? `<br>Manager: ${pf.manager.join(', ')}` : ''),
              { sticky: true, direction: 'top', className: 'gisk-tip' });
            f.on('click', (ev: L.LeafletMouseEvent) => {
              L.DomEvent.stopPropagation(ev);
              if (p.parzelleId) oeffnePerId(p.parzelleId);
            });
            f.eachLayer(l => ebene.addLayer(l));
            const b = f.getBounds();
            portfolioRahmen.current[pf.id] = portfolioRahmen.current[pf.id]
              ? portfolioRahmen.current[pf.id].extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast());
          }
        } catch { /* eine fehlende Parzelle hält die übrigen nicht auf */ }
        fertig += 1;
        setUmrisseGeladen({ fertig, gesamt: alle.length });
      }
      // Unter Tafel und Knopfleiste darf keine Parzelle liegen -- gemessen:
      // mit festem Rand lag eine von drei unter der Tafel.
      if (!abgebrochen && ebene.getLayers().length) hinfliegen(ebene.getBounds(), 17);
    })();
    return () => { abgebrochen = true; };
  }, [portfolioAn, portfolios, gruppe, gelAn, gelGruppen]);

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
        const [j, eig, eigner] = await Promise.all([
          fetch('https://api3.geo.admin.ch/rest/services/ech/SearchServer?type=locations&limit=6&sr=2056&lang=de&searchText='
            + encodeURIComponent(s)).then(x => x.json()).catch(() => null),
          eigen,
          eigentuemerSuchen(s).catch(() => [] as EigentuemerTreffer[]),
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
        const eignerTreffer: Treffer[] = eigner.map(x => ({
          label: x.name, lat: NaN, lon: NaN, eigentuemer: x,
          origin: `Eigentümer${x.art ? ' · ' + ({ person: 'Person', firma: 'Firma', institution: 'Institution', gemeinschaft: 'Erbengemeinschaft' } as Record<string, string>)[x.art] : ''} · alle Parzellen`,
        }));
        setTreffer([...eignerTreffer, ...eigeneTreffer, ...rs.map(r => {
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
    return [...(data.features ?? [])]
      .filter(f => !f.properties?.ausgeschlossen)
      .filter(f => passtZone(f.properties?.zone, zonenFilter, zonenGenau))
      .filter(f => passtFilter(f.properties ?? {}, filter))
      .sort((a, b) => (Number(b.properties?.marge) || 0) - (Number(a.properties?.marge) || 0))
      .slice(0, 15);
  }, [data, zonenFilter, zonenGenau, filter]);

  // Wie viele Parzellen im Bild den Filtern entsprechen -- für den Knopf
  // "N Parzellen zeigen" im Filterblatt (bestand ist auf 15 gekürzt).
  const trefferZahl = useMemo(() => (data?.features ?? [])
    .filter(f => !f.properties?.ausgeschlossen)
    .filter(f => passtZone(f.properties?.zone, zonenFilter, zonenGenau))
    .filter(f => passtFilter(f.properties ?? {}, filter)).length, [data, zonenFilter, zonenGenau, filter]);
  const filterZahl = zonenFilter.size + zonenGenau.size + (filter.flaecheAb ? 1 : 0) + (filter.margeAb ? 1 : 0) + (filter.art ? 1 : 0);
  // Eine gewählte Parzelle öffnet die Tafel halb, damit Karte und Angaben zu sehen sind.
  useEffect(() => { if (auswahl.art !== 'leer') setStufe(st => (st === 'klein' ? 'mittel' : st)); }, [auswahl]);

  // Die genauen Zonen der gewählten Arten, wie sie im Bild vorkommen.
  // Nur dann: ohne gewählte Art wären es dreissig Chips, und das hilft
  // niemandem. Sortiert so, dass W2 vor W10 steht.
  const zonenImBild = useMemo(() => {
    if (!data || zonenFilter.size === 0) return [] as string[];
    const menge = new Set<string>();
    for (const f of data.features ?? []) {
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
    if (t.eigentuemer) {
      setPortfolioAn(false); setAuswahl({ art: 'leer' }); markieren(null);
      setGruppe(null); setGruppeLaedt(true);
      try { setGruppe(await eigentuemerParzellen(t.eigentuemer)); }
      finally { setGruppeLaedt(false); }
      return;
    }
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
                 placeholder={schmal ? 'Adresse oder Parzelle' : 'Adresse, Parzelle oder Eigentümer'} autoComplete="off" />
          {(treffer !== null || sucheStatus !== 'ruhe') && suche.trim().length >= 3 && (
            <div className="liste">
              {sucheStatus === 'laeuft' && <p className="leer">Suche läuft …</p>}
              {sucheStatus === 'fehler' && <p className="leer">Suchdienst nicht erreichbar.</p>}
              {sucheStatus === 'ruhe' && treffer?.length === 0 && <p className="leer">Kein Treffer.</p>}
              {sucheStatus === 'ruhe' && treffer?.map((t, i) => (
                <button type="button" key={i} className={`treffer${t.eigen ? ' eigen' : ''}${t.eigentuemer ? ' eigner' : ''}`} onClick={() => trefferOeffnen(t)}>
                  <b>{t.label}</b><small>{t.eigen || t.eigentuemer ? t.origin : 'Ort · swisstopo'}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        {!gruppenModus && (
          <button type="button" className={`rund nur-handy${filterZahl ? ' an' : ''}`} onClick={() => setBlatt('filter')}
                  aria-label={filterZahl ? `Filter, ${filterZahl} aktiv` : 'Filter'}>
            <SlidersHorizontal className="sym" />{filterZahl ? <span className="zahl">{filterZahl}</span> : null}
          </button>
        )}
        <button type="button" className="rund nur-handy" onClick={() => setBlatt('ebenen')} aria-label="Kartenebenen">
          <Layers className="sym" />
        </button>
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
          <button type="button" className={`schalter${portfolioAn ? ' an lila' : ''}`}
                  onClick={() => { setPortfolioAn(v => !v); setGruppe(null); setAuswahl({ art: 'leer' }); markieren(null); }}>
            Portfolios
          </button>
        </div>
      </header>

      {/* Zonenfilter wie bei Immobilienportalen: Chips, mehrere wählbar. */}
      {!gruppenModus && (<div className="filterblock">
        <div className="filter">
          <span className="titel">Zone</span>
          <button type="button" className={zonenFilter.size === 0 ? 'an' : ''} onClick={() => { setZonenFilter(new Set()); setZonenGenau(new Set()); }}>Alle</button>
          {ZONENARTEN.map(([z, t]) => (
            <button type="button" key={z} className={zonenFilter.has(z) ? 'an' : ''} onClick={() => umschalten(z)}>{t}</button>
          ))}
        </div>
        {/* Auswahlfelder statt Chips: auf dem iPhone öffnet sich die
            Systemliste, und drei Gruppen Chips passten nicht in eine Zeile. */}
        <div className="filter wahl">
          <select aria-label="Parzellengrösse" className={filter.flaecheAb ? 'an' : ''} value={filter.flaecheAb}
                  onChange={e => setFilter(f => ({ ...f, flaecheAb: Number(e.target.value) }))}>
            {FLAECHEN.map(([w, t]) => <option key={w} value={w}>{t}</option>)}
          </select>
          <select aria-label="Potenzial" className={filter.margeAb ? 'an' : ''} value={filter.margeAb}
                  onChange={e => setFilter(f => ({ ...f, margeAb: Number(e.target.value) }))}>
            {MARGEN.map(([w, t]) => <option key={w} value={w}>{t}</option>)}
          </select>
          <select aria-label="Objektart" className={filter.art ? 'an' : ''} value={filter.art}
                  onChange={e => setFilter(f => ({ ...f, art: e.target.value }))}>
            {ARTEN.map(([w, t]) => <option key={w} value={w}>{t}</option>)}
          </select>
          {filterAktiv(filter) && (
            <button type="button" onClick={() => setFilter(OHNE_FILTER)}>Zurücksetzen</button>
          )}
        </div>
        {zonenImBild.length > 0 && (
          <div className="filter genau">
            {zonenImBild.map(z => (
              <button type="button" key={z} className={zonenGenau.has(z) ? 'an' : ''} onClick={() => genauUmschalten(z)}>{z}</button>
            ))}
          </div>
        )}
      </div>)}

      {/* Handy: die aktiven Filter als eine Zeile, je mit Kreuz zum Entfernen. */}
      {!gruppenModus && filterZahl > 0 && (
        <div className="aktiv-zeile nur-handy-flex">
          {[...zonenFilter].map(z => (
            <button type="button" key={z} onClick={() => umschalten(z)}>{ZONENARTEN.find(x => x[0] === z)?.[1]} <X className="x" /></button>
          ))}
          {[...zonenGenau].map(z => <button type="button" key={z} onClick={() => genauUmschalten(z)}>{z} <X className="x" /></button>)}
          {filter.flaecheAb > 0 && <button type="button" onClick={() => setFilter(f => ({ ...f, flaecheAb: 0 }))}>{FLAECHEN.find(x => x[0] === filter.flaecheAb)?.[1]} <X className="x" /></button>}
          {filter.margeAb > 0 && <button type="button" onClick={() => setFilter(f => ({ ...f, margeAb: 0 }))}>{MARGEN.find(x => x[0] === filter.margeAb)?.[1]} <X className="x" /></button>}
          {filter.art && <button type="button" onClick={() => setFilter(f => ({ ...f, art: '' }))}>{ARTEN.find(x => x[0] === filter.art)?.[1]} <X className="x" /></button>}
        </div>
      )}

      {blatt && (
        <div className="blatt-grund" onClick={() => setBlatt(null)}>
          <div className="blatt" role="dialog" aria-label={blatt === 'filter' ? 'Filter' : 'Kartenebenen'} onClick={e => e.stopPropagation()}>
            <div className="blatt-kopf">
              <h3>{blatt === 'filter' ? 'Filter' : 'Kartenebenen'}</h3>
              <button type="button" className="rund" onClick={() => setBlatt(null)} aria-label="Schliessen"><X className="sym" /></button>
            </div>

            {blatt === 'ebenen' ? (
              <>
                <div className="segment voll">
                  {([['karte', 'Karte'], ['luftbild', 'Luftbild']] as [Grund, string][]).map(([g, t]) => (
                    <button type="button" key={g} className={grund === g ? 'an' : ''} onClick={() => setGrund(g)}>{t}</button>
                  ))}
                </div>
                {([
                  ['Parzellengrenzen', 'Grenzen der Grundstücke aus dem Kataster', grenzenAn, () => setGrenzenAn(v => !v)],
                  ['Bauzonen', 'Zonen des Bundes, mit Legende', zonenAn, () => setZonenAn(v => !v)],
                  ['Nur Portfolios', 'Kundenportfolios und Gelegenheiten', portfolioAn, () => { setPortfolioAn(v => !v); setGruppe(null); setAuswahl({ art: 'leer' }); markieren(null); }],
                ] as [string, string, boolean, () => void][]).map(([t, u, an, f]) => (
                  <button type="button" key={t} className="schalt-zeile" role="switch" aria-checked={an} onClick={f}>
                    <span><b>{t}</b><small>{u}</small></span>
                    <i className={`schalt${an ? ' an' : ''}`} />
                  </button>
                ))}
              </>
            ) : (
              <>
                <p className="blatt-titel">Zone</p>
                <div className="chips">
                  <button type="button" className={zonenFilter.size === 0 ? 'an' : ''} onClick={() => { setZonenFilter(new Set()); setZonenGenau(new Set()); }}>Alle</button>
                  {ZONENARTEN.map(([z, t]) => <button type="button" key={z} className={zonenFilter.has(z) ? 'an' : ''} onClick={() => umschalten(z)}>{t}</button>)}
                </div>
                {zonenImBild.length > 0 && (
                  <div className="chips klein">
                    {zonenImBild.map(z => <button type="button" key={z} className={zonenGenau.has(z) ? 'an' : ''} onClick={() => genauUmschalten(z)}>{z}</button>)}
                  </div>
                )}
                <p className="blatt-titel">Grösse</p>
                <div className="chips">
                  {FLAECHEN.map(([w, t]) => <button type="button" key={w} className={filter.flaecheAb === w ? 'an' : ''} onClick={() => setFilter(f => ({ ...f, flaecheAb: w }))}>{w ? t : 'Alle'}</button>)}
                </div>
                <p className="blatt-titel">Potenzial</p>
                <div className="chips">
                  {MARGEN.map(([w, t]) => <button type="button" key={w} className={filter.margeAb === w ? 'an' : ''} onClick={() => setFilter(f => ({ ...f, margeAb: w }))}>{w ? t : 'Alle'}</button>)}
                </div>
                <p className="blatt-titel">Objektart</p>
                <div className="chips">
                  {ARTEN.map(([w, t]) => <button type="button" key={w || 'alle'} className={filter.art === w ? 'an' : ''} onClick={() => setFilter(f => ({ ...f, art: w }))}>{w ? t : 'Alle'}</button>)}
                </div>
                <div className="blatt-fuss">
                  <button type="button" className="knopf" disabled={!filterZahl}
                          onClick={() => { setFilter(OHNE_FILTER); setZonenFilter(new Set()); setZonenGenau(new Set()); }}>Zurücksetzen</button>
                  <button type="button" className="knopf haupt" onClick={() => setBlatt(null)}>
                    {genugNah ? `${trefferZahl.toLocaleString('de-CH')} ${trefferZahl === 1 ? 'Parzelle' : 'Parzellen'} zeigen` : 'Anwenden'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="unten">
        {genugNah && !gruppenModus && (
          <div className="legende">
            {STUFEN.map(([, c, t]) => <span key={t}><i style={{ background: c }} />{t}</span>)}
          </div>
        )}
        {zonenAn && (
          // Die Legende der Bauzonen deckt ein Viertel der Karte. Sie ist
          // zu, bis man sie öffnet -- auf dem Telefon erst recht.
          <div className={`legende bild${legendeAuf ? ' auf' : ''}`}>
            <button type="button" className="legende-knopf" onClick={() => setLegendeAuf(v => !v)} aria-expanded={legendeAuf}>
              Legende Bauzonen <span aria-hidden>{legendeAuf ? '−' : '+'}</span>
            </button>
            {legendeAuf && (
              <img src="https://api3.geo.admin.ch/static/images/legends/ch.are.bauzonen_de.png" alt="Legende Bauzonen"
                   onError={e => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
            )}
          </div>
        )}
        <div className="readout">
          {gruppe ? `Nur ${gruppe.name} sichtbar · ` : portfolioAn ? 'Nur Portfolios sichtbar · ' : !genugNah ? 'Näher heranzoomen für den Bestand · ' : ''}
          {genugNah && data && !gruppenModus ? `${data.features?.length ?? 0} eigene Parzellen im Bild · ` : ''}
          LV95 {gr(lvMitte.E)} / {gr(lvMitte.N)}
        </div>
      </div>

      <aside className={`tafel stufe-${stufe}`}>
        {/* Griff (nur Handy): antippen oder wischen -- klein, halb, gross. */}
        <button type="button" className="griff nur-handy" aria-label="Tafel grösser oder kleiner"
                onClick={() => setStufe(st => (st === 'klein' ? 'mittel' : st === 'mittel' ? 'gross' : 'klein'))}
                onTouchStart={e => { griffY.current = e.touches[0].clientY; }}
                onTouchEnd={e => {
                  const y0 = griffY.current; griffY.current = null;
                  if (y0 == null) return;
                  const dy = e.changedTouches[0].clientY - y0;
                  if (Math.abs(dy) < 30) return;
                  e.preventDefault();
                  setStufe(st => dy < 0 ? (st === 'klein' ? 'mittel' : 'gross') : (st === 'gross' ? 'mittel' : 'klein'));
                }}>
          <i />
        </button>
        {auswahl.art === 'leer' && (gruppe || gruppeLaedt) && (
          <PortfolioTafel portfolios={gruppe ? [gruppe] : undefined} laedt={gruppeLaedt} fehler={false}
                          ueber="Eigentümer" startOffen={gruppe?.id}
                          umrisse={umrisseGeladen} onOeffnen={id => oeffnePerId(id)}
                          onSchliessen={() => { setGruppe(null); markieren(null); }}
                          onZeigen={() => { const b = portfolioEbene.current?.getBounds();
                            if (b?.isValid()) hinfliegen(b, 18); }} />
        )}
        {auswahl.art === 'leer' && !gruppe && !gruppeLaedt && portfolioAn && (
          <div className="segment ansicht" role="tablist">
            {([['portfolios', 'Portfolios'], ['gelegenheiten', 'Gelegenheiten']] as const).map(([w, t]) => (
              <button key={w} type="button" role="tab" aria-selected={ansicht === w} className={ansicht === w ? 'an' : ''}
                      onClick={() => { setAnsicht(w); markieren(null); }}>{t}</button>
            ))}
          </div>
        )}
        {auswahl.art === 'leer' && !gruppe && !gruppeLaedt && gelAn && (
          <PortfolioTafel key="gel" portfolios={gelGruppen} laedt={gelLaedt} fehler={!!gelFehler}
                          ueber="Offene Gelegenheiten" einheit="Gelegenheiten"
                          umrisse={umrisseGeladen} onOeffnen={id => oeffnePerId(id)}
                          onZeigen={id => { const b = portfolioRahmen.current[id]; if (b) hinfliegen(b, 18); }} />
        )}
        {auswahl.art === 'leer' && !gruppe && !gruppeLaedt && portfolioAn && !gelAn && (
          <PortfolioTafel hochladen portfolios={portfolios} laedt={portfoliosLaden} fehler={!!portfolioFehler}
                          umrisse={umrisseGeladen} onOeffnen={id => oeffnePerId(id)}
                          onZeigen={id => { const b = portfolioRahmen.current[id];
                            if (b) hinfliegen(b, 18); }} />
        )}
        {auswahl.art === 'leer' && !gruppenModus && (
          <>
            <div className="kopf">
              <p className="ueber">Bestand im Bild</p>
              <h2>{genugNah ? `${bestand.length} ${bestand.length === 1 ? 'Parzelle' : 'Parzellen'} nach Marge` : 'Parzelle wählen'}</h2>
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
                {/* Google Maps und Street View über die offiziellen Maps-URLs
                    (ohne Schlüssel erlaubt). Als Grundkarte einbetten liesse
                    Google nur mit bezahltem API-Schlüssel und eigenem SDK zu;
                    swisstopo bleibt darum die Karte. Der Ort ist der Umriss,
                    wenn er da ist -- sonst stünde nach "aus der Liste
                    öffnen" die Kartenmitte da. */}
                <button type="button" className="knopf" onClick={() => window.open(googleLink(auswahlOrt(), false), FENSTER.karte)}>Google Maps</button>
                <button type="button" className="knopf" onClick={() => window.open(googleLink(auswahlOrt(), true), FENSTER.karte)}>Street View</button>
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
              <div className="abschnitt">
                <Gespraeche parzelleId={auswahl.id} ownerName={auswahl.eigentuemer ?? null} />
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

/** Die Portfolios in der Tafel: wem sie gehören, wer sie bewirtschaftet, welche Parzellen. */
function PortfolioTafel({ portfolios, laedt, fehler, umrisse, onOeffnen, onZeigen,
  ueber = 'Portfolios', startOffen, onSchliessen, hochladen = false, einheit = 'Portfolios' }: {
  portfolios?: Portfolio[]; laedt: boolean; fehler: boolean;
  umrisse: { fertig: number; gesamt: number }; onOeffnen: (id: string) => void;
  onZeigen: (portfolioId: string) => void;
  /** Kleine Zeile über dem Titel; bei einer Eigentümersuche "Eigentümer". */
  ueber?: string;
  /** Eine Gruppe, die gleich offen steht -- bei einem Eigentümer gibt es nur die eine. */
  startOffen?: string;
  onSchliessen?: () => void;
  /** Ob "Portfolio hochladen" angeboten wird -- bei einer Eigentümersuche nicht. */
  hochladen?: boolean;
  /** Wie die Gruppen heissen: "Portfolios" oder "Gelegenheiten". */
  einheit?: string;
}) {
  // Zugeklappt, bis man eines wählt: mit zwanzig Parzellen je Portfolio
  // wird die Tafel sonst zur Liste, durch die man scrollt, statt zur
  // Übersicht. Offen ist immer höchstens eines.
  const [offen, setOffen] = useState<string | null>(startOffen ?? null);
  const [importAuf, setImportAuf] = useState(false);
  const gel = einheit === 'Gelegenheiten';
  useEffect(() => { if (startOffen) setOffen(startOffen); }, [startOffen]);
  if (importAuf) return <PortfolioImport onFertig={() => setImportAuf(false)} onAbbrechen={() => setImportAuf(false)} />;
  const knopf = hochladen && (
    <button type="button" className="knopf" onClick={() => setImportAuf(true)}>Portfolio hochladen</button>
  );
  if (laedt) return <div className="kopf"><p className="ueber">{ueber}</p><h2>Wird geladen …</h2></div>;
  if (fehler) return (
    <div className="kopf"><p className="ueber">Portfolios</p><h2>Nicht lesbar</h2>
      <p className="sanft">Portfolios sieht nur, wer angemeldet ist.</p></div>);
  if (!portfolios?.length) return (
    <div className="kopf"><p className="ueber">{ueber}</p><h2>Noch keine</h2>
      <p className="sanft">{gel ? 'Keine offene Gelegenheit. Im Bereich "Gelegenheiten" lässt sich die Arrondierung je Portfolio prüfen.' : 'Es ist kein Portfolio erfasst.'}</p>{knopf}</div>);
  return (
    <>
      <div className="kopf">
        <p className="ueber">{ueber}</p>
        <h2>{onSchliessen ? `${portfolios[0].positionen.length} Parzellen` : `${portfolios.length} ${einheit}`}</h2>
        {onSchliessen && (
          <button type="button" className="knopf" onClick={onSchliessen}>Suche schliessen</button>
        )}
        {knopf}
        {umrisse.gesamt > 0 && umrisse.fertig < umrisse.gesamt && (
          <p className="sanft">Umrisse vom Bund: {umrisse.fertig} von {umrisse.gesamt} …</p>
        )}
      </div>
      <div className="mappen">
        {portfolios.map(pf => {
          const auf = offen === pf.id;
          return (
            <div key={pf.id} className={`mappe${auf ? ' auf' : ''}${gel ? ' gel' : ''}`}>
              <button type="button" className="mappe-kopf" aria-expanded={auf}
                      onClick={() => { setOffen(auf ? null : pf.id); if (!auf) onZeigen(pf.id); }}>
                <span className="text">
                  <b>{pf.name.replace(/\s*--\s*/, ' · ')}</b>
                  <small>{pf.positionen.length} {pf.positionen.length === 1 ? 'Parzelle' : 'Parzellen'} · {pf.eigner ?? 'ohne Eigner'}</small>
                </span>
                <span className="pfeil" aria-hidden>{auf ? '−' : '+'}</span>
              </button>
              {auf && (
                <div className="mappe-inhalt">
                  <dl className="rolle">
                    <dt>{gel ? 'Kunde' : 'Eigner'}</dt><dd>{pf.eigner ?? '–'}</dd>
                    <dt>{gel ? 'Zustand' : 'Manager'}</dt><dd>{pf.manager.length ? pf.manager.join(', ') : '–'}</dd>
                  </dl>
                  <div className="karten">
                    {pf.positionen.map(p => (
                      <button type="button" key={p.id} className="eintrag" disabled={!p.parzelleId}
                              onClick={() => p.parzelleId && onOeffnen(p.parzelleId)}>
                        <i className={gel ? 'petrol' : 'lila'} />
                        <span className="text">
                          <b>{p.adresse ?? `Parzelle ${p.parzelle ?? '?'}`}</b>
                          <small>{[p.rolle, p.parzelle ? `Parz. ${p.parzelle}` : null, p.zone,
                                   p.flaeche ? `${gr(p.flaeche)} m²` : null].filter(Boolean).join(' · ')}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Die Gestaltung der Vorlage, auf diesen Bereich beschränkt. */
const STIL = `
/* Karte zuerst, wie bei Immobilienplattformen: die Karte füllt alles,
   Leiste, Filter und Tafel schweben darüber. Eine Schrift, ruhige
   Grautöne, ein Akzent. */
.gisk{--bg:#F4F4F5;--weiss:#FFFFFF;--fl:#F4F4F5;--tinte:#111111;--grau:#646B78;--linie:#E4E4E7;--akzent:#3D45F5;
  --schatten:0 6px 20px -10px rgba(17,17,17,.28),0 1px 2px rgba(17,17,17,.06);--dunkel:#1E2433;--violett:#7C5CFC;
  position:fixed;inset:0;z-index:50;height:100dvh;background:var(--bg);color:var(--tinte);
  font:14px/1.5 "Urbanist",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.gisk *{box-sizing:border-box}
/* :where, damit die Grundregel nur Vorgabe ist: Bausteine mit eigenen
   Klassen (Gespräche, Nachbarn) behalten ihre Farbe -- mit .gisk button
   stand ein weisser Knopftext dunkel auf dunkel. */
:where(.gisk) button,:where(.gisk) input{font:inherit;color:inherit}
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
.gisk .leaflet-bar{border:0!important;box-shadow:var(--schatten)!important;border-radius:4px!important;overflow:hidden}
.gisk .leaflet-bar a{width:36px!important;height:36px!important;line-height:36px!important;color:var(--tinte)!important;border-color:var(--linie)!important}
.gisk .leaflet-bottom.leaflet-right{right:416px}
.gisk .leaflet-control-attribution{background:rgba(255,255,255,.8)!important;border-radius:6px 0 0 0;font-size:10px}

.gisk .leiste{position:absolute;z-index:700;top:16px;left:16px;right:416px;display:flex;gap:8px;align-items:center;
  background:var(--weiss);border:1px solid var(--linie);border-radius:4px;box-shadow:var(--schatten);padding:8px}
.gisk .rund{width:40px;height:40px;border-radius:4px;border:0;background:var(--fl);cursor:pointer;font-size:18px}
.gisk .rund:hover{background:var(--linie)}
.gisk .suche{position:relative;flex:1;min-width:160px}
.gisk .suche .lupe{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--grau);font-size:20px;line-height:1}
.gisk .suche input{width:100%;height:40px;border:0;border-radius:4px;background:var(--fl);padding:0 12px 0 36px;outline:none}
.gisk .suche input:focus{box-shadow:0 0 0 2px var(--akzent) inset;background:var(--weiss)}
.gisk .suche .liste{position:absolute;top:48px;left:0;right:0;background:var(--weiss);border-radius:4px;box-shadow:var(--schatten);
  max-height:320px;overflow:auto;padding:6px}
.gisk .treffer{display:block;width:100%;text-align:left;border:0;background:none;padding:9px 10px;border-radius:3px;cursor:pointer}
.gisk .treffer:hover{background:var(--fl)}
.gisk .treffer b{display:block;font-weight:600}.gisk .treffer small{color:var(--grau);font-size:12px}
.gisk .treffer.eigen b{color:var(--akzent)}
.gisk .treffer.eigner b{color:var(--violett)}
.gisk .leer{margin:0;padding:9px 10px;color:var(--grau)}
.gisk .werkzeuge{display:contents}
.gisk .segment{display:flex;background:var(--fl);border-radius:4px;padding:3px}
.gisk .segment button{border:0;background:none;padding:7px 12px;border-radius:3px;cursor:pointer;color:var(--grau);font-weight:500}
.gisk .segment button.an{background:var(--dunkel);color:#fff}
.gisk .schalter{height:40px;border:1px solid var(--linie);background:var(--weiss);border-radius:4px;padding:0 14px;cursor:pointer;font-weight:500;color:var(--grau)}
.gisk .schalter.an{background:var(--dunkel);border-color:var(--dunkel);color:#fff}
.gisk .schalter.an.lila{background:var(--violett);border-color:var(--violett)}
.gisk .eintrag>i.lila{background:var(--violett)}
.gisk .eintrag>i.petrol{background:#0E7490}
.gisk .segment.ansicht{margin:0 0 14px}
.gisk .segment.ansicht button{flex:1;height:36px}
.gisk .mappen{display:flex;flex-direction:column;gap:8px}
.gisk .mappe{border:1px solid var(--linie);border-radius:4px;overflow:hidden;background:var(--weiss)}
.gisk .mappe.auf{border-color:var(--violett)}
.gisk .mappe.gel.auf{border-color:#0E7490}
.gisk .mappe-kopf{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:12px 14px;border:0;background:none;text-align:left;cursor:pointer}
.gisk .mappe-kopf:hover{background:var(--fl)}
.gisk .mappe-kopf .text{flex:1;min-width:0}
.gisk .mappe-kopf b{display:block;font-weight:600;font-size:15px}
.gisk .mappe-kopf small{display:block;color:var(--grau);font-size:12px}
.gisk .mappe-kopf .pfeil{font-size:20px;color:var(--grau);width:24px;text-align:center}
.gisk .mappe-inhalt{padding:0 14px 14px}
.gisk .rolle{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:13px;margin:12px 0 16px}
.gisk .rolle dt{color:var(--grau)}.gisk .rolle dd{margin:0;font-weight:600}

.gisk .filterblock{position:absolute;z-index:650;top:76px;left:16px;right:416px;display:flex;flex-direction:column;gap:6px;pointer-events:none}
.gisk .filter{display:flex;gap:6px;flex-wrap:wrap;align-items:center;pointer-events:auto;align-self:flex-start;max-width:100%}
.gisk .filter select{appearance:none;-webkit-appearance:none;field-sizing:content;border:0;background:var(--weiss) no-repeat right 10px center/9px url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%2364748B' stroke-width='1.6'/%3E%3C/svg%3E");padding:6px 26px 6px 12px;border-radius:3px;cursor:pointer;font:inherit;font-size:13px;font-weight:500;color:var(--tinte);box-shadow:var(--schatten)}
.gisk .filter select.an{background-color:var(--dunkel);color:#fff}
.gisk .filter .titel{font-size:12px;font-weight:600;color:var(--grau);background:var(--weiss);padding:6px 10px;border-radius:3px;box-shadow:var(--schatten)}
.gisk .filter button{border:0;background:var(--weiss);padding:7px 12px;border-radius:3px;cursor:pointer;font-size:13px;font-weight:500;box-shadow:var(--schatten)}
.gisk .filter button.an{background:var(--dunkel);color:#fff}
.gisk .filter.genau button{font-size:12px;padding:5px 10px}

.gisk .unten{position:absolute;z-index:650;left:16px;bottom:16px;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.gisk .legende{background:var(--weiss);border-radius:4px;box-shadow:var(--schatten);padding:8px 12px;display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--grau)}
.gisk .legende i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.gisk .legende.bild{flex-direction:column;gap:6px;padding:0}
.gisk .legende-knopf{border:0;background:none;padding:8px 12px;font-size:12px;font-weight:600;color:var(--grau);cursor:pointer;display:flex;gap:8px;min-height:36px;align-items:center}
.gisk .legende.bild img{max-height:220px;display:block;padding:0 12px 10px}
.gisk .readout{background:rgba(255,255,255,.92);border-radius:4px;box-shadow:var(--schatten);padding:6px 10px;font-size:12px;color:var(--grau);font-variant-numeric:tabular-nums}

.gisk .tafel{position:absolute;z-index:700;top:16px;right:16px;bottom:16px;width:384px;background:var(--weiss);
  border:1px solid var(--linie);border-radius:4px;box-shadow:var(--schatten);overflow-y:auto;padding:20px}
.gisk .kopf{margin-bottom:16px}
.gisk .zurueck{border:0;background:none;color:var(--grau);cursor:pointer;padding:0;margin-bottom:10px;font-size:13px}
.gisk .zurueck:hover{color:var(--tinte)}
.gisk .ueber{margin:0 0 4px;font-size:12px;font-weight:600;color:var(--grau);letter-spacing:.02em}
/* Die Karte setzt ihre Schrift selbst; für h3 fehlte das früher, die
   Bausteine darin standen in der Serifenschrift der Anwendung. */
.gisk h3{font-family:inherit!important}
.gisk h2{font-family:inherit!important;margin:0;font-size:26px;line-height:1.15;font-weight:500;letter-spacing:-.02em}
.gisk .sanft{color:var(--grau);margin:6px 0 0;font-size:13px}
.gisk .sanft.block{margin:0 0 12px}
.gisk .marken{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.gisk .marke{font-size:12px;font-weight:500;padding:3px 8px;border-radius:2px;background:var(--fl);color:var(--tinte)}
.gisk .marke.blau{background:rgba(61,69,245,.1);color:var(--akzent)}.gisk .marke.grau{color:var(--grau)}

.gisk .zahlen{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
.gisk .zahlen>div{background:var(--weiss);border:1px solid var(--linie);border-radius:4px;padding:10px 12px;min-width:0}
.gisk .zahlen .breit{grid-column:1 / -1}
.gisk .zahlen small{display:block;font-size:10.5px;font-weight:500;color:var(--grau);margin-bottom:2px;text-transform:uppercase;letter-spacing:.04em}
.gisk .zahlen b{font-size:16px;font-weight:500;word-break:break-word}

.gisk .aktionen{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}
.gisk .knopf,.gisk .copy{display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 14px;border-radius:3px;border:1px solid var(--linie);
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
  border-radius:4px;padding:10px 12px;cursor:pointer}
.gisk .eintrag:hover{border-color:var(--tinte)}
.gisk .eintrag.still{cursor:default}
.gisk .eintrag.still:hover{border-color:var(--linie)}
.gisk .kopf .knopf{margin-top:10px}
.gisk .import .feld{display:flex;flex-direction:column;gap:4px;margin:0 0 10px;font-size:12px;font-weight:600;color:var(--grau)}
.gisk .import .feld input,.gisk .import .feld select,.gisk .import .feld textarea{font:inherit;font-size:16px;font-weight:400;color:var(--tinte);
  border:1px solid var(--linie);border-radius:4px;padding:9px 11px;background:var(--weiss);min-height:44px;width:100%;box-sizing:border-box}
.gisk .import .feld textarea{resize:vertical;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:13px;line-height:1.5}
.gisk .import .zwei{display:grid;grid-template-columns:1fr 1.6fr;gap:8px}
.gisk .import .datei{cursor:pointer;margin:0 0 14px}
.gisk .import .leiste-unten{display:flex;justify-content:flex-end;gap:8px;margin:14px 0}
.gisk .import .knopf{height:44px;padding:0 16px}
.gisk .knopf.haupt{background:var(--tinte);border-color:var(--tinte);color:#fff;font-weight:500}
.gisk .knopf:disabled{opacity:.45;cursor:default}
.gisk .fehlertext{color:#DC2626;font-size:13px;margin:8px 0}
/* Beim Gegenlesen zählt der ganze Grund, nicht ein abgeschnittener. */
.gisk .import .eintrag small,.gisk .import .eintrag b{white-space:normal;overflow:visible;text-overflow:clip}
.gisk .eintrag>i{width:10px;height:36px;border-radius:4px;flex:none}
.gisk .eintrag .text{flex:1;min-width:0}
.gisk .eintrag b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gisk .eintrag small{display:block;color:var(--grau);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gisk .betrag{font-weight:600;color:var(--violett)}
.gisk-tip{font:13px/1.45 Urbanist,system-ui,sans-serif;border-radius:3px;border:0;box-shadow:0 8px 24px rgba(15,23,42,.2);padding:8px 11px}

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
  .gisk .segment{flex:none}
  .gisk .segment button{padding:7px 6px;font-size:13px}
  .gisk .schalter{flex:none;padding:0 7px;font-size:13px;height:38px}
  .gisk .werkzeuge{gap:4px}
  .gisk .filterblock{top:120px;left:12px;right:12px;gap:2px}
  .gisk .filter{flex-wrap:nowrap;overflow-x:auto;padding:0 0 6px;scrollbar-width:none;align-self:stretch}
  .gisk .filter::-webkit-scrollbar{display:none}
  .gisk .filter button,.gisk .filter .titel,.gisk .filter select{flex:none}
  .gisk .leaflet-control-zoom,.gisk .leaflet-bottom.leaflet-right,.gisk .legende:not(.bild),.gisk .readout{display:none}
  .gisk .tafel{top:auto;left:0;right:0;bottom:0;width:auto;height:34vh;border-radius:4px 4px 0 0;padding:12px 16px 16px}
  .gisk .tafel::before{content:"";display:block;width:36px;height:4px;border-radius:2px;background:var(--linie);margin:0 auto 12px}
  .gisk.offen .tafel{height:64vh}
  /* Ein Formular braucht Platz; die Karte darüber hilft beim Ausfüllen nicht. */
  .gisk .tafel:has(.import){height:86vh}
  .gisk .unten{left:12px;bottom:calc(34vh + 12px)}
  .gisk.offen .unten{bottom:calc(64vh + 12px)}
  .gisk h2{font-size:18px}
}

/* ---------------------------------------------------------------
   Handy (DESIGN.md, Karte): die Karte zuerst. Oben eine schlanke
   Leiste (zurück, Suche, Filter, Ebenen); Filter und Ebenen in Blättern
   von unten; aktive Filter als eine Zeile; die Tafel unten in drei
   Stufen, eingeklappt, sobald man die Karte bewegt.
   --------------------------------------------------------------- */
.gisk .nur-handy,.gisk .nur-handy-flex{display:none}
.gisk .sym{width:20px;height:20px}
.gisk .rund .zahl{font-size:13px;font-weight:600;margin-left:4px}
.gisk .blatt-grund{position:fixed;inset:0;z-index:900;background:rgba(17,17,17,.38);display:flex;align-items:flex-end;justify-content:center}
.gisk .blatt{background:var(--weiss);width:100%;max-width:560px;max-height:84vh;overflow-y:auto;border-radius:6px 6px 0 0;
  padding:14px 16px calc(14px + env(safe-area-inset-bottom));animation:gisk-hoch .26s cubic-bezier(.2,.7,.2,1)}
@keyframes gisk-hoch{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
.gisk .blatt-kopf{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.gisk .blatt-kopf h3{margin:0;font-size:22px;font-weight:500;letter-spacing:-.01em}
.gisk .blatt-titel{margin:18px 0 8px;font-size:11px;font-weight:500;color:var(--grau);text-transform:uppercase;letter-spacing:.05em}
.gisk .chips{display:flex;flex-wrap:wrap;gap:8px}
.gisk .chips button{height:42px;padding:0 14px;border:1px solid var(--linie);border-radius:3px;background:var(--weiss);font-size:15px;cursor:pointer}
.gisk .chips button.an{background:var(--dunkel);border-color:var(--dunkel);color:#fff}
.gisk .chips.klein{margin-top:8px}.gisk .chips.klein button{height:36px;font-size:13px;padding:0 10px}
.gisk .blatt-fuss{position:sticky;bottom:calc(-14px - env(safe-area-inset-bottom));display:grid;grid-template-columns:1fr 1.6fr;gap:8px;
  margin:20px -16px 0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:var(--weiss);border-top:1px solid var(--linie)}
.gisk .blatt-fuss .knopf{height:48px;justify-content:center;font-size:15px}
.gisk .segment.voll{display:flex;margin:6px 0 10px}.gisk .segment.voll button{flex:1;height:42px;font-size:15px}
.gisk .schalt-zeile{display:flex;width:100%;align-items:center;justify-content:space-between;gap:16px;min-height:62px;padding:8px 0;
  border:0;border-bottom:1px solid var(--linie);background:none;text-align:left;cursor:pointer}
.gisk .schalt-zeile b{display:block;font-weight:500;font-size:16px}.gisk .schalt-zeile small{display:block;color:var(--grau);font-size:13px}
.gisk .schalt{flex:none;position:relative;width:50px;height:30px;border-radius:4px;background:var(--linie);transition:background .2s}
.gisk .schalt::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:3px;background:#fff;
  box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s}
.gisk .schalt.an{background:var(--dunkel)}.gisk .schalt.an::after{transform:translateX(20px)}

@media (max-width:900px){
  .gisk .nur-handy{display:inline-grid;place-items:center}
  .gisk .nur-handy-flex{display:flex}
  .gisk .werkzeuge,.gisk .filterblock{display:none!important}
  .gisk .leiste{top:calc(8px + env(safe-area-inset-top));left:8px;right:8px;flex-wrap:nowrap;gap:6px;padding:6px}
  .gisk .rund{width:44px;height:44px;flex:none;display:inline-grid;place-items:center;grid-auto-flow:column;color:var(--tinte)}
  .gisk .rund.an{background:var(--dunkel);color:#fff;width:auto;padding:0 12px}
  .gisk .suche{flex:1 1 auto;min-width:0}
  .gisk .suche input{height:44px;font-size:16px}
  .gisk .aktiv-zeile{position:absolute;z-index:690;top:calc(70px + env(safe-area-inset-top));left:8px;right:8px;gap:6px;overflow-x:auto;scrollbar-width:none}
  .gisk .aktiv-zeile::-webkit-scrollbar{display:none}
  .gisk .aktiv-zeile button{flex:none;display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 10px;border:0;border-radius:3px;
    background:var(--dunkel);color:#fff;font-size:13px;box-shadow:var(--schatten);cursor:pointer}
  .gisk .aktiv-zeile .x{width:14px;height:14px;opacity:.8}
  .gisk .tafel{height:auto;padding:0 16px 16px;border-radius:6px 6px 0 0;transition:height .28s cubic-bezier(.2,.7,.2,1)}
  .gisk .tafel::before{display:none}
  .gisk .tafel.stufe-klein{height:140px;overflow:hidden}
  .gisk .tafel.stufe-mittel{height:48vh}
  .gisk .tafel.stufe-gross{height:86vh}
  .gisk .griff{display:flex;position:sticky;top:0;z-index:2;width:calc(100% + 32px);margin:0 -16px 2px;height:40px;align-items:center;justify-content:center;
    border:0;background:var(--weiss);cursor:pointer}
  .gisk .griff i{display:block;width:40px;height:4px;border-radius:2px;background:var(--linie)}
  .gisk .unten{bottom:144px;left:8px}
  .gisk.offen .unten{display:none}
}
`;
