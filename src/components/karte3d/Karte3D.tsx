import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BoundingSphere, Cartesian2, Cartesian3, Cartographic, Cesium3DTileColorBlendMode, Cesium3DTileFeature, Cesium3DTileStyle,
  Cesium3DTileset, CesiumTerrainProvider, ClassificationType, Color, ColorMaterialProperty, ConstantProperty, Credit, Entity,
  GeoJsonDataSource, HeadingPitchRange, ImageryLayer, Ion, JulianDate, Math as CMath, PolygonHierarchy, Rectangle,
  sampleTerrainMostDetailed, ScreenSpaceEventHandler, ScreenSpaceEventType, ShadowMode, UrlTemplateImageryProvider, Viewer,

  type Cesium3DTile,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { Compass, Layers, Loader2, Minus, Plus, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { umrissVomBund } from '@/hooks/use-portfolio';
import { parallel } from '@/lib/parallel';
import { Suche3D } from '@/components/karte3d/Suche3D';
import { useUrlSetzen } from '@/hooks/use-url-wert';
import {
  BAUJAHR_STUFEN, baujahrFarbe, GEBAEUDE_URL, GEBAEUDE_ZH_URL, gebaeudeLaden, inZuerich, GELAENDE_URL, HEIZ_GRUPPEN, heizGruppe, HOEHE_STUFEN,
  dachSpanne, gebaeudeBeimBund, hoeheFarbe, punktImRing, type Ort, kodesLaden, LUFTBILD_URL, MODELL_URL, ZONEN_LEGENDE, zonenArt, zonenUm, type Gebaeude,
} from '@/lib/karte3d';

declare const __CESIUM_BASIS__: string;
// Cesium sucht seine Worker unter dieser Adresse (vite.config.ts).
(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = __CESIUM_BASIS__;
// Kein Cesium-ion-Konto: alles kommt vom Bund und vom Kanton.
Ion.defaultAccessToken = '';

export type Faerbung = 'modell' | 'heizung' | 'baujahr' | 'hoehe' | 'reserve';
export interface Markierung { egrid: string; farbe: string; titel?: string }

const FAERBUNGEN: { wert: Faerbung; titel: string }[] = [
  { wert: 'modell', titel: 'Modell' }, { wert: 'heizung', titel: 'Heizung' }, { wert: 'baujahr', titel: 'Baujahr' },
  { wert: 'hoehe', titel: 'Höhe' }, { wert: 'reserve', titel: 'Reserve' },
];
const WEISS = Color.fromCssColorString('#F4F2EE');
const KEINE: Markierung[] = [];
const BLAU = '#3D45F5';
/**
 * Die Kacheln des Bundes gibt es nur über der Schweiz; ausserhalb antwortet
 * der Dienst mit 400 (nachgesehen am 3. November: 6/33/21 liegt nördlich
 * davon). Ab Stufe 6 deckt eine einzige Kachel das ganze Land.
 */
const SCHWEIZ = Rectangle.fromDegrees(5.9, 45.8, 10.5, 47.85);
/**
 * Feste Sonne statt der Uhrzeit des Betrachters: Mitte April, früher
 * Nachmittag. Die Sonne steht dann im Südwesten, hinter der Kamera, die
 * von Südwesten blickt -- die Fassaden sind hell, die Schatten fallen
 * vom Betrachter weg. Abends geöffnet wäre die Stadt sonst schwarz.
 */
const SONNE = JulianDate.fromIso8601('2026-04-15T12:30:00Z');
/**
 * Bodenhöhe, bis das Gelände die echte kennt: Zürich liegt um 410 m. Das
 * Gelände des Bundes rechnet in derselben Höhe wie der GELAENDEPUNKT der
 * Häuser (nachgemessen: Median der Differenz 0.1 m über 20 Häuser).
 */
const BODEN_SCHAETZUNG = 420;
const KATASTER_URL = 'https://wmts.geo.admin.ch/1.0.0/ch.kantone.cadastralwebmap-farbe/default/current/3857/{z}/{x}/{y}.png';
const GROSS = () => !!window.matchMedia?.('(min-width: 1024px)').matches;
const leise = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const n = (x: number | null | undefined, e = '') => (x == null ? '–' : `${Math.round(x).toLocaleString('de-CH')}${e}`);

interface Auswahl {
  egid: number | null; hoehe: number | null; dachMin: number | null; dachMax: number | null; gelaende: number | null;
  objektart: string | null; geb?: Gebaeude | null; parzelleId?: string | null; adresse?: string | null;
}

/**
 * Die 3D-Karte: Gelände und Luftbild des Bundes, jedes Gebäude mit echtem
 * Umriss, Dach und Höhe (swissBUILDINGS3D), am Boden die Zonen des
 * Kantons, und jedes Haus nach unseren Daten eingefärbt -- Heizung,
 * Baujahr, Höhe, Ausnützungsreserve. Ein Klick auf ein Haus zeigt, was
 * das Register und der Bestand darüber wissen, und den Umriss der
 * Parzelle.
 *
 * `ziel` setzt die Kamera (Blick schräg von Südwesten, wie im Video).
 * `markiert` färbt die Häuser bestimmter Parzellen (eigenes Objekt,
 * Fonds) und zieht ihren Umriss am Boden nach.
 */
export function Karte3D({ ziel: zielVon, markiert: markiertVon = KEINE, legende, faerbungen = FAERBUNGEN.map(f => f.wert), start = 'modell', intern = true, hoehe = 'h-full', onOrt }: {
  ziel: { lat: number; lon: number; abstand?: number } | null;
  markiert?: Markierung[];
  /** Ein Ort aus der Suche wurde gewählt -- z.B. um ihn in die Adresse zu schreiben. */
  onOrt?: (o: Ort) => void;
  /** Was die Farben der markierten Häuser bedeuten (z.B. Fonds 1, Fonds 2). */
  legende?: { titel: string; farbe: string }[];
  faerbungen?: Faerbung[];
  start?: Faerbung;
  /** Unsere Konten: Reserve und "Objekt öffnen". Fondsleitungen nicht. */
  intern?: boolean;
  hoehe?: string;
}) {
  // Ein Treffer der Suche geht dem Ziel von aussen vor, bis dieses wechselt.
  const [sprung, setSprung] = useState<Ort | null>(null);
  useEffect(() => {
    if (sprung && zielVon && (Math.abs(zielVon.lat - sprung.lat) > 1e-5 || Math.abs(zielVon.lon - sprung.lon) > 1e-5)) setSprung(null);
  }, [zielVon?.lat, zielVon?.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  const ziel = useMemo(() => (sprung ? { lat: sprung.lat, lon: sprung.lon, abstand: sprung.abstand } : zielVon), [sprung, zielVon]);
  const markiert = useMemo(() => (sprung?.egrid && !markiertVon.some(m => m.egrid === sprung.egrid)
    ? [...markiertVon, { egrid: sprung.egrid, farbe: BLAU, titel: sprung.titel }] : markiertVon), [sprung, markiertVon]);
  const box = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const tiles = useRef<Cesium3DTileset | null>(null);
  const quelle = useRef<string | null>(null);
  const grund = useRef<ImageryLayer | null>(null);
  const kataster = useRef<ImageryLayer | null>(null);
  const zonenQuelle = useRef<GeoJsonDataSource | null>(null);
  const daten = useRef(new Map<number, Gebaeude>());
  const reserve = useRef(new Map<string, number>());
  const offen = useRef(new Set<number>());
  const gewaehlt = useRef<number | null>(null);
  const markierteFarbe = useRef(new Map<string, Color>());
  /** Umrisse der markierten Parzellen in WGS84, mit Rahmen zum schnellen Aussortieren. */
  const umrisse = useRef<{ farbe: Color; ringe: number[][][]; rahmen: [number, number, number, number] }[]>([]);
  const [bereit, setBereit] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [faerbung, setFaerbung] = useState<Faerbung>(start);
  const faerbungRef = useRef(faerbung);
  faerbungRef.current = faerbung;
  const [luftbild, setLuftbild] = useState(false);
  const [zonen, setZonen] = useState(true);
  const [zonenLaden, setZonenLaden] = useState(false);
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null);
  const [legendeZu, setLegendeZu] = useState(false);
  const [stumm, setStumm] = useState<string | null>(null);
  const [geladen, setGeladen] = useState(0);
  const setzen = useUrlSetzen();
  const { data: kodes } = useQuery({ queryKey: ['gwr-kodes'], queryFn: kodesLaden, staleTime: 24 * 3600 * 1000 });
  const kodesRef = useRef(kodes);
  kodesRef.current = kodes;

  markierteFarbe.current = useMemo(() => new Map(markiert.map(m => [m.egrid, Color.fromCssColorString(m.farbe)])), [markiert]);

  // ------------------------------------------------- Karte einmal anlegen
  useEffect(() => {
    if (!box.current) return;
    let weg = false;
    const v = new Viewer(box.current, {
      animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false,
      sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false,
      selectionIndicator: false, baseLayer: false, requestRenderMode: true, maximumRenderTimeChange: Infinity,
      shadows: false, skyBox: false,
      // Cesium zeichnet sonst mit einfacher Pixeldichte -- auf dem iPhone
      // (Faktor 3) unscharf. Höchstens doppelt: mehr kostet Akku, ohne
      // dass man es sieht.
      useBrowserRecommendedResolution: false,
    });
    v.resolutionScale = Math.min(window.devicePixelRatio || 1, 2) / (window.devicePixelRatio || 1);
    viewer.current = v;
    v.scene.globe.depthTestAgainstTerrain = true;
    v.scene.globe.baseColor = Color.fromCssColorString('#E9E6DF');
    v.scene.backgroundColor = Color.fromCssColorString('#DCE6EF');
    v.scene.globe.showGroundAtmosphere = false;
    v.scene.fog.enabled = true;
    v.scene.screenSpaceCameraController.minimumZoomDistance = 40;
    v.scene.screenSpaceCameraController.maximumZoomDistance = 25000;
    v.clock.currentTime = SONNE.clone();
    v.clock.shouldAnimate = false;
    if (v.scene.sun) v.scene.sun.show = false;
    if (v.scene.moon) v.scene.moon.show = false;
    // Desktop: Sonne und Schatten machen die Höhen lesbar. Auf dem Handy
    // kosten sie zu viel Akku.
    const gross = GROSS();
    if (gross) {
      v.shadows = true;
      v.shadowMap.softShadows = true;
      v.shadowMap.darkness = 0.55;
      v.scene.globe.enableLighting = false;
    }
    v.creditDisplay.addStaticCredit(new Credit('© swisstopo, Kanton Zürich'));

    (async () => {
      try {
        // Ohne Normalen: die Beleuchtung des Geländes ist aus, sie würden
        // nur jede Geländekachel grösser machen.
        const gelaende = await CesiumTerrainProvider.fromUrl(GELAENDE_URL);
        if (weg) return;
        v.terrainProvider = gelaende;
        await gebaeudeSetzen(ziel && !inZuerich(ziel.lat, ziel.lon) ? GEBAEUDE_URL : GEBAEUDE_ZH_URL);
        if (weg) return;
        setBereit(true);
      } catch (e) {
        setFehler(e instanceof Error ? e.message : String(e));
      }
    })();

    const klick = new ScreenSpaceEventHandler(v.scene.canvas);
    klick.setInputAction((ev: { position: Cartesian2 }) => void waehlen(v.scene.pick(ev.position)), ScreenSpaceEventType.LEFT_CLICK);
    return () => { weg = true; klick.destroy(); v.destroy(); viewer.current = null; tiles.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------------- Grundkarte
  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    if (grund.current) v.imageryLayers.remove(grund.current, true);
    grund.current = v.imageryLayers.addImageryProvider(new UrlTemplateImageryProvider({
      url: luftbild ? LUFTBILD_URL : MODELL_URL, maximumLevel: luftbild ? 20 : 19, credit: '© swisstopo',
      rectangle: SCHWEIZ, minimumLevel: 6,
    }), 0);
    // Im Modell hell wie Papier, damit Zonen und Häuser die Farbe tragen.
    if (!luftbild) { grund.current.saturation = 0; grund.current.brightness = 1.25; grund.current.contrast = 0.7; }
    v.scene.requestRender();
  }, [luftbild]);

  // ------------------------------------------- Parzellengrenzen (nah)
  // Als fertige Kacheln (WMTS) statt gezeichnet (WMS): der WMS-Dienst
  // zeichnete jede Kachel neu, 87 Anfragen beim Öffnen. Und erst ab Stufe
  // 16 -- ab 15 waren es 216 Kacheln bis zum Horizont, und von weiter weg
  // sind Parzellengrenzen nur ein Grauschleier.
  useEffect(() => {
    const v = viewer.current;
    if (!v || kataster.current) return;
    kataster.current = v.imageryLayers.addImageryProvider(new UrlTemplateImageryProvider({
      url: KATASTER_URL, rectangle: SCHWEIZ, minimumLevel: 16, maximumLevel: 19, credit: '© Kantone',
    }));
    kataster.current.alpha = 0.45;
    v.scene.requestRender();
  }, [bereit]);

  // ----------------------------------------------------- Selbstprüfung
  // Julian sah am 3. November eine leere Fläche: geladen, aber nichts
  // gezeichnet -- im Testbrowser lief es. Ohne die Worker von Cesium wird
  // keine Hauskachel fertig und das Gelände nie vollständig. Ist nach 30
  // Sekunden beides so, sagt die Karte das und nennt, was sie vorfindet.
  // Gezählt werden fertig entpackte Hauskacheln aus der Statistik von
  // Cesium (intern, aber die Fassung ist festgehalten; fehlt sie, bleibt
  // der Hinweis aus). Beides im Test nachgesehen: tileLoad feuert schon
  // vor dem Entpacken, und die Liste der gezeichneten Geländekacheln war
  // leer, obwohl Gelände und Häuser zu sehen waren.
  // Zwei Stufen, weil ein langsames Gerät nicht als kaputt gelten soll
  // (der Testbrowser ohne Grafikkarte hatte nach 37 s noch keine Kachel
  // fertig, mit 26 geladenen Workern): nach 30 s nur, wenn gar kein Worker
  // geladen ist; nach 90 s, wenn trotz Workern nichts fertig wurde.
  useEffect(() => {
    if (!bereit) return;
    const pruefen = (stufe: 1 | 2) => {
      const v = viewer.current;
      if (!v || v.isDestroyed()) return;
      const fertig = (tiles.current as unknown as { _statistics?: { numberOfTilesWithContentReady?: number } } | null)
        ?._statistics?.numberOfTilesWithContentReady ?? 1;
      if (fertig > 0 || v.scene.globe.tilesLoaded) return;
      const worker = performance.getEntriesByType('resource').filter(e => e.name.includes('/Workers/')).length;
      if (stufe === 1 && worker > 0) return;
      setStumm(`WebGL ${(v.scene as unknown as { context?: { webgl2?: boolean } }).context?.webgl2 ? '2' : '1'} · Rechenhilfen geladen: ${worker} · ${navigator.userAgent.match(/(Version\/[\d.]+ Safari|Chrome\/[\d.]+|Firefox\/[\d.]+|Edg\/[\d.]+)/)?.[0] ?? 'Browser unbekannt'}`);
    };
    const t1 = window.setTimeout(() => pruefen(1), 30000);
    const t2 = window.setTimeout(() => pruefen(2), 90000);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [bereit]);

  // ------------------------------------------------- Quelle der Gebäude
  // Ausserhalb von Zürich kennt unser Verzeichnis keine Häuser: dort das
  // des Bundes. Gewechselt wird nur, wenn ein Ziel es verlangt.
  useEffect(() => {
    if (!bereit || !ziel) return;
    const soll = inZuerich(ziel.lat, ziel.lon) ? GEBAEUDE_ZH_URL : GEBAEUDE_URL;
    if (quelle.current && quelle.current !== soll && quelle.current !== GEBAEUDE_URL) void gebaeudeSetzen(soll).catch(() => {});
  }, [ziel?.lat, ziel?.lon, bereit]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------- Kamera
  // Sofort an den Ort statt vom Erdball her anzufliegen: der Anflug lud
  // unterwegs Gelände und Karten der halben Welt. Die Bodenhöhe ist zuerst
  // geschätzt und wird nachgeführt, sobald das Gelände sie kennt. Ein
  // späteres Ziel (andere Liegenschaft) fliegt die Kamera kurz an.
  const erstesZiel = useRef(true);
  useEffect(() => {
    const v = viewer.current;
    if (!v || !ziel) return;
    let weg = false;
    const setzen = (boden: number, dauer: number) => {
      v.camera.flyToBoundingSphere(new BoundingSphere(Cartesian3.fromDegrees(ziel.lon, ziel.lat, boden + 10), 60), {
        offset: new HeadingPitchRange(CMath.toRadians(35), CMath.toRadians(-32), ziel.abstand ?? 520), duration: dauer,
      });
      v.scene.requestRender();
    };
    if (erstesZiel.current && !bereit) setzen(BODEN_SCHAETZUNG, 0);
    if (bereit) {
      (async () => {
        const [p] = await sampleTerrainMostDetailed(v.terrainProvider, [Cartographic.fromDegrees(ziel.lon, ziel.lat)]).catch(() => [null]);
        if (weg) return;
        const boden = p?.height ?? BODEN_SCHAETZUNG;
        if (erstesZiel.current) { erstesZiel.current = false; setzen(boden, 0); }
        else setzen(boden, leise() ? 0 : 1.2);
      })();
    }
    return () => { weg = true; };
  }, [ziel?.lat, ziel?.lon, ziel?.abstand, bereit]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------- Zonen am Boden
  useEffect(() => {
    const v = viewer.current;
    if (!v || !ziel) return;
    const ab = new AbortController();
    (async () => {
      if (zonenQuelle.current) { v.dataSources.remove(zonenQuelle.current, true); zonenQuelle.current = null; }
      if (!zonen) { v.scene.requestRender(); return; }
      setZonenLaden(true);
      try {
        const fc = await zonenUm(ziel.lat, ziel.lon, 650, ab.signal);
        if (!fc || ab.signal.aborted) return;
        const q = await GeoJsonDataSource.load(fc, { clampToGround: true });
        if (ab.signal.aborted) return;
        for (const e of q.entities.values) {
          if (!e.polygon) continue;
          const art = zonenArt(String(e.properties?.typ_zh_code?.getValue() ?? ''));
          e.polygon.material = new ColorMaterialProperty(Color.fromCssColorString(art.farbe).withAlpha(luftbild ? 0.45 : 0.8));
          // Nur den Boden einfärben, nicht die Häuser -- wie im Video.
          e.polygon.classificationType = new ConstantProperty(ClassificationType.TERRAIN);
          e.polygon.outline = new ConstantProperty(false);
        }
        zonenQuelle.current = q;
        await v.dataSources.add(q);
        v.scene.requestRender();
      } catch { /* ausserhalb ZH oder Dienst nicht erreichbar: ohne Zonen */ }
      finally { if (!ab.signal.aborted) setZonenLaden(false); }
    })();
    return () => ab.abort();
  }, [ziel?.lat, ziel?.lon, zonen, luftbild, bereit]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----------------------------------- Umrisse der markierten Parzellen
  useEffect(() => {
    const v = viewer.current;
    if (!v || !bereit) return;
    const eigene: Entity[] = [];
    let weg = false;
    umrisse.current = [];
    // Vier zugleich: nacheinander dauern 60 Umrisse beim Bund zu lange,
    // alle zugleich drosselt er (lib/parallel).
    void parallel(markiert.slice(0, 80), 4, async m => {
      const g = await umrissVomBund(m.egrid).catch(() => null);
      if (weg) return;
      const ringe = (g?.type === 'Polygon' ? [g.coordinates[0]] : g?.type === 'MultiPolygon' ? g.coordinates.map(p => p[0]) : []) as number[][][];
      if (!ringe.length) return;
      const alle = ringe.flat();
      const lons = alle.map(p => p[0]), lats = alle.map(p => p[1]);
      umrisse.current.push({
        farbe: Color.fromCssColorString(m.farbe), ringe,
        rahmen: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
      });
      for (const ring of ringe) {
        eigene.push(v.entities.add({
          polygon: {
            hierarchy: new PolygonHierarchy(Cartesian3.fromDegreesArray(ring.flat())),
            material: Color.fromCssColorString(m.farbe).withAlpha(0.35),
            classificationType: ClassificationType.TERRAIN,
          },
          polyline: {
            positions: Cartesian3.fromDegreesArray(ring.flat()), width: 3, clampToGround: true,
            material: Color.fromCssColorString(m.farbe),
          },
        }));
      }
      tiles.current?.makeStyleDirty();
      v.scene.requestRender();
    });
    tiles.current?.makeStyleDirty();
    return () => {
      weg = true; umrisse.current = [];
      eigene.forEach(e => v.entities.remove(e)); tiles.current?.makeStyleDirty(); v.scene.requestRender();
    };
  }, [markiert, bereit]);

  // ---------------------------------------------- Färbung neu anwenden
  useEffect(() => {
    tiles.current?.makeStyleDirty();
    viewer.current?.scene.requestRender();
  }, [faerbung, kodes, geladen]);

  // ======================================================== Helfer
  /**
   * Die Gebäude laden, aus unserem Verzeichnis oder dem des Bundes. Fehlt
   * unseres (neue Fassung beim Bund, noch nicht nachgebaut), dann das des
   * Bundes -- langsamer, aber mit Häusern.
   */
  async function gebaeudeSetzen(url: string) {
    const v = viewer.current;
    if (!v) return;
    const gross = GROSS();
    // Häuser werfen Schatten aufs Gelände, empfangen aber keine: auf den
    // Wänden selbst gäbe das Streifen (im Test gesehen). 16 ist der
    // Standard von Cesium; das Handy zeichnet doppelt dicht und hat wenig
    // Speicher, dort 24.
    const optionen = {
      maximumScreenSpaceError: gross ? 16 : 24, shadows: gross ? ShadowMode.CAST_ONLY : ShadowMode.DISABLED,
      cacheBytes: (gross ? 768 : 256) * 1024 * 1024,
    };
    let ts: Cesium3DTileset;
    try {
      ts = await Cesium3DTileset.fromUrl(url, optionen);
    } catch (e) {
      if (url === GEBAEUDE_URL) throw e;
      url = GEBAEUDE_URL;
      ts = await Cesium3DTileset.fromUrl(url, optionen);
    }
    if (v.isDestroyed()) { ts.destroy(); return; }
    // Die Kacheln bringen rote Dächer und beige Wände mit. Ersetzen statt
    // mischen: sonst färbt "weiss" die Dächer rot und "Gas" violett-braun.
    ts.colorBlendMode = Cesium3DTileColorBlendMode.REPLACE;
    ts.tileLoad.addEventListener((tile: Cesium3DTile) => sammeln(tile));
    ts.style = stil();
    if (tiles.current) v.scene.primitives.remove(tiles.current);
    tiles.current = ts;
    quelle.current = url;
    v.scene.primitives.add(ts);
    v.scene.requestRender();
    // Für den Darstellungstest: Kacheln, Kamera und Häuser nachzählen statt raten.
    if (import.meta.env.DEV) (window as unknown as { karte3d: unknown }).karte3d = { v, ts, quelle: url };
  }

  /** Der Stil fragt bei jedem Haus die aktuelle Färbung und unsere Daten. */
  function stil(): Cesium3DTileStyle {
    const s = new Cesium3DTileStyle();
    (s as unknown as { color: unknown }).color = {
      evaluateColor: (f: Cesium3DTileFeature, ergebnis?: Color) => farbe(f).clone(ergebnis),
    };
    return s;
  }

  function farbe(f: Cesium3DTileFeature): Color {
    const egid = Number(f.getProperty('EGID')) || null;
    if (egid != null && egid === gewaehlt.current) return Color.fromCssColorString(BLAU);
    const geb = egid != null ? daten.current.get(egid) : undefined;
    const mark = geb?.egrid ? markierteFarbe.current.get(geb.egrid) : undefined;
    if (mark) return mark;
    if (umrisse.current.length) {
      const lon = Number(f.getProperty('Longitude')), lat = Number(f.getProperty('Latitude'));
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        for (const u of umrisse.current) {
          const [w, s, o, nord] = u.rahmen;
          if (lon >= w && lon <= o && lat >= s && lat <= nord && u.ringe.some(r => punktImRing(lon, lat, r))) return u.farbe;
        }
      }
    }
    const art = faerbungRef.current;
    let css: string | null = null;
    if (art === 'hoehe') css = hoeheFarbe(Number(f.getProperty('GESAMTHOEHE')) || null);
    else if (art === 'baujahr') css = baujahrFarbe(geb?.baujahr ?? null);
    else if (art === 'heizung') {
      const t = geb?.heizung_energie != null ? kodesRef.current?.get(`GENH:${geb.heizung_energie}`) : undefined;
      css = heizGruppe(t)?.farbe ?? null;
    } else if (art === 'reserve') {
      const r = geb?.egrid ? reserve.current.get(geb.egrid) : undefined;
      css = r == null ? null : r > 400 ? '#E2733A' : r > 150 ? '#F0B055' : r > 0 ? '#F7E3A1' : '#D9D9D9';
    }
    return css ? Color.fromCssColorString(css) : WEISS;
  }

  /** EGID der geladenen Kachel merken und Registerdaten nachladen. */
  function sammeln(tile: Cesium3DTile) {
    const c = tile.content;
    for (let i = 0; i < c.featuresLength; i++) {
      const egid = Number(c.getFeature(i).getProperty('EGID'));
      if (egid && !daten.current.has(egid)) offen.current.add(egid);
    }
    nachladen();
  }
  const zeitgeber = useRef<number | null>(null);
  function nachladen() {
    if (zeitgeber.current) return;
    zeitgeber.current = window.setTimeout(async () => {
      zeitgeber.current = null;
      const liste = [...offen.current].slice(0, 2000);
      liste.forEach(e => offen.current.delete(e));
      if (!liste.length) return;
      try {
        const rows = await gebaeudeLaden(liste);
        rows.forEach(g => daten.current.set(Number(g.egid), g));
        // Unbekannte nicht erneut fragen.
        liste.forEach(e => { if (!daten.current.has(e)) daten.current.set(e, { egid: e } as Gebaeude); });
        if (intern) {
          const egrids = [...new Set(rows.map(g => g.egrid).filter((x): x is string => !!x && !reserve.current.has(x)))];
          for (let i = 0; i < egrids.length; i += 150) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const r = await (supabase as any).from('properties').select('egrid, hnf_delta').in('egrid', egrids.slice(i, i + 150));
            ((r.data ?? []) as { egrid: string; hnf_delta: number | null }[]).forEach(p => reserve.current.set(p.egrid, p.hnf_delta ?? 0));
          }
        }
        setGeladen(x => x + 1);
      } catch { /* Register noch nicht geladen: die Häuser bleiben weiss */ }
      if (offen.current.size) nachladen();
    }, 350);
  }

  async function waehlen(objekt: unknown) {
    if (!(objekt instanceof Cesium3DTileFeature)) { gewaehlt.current = null; setAuswahl(null); tiles.current?.makeStyleDirty(); viewer.current?.scene.requestRender(); return; }
    const a = ausKachel(objekt);
    const egid = a.egid;
    gewaehlt.current = egid;
    tiles.current?.makeStyleDirty();
    viewer.current?.scene.requestRender();
    setAuswahl(a);
    if (egid) await einzelheiten(egid);
  }

  /** Register, Adresse und unser Objekt zu einem Haus nachladen. */
  async function einzelheiten(egid: number) {
    // Zuerst der Bund (tagesaktuell, mit Adresse), sonst unsere Tabelle.
    const bereits = daten.current.get(egid);
    const [bund, eigen] = await Promise.all([
      gebaeudeBeimBund(egid).catch(() => null),
      bereits?.baujahr !== undefined ? Promise.resolve(bereits) : gebaeudeLaden([egid]).then(r => r[0] ?? null).catch(() => null),
    ]);
    const geb = bund?.geb ?? eigen ?? null;
    let parzelleId: string | null = null, adresse: string | null = bund?.adresse ?? null;
    if (geb?.egrid) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (supabase as any).from('properties').select('id, address').eq('egrid', geb.egrid).limit(1);
      parzelleId = r.data?.[0]?.id ?? null; adresse = r.data?.[0]?.address ?? adresse;
    }
    setAuswahl(x => (x && x.egid === egid ? { ...x, geb, parzelleId, adresse } : x));
  }

  /** Was die Kachel des Bundes über ein Haus weiss. */
  function ausKachel(f: Cesium3DTileFeature): Auswahl {
    const zahl = (k: string) => { const x = Number(f.getProperty(k)); return Number.isFinite(x) && x !== 0 ? x : null; };
    return {
      egid: zahl('EGID'), hoehe: zahl('GESAMTHOEHE'), dachMin: zahl('DACH_MIN'), dachMax: zahl('DACH_MAX'), gelaende: zahl('GELAENDEPUNKT'),
      objektart: String(f.getProperty('OBJEKTART') ?? '').replace(/Gebaeude/g, 'Gebäude') || null,
    };
  }

  /** Das Haus mit dieser EGID in den geladenen Kacheln suchen. */
  function findeHaus(egid: number): Cesium3DTileFeature | null {
    const ts = tiles.current;
    if (!ts) return null;
    const stapel: Cesium3DTile[] = [ts.root];
    while (stapel.length) {
      const t = stapel.pop()!;
      const c = t.content;
      for (let i = 0; i < (c?.featuresLength ?? 0); i++) {
        const f = c.getFeature(i);
        if (Number(f.getProperty('EGID')) === egid) return f;
      }
      stapel.push(...t.children);
    }
    return null;
  }

  // Eine gesuchte Adresse: die Tafel sofort mit dem Register öffnen, Höhe
  // und Dach nachtragen, sobald die Kachel des Hauses da ist (bis 30 s).
  useEffect(() => {
    const egid = sprung?.egid;
    if (!egid || !bereit) return;
    gewaehlt.current = egid;
    tiles.current?.makeStyleDirty();
    setAuswahl({ egid, hoehe: null, dachMin: null, dachMax: null, gelaende: null, objektart: null });
    void einzelheiten(egid);
    let n = 0;
    const t = window.setInterval(() => {
      const f = findeHaus(egid);
      if (f) {
        window.clearInterval(t);
        setAuswahl(x => (x && x.egid === egid ? { ...x, ...ausKachel(f) } : x));
        viewer.current?.scene.requestRender();
      } else if (++n >= 30) window.clearInterval(t);
    }, 1000);
    return () => window.clearInterval(t);
  }, [sprung, bereit]);  

  const ortWaehlen = (o: Ort) => {
    gewaehlt.current = null;
    setAuswahl(null);
    setSprung(o);
    onOrt?.(o);
  };

  const zoom = (faktor: number) => {
    const v = viewer.current; if (!v) return;
    const h = v.camera.positionCartographic.height;
    if (faktor > 1) v.camera.zoomIn(h * 0.35); else v.camera.zoomOut(h * 0.5);
    v.scene.requestRender();
  };
  const norden = () => {
    const v = viewer.current; if (!v) return;
    v.camera.setView({ orientation: { heading: 0, pitch: v.camera.pitch, roll: 0 } });
    v.scene.requestRender();
  };

  const text = (merkmal: string, code: number | null | undefined) =>
    code == null ? '–' : kodes?.get(`${merkmal}:${code}`) ?? `Code ${code}`;
  const knopf = 'grid h-11 w-11 place-items-center rounded-[3px] bg-white text-[#111] shadow-[0_2px_8px_rgba(0,0,0,0.18)] hover:bg-[#f2f2f2]';
  const chip = (an: boolean) => `inline-flex h-9 shrink-0 items-center rounded-[3px] px-3 text-[13px] font-medium shadow-[0_1px_4px_rgba(0,0,0,0.16)] ${an ? 'bg-[#111] text-white' : 'bg-white text-[#111]'}`;
  const registerLeer = kodes != null && kodes.size === 0;

  return (
    <div className={`relative isolate overflow-hidden bg-[#DCE6EF] ${hoehe}`}>
      <div ref={box} className="absolute inset-0 [&_.cesium-viewer-bottom]:hidden [&_.cesium-widget-credits]:hidden" />

      {/* Oben die Suche, darunter die Färbung als Chips (auf dem Handy wischbar). */}
      <div className="absolute left-3 right-16 top-3 z-20 flex flex-col items-start gap-2">
      <Suche3D onWahl={ortWaehlen} />
      <div className="flex max-w-full gap-1.5 overflow-x-auto no-scrollbar">
        {FAERBUNGEN.filter(f => faerbungen.includes(f.wert) && (intern || f.wert !== 'reserve')).map(f => (
          <button key={f.wert} type="button" className={chip(faerbung === f.wert)} onClick={() => setFaerbung(f.wert)} aria-pressed={faerbung === f.wert}>{f.titel}</button>
        ))}
        <button type="button" className={chip(zonen)} onClick={() => setZonen(z => !z)} aria-pressed={zonen}>
          {zonenLaden ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}Zonen
        </button>
      </div>
      </div>

      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
        <button type="button" className={knopf} onClick={() => zoom(1.5)} aria-label="Näher" title="Näher"><Plus className="h-4 w-4" /></button>
        <button type="button" className={knopf} onClick={() => zoom(0.66)} aria-label="Weiter weg" title="Weiter weg"><Minus className="h-4 w-4" /></button>
        <button type="button" className={knopf} onClick={norden} aria-label="Nach Norden ausrichten" title="Nach Norden"><Compass className="h-4 w-4" /></button>
        <button type="button" className={knopf} onClick={() => setLuftbild(l => !l)} aria-label={luftbild ? 'Modell zeigen' : 'Luftbild zeigen'} title={luftbild ? 'Modell' : 'Luftbild'}><Layers className="h-4 w-4" /></button>
      </div>

      {/* Legende der gewählten Färbung, darunter die Zonen. Ein Tippen klappt
          sie zu: auf dem Handy deckte sie ein Drittel der Karte ab. */}
      {legendeZu ? (
        <button type="button" className={`absolute bottom-3 left-3 z-10 ${chip(false)} ${auswahl ? 'max-sm:hidden' : ''}`}
                onClick={() => setLegendeZu(false)} aria-expanded={false}>Legende</button>
      ) : (
        <button type="button" onClick={() => setLegendeZu(true)} aria-expanded aria-label="Legende einklappen"
                className={`absolute bottom-3 left-3 z-10 block max-w-[calc(100%-1.5rem)] space-y-1.5 rounded-[3px] bg-white/95 px-3 py-2 text-left text-[12px] text-[#111] shadow-[0_2px_8px_rgba(0,0,0,0.18)] sm:max-w-[360px] ${auswahl ? 'max-sm:hidden' : ''}`}>
          {faerbung === 'heizung' && (registerLeer
            ? <span className="block text-[#555]">Heizung: Register noch nicht geladen.</span>
            : <Legende eintraege={HEIZ_GRUPPEN.map(g => ({ titel: g.titel, farbe: g.farbe }))} />)}
          {faerbung === 'baujahr' && (registerLeer ? <span className="block text-[#555]">Baujahr: Register noch nicht geladen.</span> : <Legende eintraege={BAUJAHR_STUFEN} />)}
          {faerbung === 'hoehe' && <Legende eintraege={HOEHE_STUFEN} />}
          {faerbung === 'reserve' && <Legende eintraege={[{ titel: 'über 400 m²', farbe: '#E2733A' }, { titel: '150–400 m²', farbe: '#F0B055' }, { titel: 'bis 150 m²', farbe: '#F7E3A1' }, { titel: 'keine', farbe: '#D9D9D9' }]} />}
          {legende?.length ? <Legende eintraege={legende} /> : null}
          {faerbung === 'modell' && !legende?.length && <span className="block text-[#555]">Jedes Gebäude mit Umriss, Dach und Höhe vom Bund.</span>}
          {zonen && <span className="block border-t border-black/10 pt-1.5"><Legende eintraege={ZONEN_LEGENDE} klein /></span>}
        </button>
      )}

      {auswahl && (
        // Auf dem Handy ein Blatt am unteren Rand: oben bleiben Färbung und Zoom frei.
        <div className="absolute bottom-3 right-3 z-20 w-[min(340px,calc(100%-1.5rem))] rounded-[3px] bg-white p-4 text-[#111] shadow-[0_8px_24px_rgba(0,0,0,0.18)] max-sm:inset-x-0 max-sm:bottom-0 max-sm:w-auto max-sm:rounded-b-none max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-[#666]">{auswahl.objektart ?? 'Gebäude'}{auswahl.egid ? ` · EGID ${auswahl.egid}` : ''}</p>
              <p className="truncate text-lg font-semibold">{auswahl.adresse ?? (auswahl.geb === undefined ? 'wird nachgesehen …' : 'Gebäude')}</p>
            </div>
            <button type="button" className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center" aria-label="Schliessen"
                    onClick={() => void waehlen(null)}><X className="h-4 w-4" /></button>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2.5 text-sm sm:grid-cols-2">
            <Wert t="Höhe" w={n(auswahl.hoehe, ' m')} />
            <Wert t="Dach über Boden" w={dachSpanne(auswahl.dachMin, auswahl.dachMax, auswahl.gelaende)} />
            <Wert t="Geschosse" w={n(auswahl.geb?.geschosse)} />
            <Wert t="Baujahr" w={auswahl.geb?.baujahr ? String(auswahl.geb.baujahr) : '–'} />
            <Wert t="Grundfläche" w={n(auswahl.geb?.grundflaeche, ' m²')} />
            <Wert t="Wohnungen" w={n(auswahl.geb?.wohnungen)} />
            <Wert t="Heizung" w={text('GWAERZH', auswahl.geb?.heizung) + (auswahl.geb?.heizung_seit ? `, seit ${auswahl.geb.heizung_seit.slice(0, 4)}` : '')} breit />
            <Wert t="Energie" w={text('GENH', auswahl.geb?.heizung_energie)} breit />
          </dl>
          {intern && auswahl.parzelleId && (
            <button type="button" className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-[3px] bg-[#111] text-sm font-medium text-white"
                    onClick={() => setzen({ parzelle: auswahl.parzelleId! })}>Objekt öffnen</button>
          )}
          {auswahl.geb === null && <p className="mt-3 text-xs text-[#666]">Kein Eintrag im Gebäuderegister.</p>}
        </div>
      )}

      {!bereit && !fehler && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#DCE6EF]/70 text-sm text-[#333]">
          <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> 3D-Modell wird geladen …</span>
        </div>
      )}
      {stumm && !fehler && (
        <div className="absolute inset-x-3 top-1/3 z-30 mx-auto max-w-[420px] rounded-[3px] bg-white p-4 text-center text-sm text-[#111] shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <p className="font-semibold">Die 3D-Karte hat noch nichts gezeichnet.</p>
          <p className="mt-1 text-[#555]">Neu laden hilft meistens. Bleibt sie leer, bitte diese Zeile weitergeben:</p>
          <p className="mt-2 break-words font-mono text-[11px] text-[#555]">{stumm}</p>
          <button type="button" onClick={() => window.location.reload()}
                  className="mt-3 inline-flex h-11 items-center justify-center rounded-[3px] bg-[#111] px-4 text-sm font-medium text-white">Neu laden</button>
        </div>
      )}
      {fehler && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#DCE6EF] p-6 text-center text-sm text-[#333]">
          <span>Die 3D-Karte liess sich nicht laden.<br /><span className="text-[#666]">{fehler.slice(0, 160)}</span></span>
        </div>
      )}
    </div>
  );
}

function Legende({ eintraege, klein }: { eintraege: { titel: string; farbe: string }[]; klein?: boolean }) {
  return (
    <span className={`flex flex-wrap gap-x-3 gap-y-1 ${klein ? 'text-[11px] text-[#444]' : ''}`}>
      {eintraege.map(e => (
        <span key={e.titel} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: e.farbe }} />{e.titel}
        </span>
      ))}
    </span>
  );
}

function Wert({ t, w, breit }: { t: string; w: string; breit?: boolean }) {
  return (
    <div className={`min-w-0 ${breit ? 'col-span-3 sm:col-span-2' : ''}`}>
      <dt className="text-[11px] uppercase tracking-wide text-[#777]">{t}</dt>
      <dd className="break-words font-medium">{w}</dd>
    </div>
  );
}
