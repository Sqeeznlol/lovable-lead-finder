import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useParzellenImAusschnitt, type Ausschnitt, type ParzelleEigenschaften } from '@/hooks/use-karte';
import { Nachbarn } from '@/components/Nachbarn';
import { supabase } from '@/integrations/supabase/client';

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

const W = 'https://wmts.geo.admin.ch/1.0.0/';
function lay(id: string, ext: string, max = 19) {
  return L.tileLayer(`${W}${id}/default/current/3857/{z}/{x}/{y}.${ext}`, {
    maxZoom: 21, maxNativeZoom: max,
    attribution: '&copy; swisstopo und Kantone', crossOrigin: true,
  });
}
// Der Kataster kommt als WMS, nicht als WMTS-Kachel: die Kacheln des
// Katasters sind in Web-Mercator umgerechnet und versetzen sich an den
// Kachelrändern um einige Pixel -- Linien und Nummern brechen dort.
// Ein WMS-Bild wird für genau den Ausschnitt gerechnet und passt.
// Unter Zoom 14 malt der Kataster ganze Gemeinden grün; dort zeigt die
// Landeskarte mehr, deshalb setzt er erst darüber ein.
function wms(id: string, minZoom = 14) {
  return L.tileLayer.wms('https://wms.geo.admin.ch/', {
    layers: id, format: 'image/png', transparent: true, tileSize: 512,
    minZoom, maxZoom: 21, attribution: '&copy; swisstopo und Kantone',
  });
}
type Grund = 'kataster' | 'luftbild' | 'karte' | 'grau';
const GRUNDKARTEN: Record<Grund, () => L.TileLayer[]> = {
  kataster: () => [lay('ch.swisstopo.pixelkarte-farbe', 'jpeg', 19), wms('ch.kantone.cadastralwebmap-farbe')],
  luftbild: () => [lay('ch.swisstopo.swissimage', 'jpeg', 20),
                   wms('ch.swisstopo-vd.amtliche-vermessung')],
  karte:    () => [lay('ch.swisstopo.pixelkarte-farbe', 'jpeg', 19)],
  grau:     () => [lay('ch.swisstopo.pixelkarte-grau', 'jpeg', 19)],
};

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

/** Alle gefüllten Spalten der Parzelle; leere und Umrisse bleiben weg. */
function AlleFelder({ z }: { z: Record<string, unknown> }) {
  const zeilen = Object.entries(z).filter(([k, v]) =>
    v !== null && v !== '' && !/geom|umriss|^id$/i.test(k)
    && !(Array.isArray(v) && v.length === 0));
  return (
    <details className="alle" open>
      <summary>Alle Angaben ({zeilen.length})</summary>
      <dl className="f">
        {zeilen.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k.replace(/_/g, ' ')}</dt>
            <dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
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

type Auswahl =
  | { art: 'leer' }
  | { art: 'eigen'; id: string; e: ParzelleEigenschaften; lat: number; lon: number;
      eigentuemer?: string | null; geholt: boolean; zeile?: Record<string, unknown> | null }
  | { art: 'bund'; lat: number; lon: number; laeuft: boolean; fehler?: boolean;
      treffer: { titel: string; adresse: string; info: string; egid?: string }[] };

interface Treffer { label: string; origin: string; lat: number; lon: number }

export function Karte({ onSchliessen }: { onSchliessen?: () => void }) {
  const box = useRef<HTMLDivElement | null>(null);
  const karte = useRef<L.Map | null>(null);
  const grundLagen = useRef<L.TileLayer[]>([]);
  const eigenEbene = useRef<L.GeoJSON | null>(null);

  const [grund, setGrund] = useState<Grund>('kataster');
  const [bestandAn, setBestandAn] = useState(true);
  const [ausschnitt, setAusschnitt] = useState<Ausschnitt | null>(null);
  const [zoom, setZoom] = useState(0);
  const [mitte, setMitte] = useState<{ lat: number; lng: number }>({ lat: 0, lng: 0 });
  const [auswahl, setAuswahl] = useState<Auswahl>({ art: 'leer' });
  const [suche, setSuche] = useState('');
  const [treffer, setTreffer] = useState<Treffer[] | null>(null);
  const [sucheStatus, setSucheStatus] = useState<'ruhe' | 'laeuft' | 'fehler'>('ruhe');

  const genugNah = zoom >= AB_ZOOM;
  const { data } = useParzellenImAusschnitt(ausschnitt, genugNah && bestandAn);

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
      zoomControl: true, preferCanvas: true,
    });
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(m);
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
    grundLagen.current = GRUNDKARTEN[grund]();
    grundLagen.current.forEach(l => l.addTo(m));
    eigenEbene.current?.bringToFront();
  }, [grund]);


  // ---------------------------------------------- eigene Umrisse
  useEffect(() => {
    const m = karte.current;
    if (!m) return;
    eigenEbene.current?.remove();
    eigenEbene.current = null;
    if (!data || !genugNah || !bestandAn) return;
    eigenEbene.current = L.geoJSON(data, {
      // Farbe nach Marge in Stufen, wie bei Regrid/LandGlide: man sieht
      // die guten Parzellen, bevor man klickt. Legende unten links.
      style: f => {
        const e = (f?.properties ?? {}) as ParzelleEigenschaften;
        if (e.ausgeschlossen) return { color: '#64748B', weight: 1, fillOpacity: 0.04 };
        const c = margeFarbe(Number(e.marge) || 0);
        return { color: c, weight: 2, fillColor: c, fillOpacity: 0.32 };
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
          eigeneZeigen(String(f.id), f.properties as ParzelleEigenschaften,
            ev.latlng.lat, ev.latlng.lng);
        });
      },
    }).addTo(m);
  }, [data, genugNah, bestandAn]);

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
    // Erst fragen, welche Parzelle hier liegt, und sie per EGRID im
    // eigenen Bestand suchen -- auch dort, wo noch kein Umriss geladen ist.
    try {
      const k = 'https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometryType=esriGeometryPoint'
        + `&geometry=${lv.E},${lv.N}&sr=2056&tolerance=0&returnGeometry=false`
        + '&layers=all:ch.kantone.cadastralwebmap-farbe'
        + `&mapExtent=${lv.E - 300},${lv.N - 300},${lv.E + 300},${lv.N + 300}&imageDisplay=600,600,96&lang=de`;
      const kj = await (await fetch(k)).json();
      // Den Attributnamen kenne ich nicht sicher; die EGRID erkennt man
      // an ihrer Form, also wird nach der Form gesucht.
      const egrid = (kj?.results ?? []).flatMap((x: { attributes?: Record<string, unknown> }) =>
        Object.values(x.attributes ?? {})).map(String).find((v: string) => /^CH[0-9A-Z]{12}$/.test(v));
      if (egrid) {
        const { data: p } = await supabase.from('properties').select('*').eq('egrid', egrid).maybeSingle();
        const z = p as Record<string, unknown> | null;
        if (z) {
          setAuswahl({
            art: 'eigen', id: String(z.id), lat, lon, geholt: true, zeile: z,
            eigentuemer: (z.owner_name as string) ?? null,
            e: { parzelle: z.plot_number, adresse: z.address, gemeinde: z.gemeinde ?? z.municipality,
                 zone: z.zone, flaeche: z.area, marge: z.marge } as unknown as ParzelleEigenschaften,
          });
          return;
        }
      }
    } catch { /* weiter mit dem Bundesregister */ }
    const ebenen = 'ch.bfs.gebaeude_wohnungs_register,ch.swisstopo.amtliches-strassenverzeichnis';
    const url = 'https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometryType=esriGeometryPoint'
      + `&geometry=${lv.E},${lv.N}&sr=2056&tolerance=12&layers=all:${ebenen}`
      + `&mapExtent=${lv.E - 300},${lv.N - 300},${lv.E + 300},${lv.N + 300}&imageDisplay=600,600,96&lang=de`;
    try {
      const j = await (await fetch(url)).json();
      const res = (j?.results ?? []).slice(0, 4);
      setAuswahl({
        art: 'bund', lat, lon, laeuft: false,
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
      setAuswahl({ art: 'bund', lat, lon, laeuft: false, fehler: true, treffer: [] });
    }
  }

  // ------------------------------------------------------------ Suche
  useEffect(() => {
    const s = suche.trim();
    if (s.length < 3) { setTreffer(null); setSucheStatus('ruhe'); return; }
    const t = setTimeout(async () => {
      setSucheStatus('laeuft');
      try {
        const j = await (await fetch(
          'https://api3.geo.admin.ch/rest/services/ech/SearchServer?type=locations&limit=8&sr=2056&lang=de&searchText='
          + encodeURIComponent(s))).json();
        const rs = (j?.results ?? []) as { attrs?: Record<string, unknown> }[];
        setTreffer(rs.map(r => {
          const a = r.attrs ?? {};
          let lat = Number(a.lat), lon = Number(a.lon);
          // Mit sr=2056 kommt LV95 zurück -- zurückrechnen.
          if (lat > 90 || lon > 90) [lat, lon] = fromLV95(Number(a.y ?? a.lon), Number(a.x ?? a.lat));
          return {
            label: String(a.label ?? '').replace(/<[^>]+>/g, ''),
            origin: String(a.origin ?? ''), lat, lon,
          };
        }));
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
      .sort((a, b) => (Number(b.properties?.marge) || 0) - (Number(a.properties?.marge) || 0))
      .slice(0, 15);
  }, [data]);

  function mitteVon(f: GeoJSON.Feature): [number, number] {
    const b = L.geoJSON(f).getBounds().getCenter();
    return [b.lat, b.lng];
  }

  const lvMitte = toLV95(mitte.lat, mitte.lng);

  return (
    <div className="gisk">
      <style>{STIL}</style>
      <header>
        {onSchliessen && <button type="button" className="btn ghost" onClick={onSchliessen}>← Aurora</button>}
        <div className="logo"><b>GIS Parzellenkarte</b><span>Swisstopo Kataster · Amtliche Vermessung</span></div>
        <div className="tools">
          <input type="search" value={suche} onChange={e => setSuche(e.target.value)}
                 placeholder="Adresse, Ort oder Parzelle suchen" autoComplete="off" />
          <select value={grund} onChange={e => setGrund(e.target.value as Grund)}>
            <option value="kataster">Kataster, Parzellen farbig</option>
            <option value="luftbild">Luftbild mit Parzellengrenzen</option>
            <option value="karte">Landeskarte farbig</option>
            <option value="grau">Landeskarte grau</option>
          </select>
          <button type="button" className="btn ghost" onClick={() => setBestandAn(v => !v)}>
            {bestandAn ? 'Bestand ein' : 'Bestand aus'}
          </button>
          <a className="btn ghost" target="_blank" rel="noopener"
             href={geoadminLink(mitte.lat, mitte.lng, Math.max(0, zoom - 7))}>In map.geo.admin.ch</a>
        </div>
      </header>

      <div className="wrap">
        <div style={{ position: 'relative', minHeight: 0 }}>
          <div ref={box} className="map" />
          {bestandAn && genugNah && (
            <div className="legende">
              <b>Marge</b>
              {STUFEN.map(([, c, t]) => <span key={t}><i style={{ background: c }} />{t}</span>)}
            </div>
          )}
          <div className="readout">
            LV95 {gr(lvMitte.E)} / {gr(lvMitte.N)}  ·  WGS84 {mitte.lat.toFixed(5)}, {mitte.lng.toFixed(5)}  ·  Zoom {zoom}
            {!genugNah && bestandAn ? '  ·  näher heran für den Bestand' : ''}
            {genugNah && bestandAn && data ? `  ·  ${data.features.length} eigene Parzellen` : ''}
          </div>
        </div>

        <aside>
          <div className="pa">
            <p className="eyebrow">Auswahl</p>
            {auswahl.art === 'leer' && (
              <>
                <h3>Auf eine Parzelle klicken</h3>
                <p className="hint">Hineinzoomen bis die Parzellennummern erscheinen, dann auf eine Fläche
                  klicken. Eigene Parzellen sind eingefärbt; ein Klick daneben fragt Gebäude- und
                  Adressregister des Bundes ab.</p>
              </>
            )}

            {auswahl.art === 'eigen' && (() => {
              const e = auswahl.e;
              const lv = toLV95(auswahl.lat, auswahl.lon);
              return (
                <>
                  <h3>
                    {e.parzelle ? `Parzelle ${e.parzelle}` : 'Parzelle'}{' '}
                    <span className={`chip ${e.ausgeschlossen ? 'mut' : 'acc'}`}>
                      {e.ausgeschlossen ? 'ausgeschlossen' : 'Bestand'}
                    </span>
                  </h3>
                  <dl className="f">
                    {e.adresse && <><dt>Adresse</dt><dd><Kopieren wert={e.adresse} /></dd></>}
                    {e.gemeinde && <><dt>Gemeinde</dt><dd>{e.gemeinde}</dd></>}
                    <dt>Zone</dt><dd>{e.zone || '–'}{e.flaeche ? ` · ${gr(e.flaeche)} m²` : ''}</dd>
                    {e.marge != null && Number(e.marge) > 0 && (
                      <><dt>Marge</dt><dd><span className="chip warn">{gr(e.marge)} CHF</span></dd></>
                    )}
                    <dt>Eigentümer</dt>
                    <dd>{!auswahl.geholt ? <span className="hint">wird geholt …</span>
                      : auswahl.eigentuemer ?? <span className="hint">noch nicht abgefragt</span>}</dd>
                    <dt>LV95</dt><dd className="hint">{gr(lv.E)} / {gr(lv.N)}</dd>
                  </dl>
                  {auswahl.zeile && <AlleFelder z={auswahl.zeile} />}
                  <div className="btnrow">
                    <a className="btn ghost" href={geoadminLink(auswahl.lat, auswahl.lon, 12)}
                       target="_blank" rel="noopener">Im Bundes-GIS prüfen</a>
                  </div>
                  <div className="nachbarn"><Nachbarn parzelleId={auswahl.id} /></div>
                </>
              );
            })()}

            {auswahl.art === 'bund' && (() => {
              const lv = toLV95(auswahl.lat, auswahl.lon);
              return (
                <>
                  <h3>{auswahl.laeuft ? 'Abfrage läuft'
                    : auswahl.fehler ? 'Abfrage nicht möglich' : 'Abfrage an dieser Stelle'}</h3>
                  {auswahl.laeuft && <p className="hint">Gebäude- und Adressregister wird abgefragt.</p>}
                  {!auswahl.laeuft && (
                    <dl className="f">
                      <dt>Punkt</dt><dd className="hint">LV95 {gr(lv.E)} / {gr(lv.N)}</dd>
                      {auswahl.fehler && <><dt>Hinweis</dt><dd>Der Bundesdienst antwortet nicht. Die Karte bleibt nutzbar.</dd></>}
                      {!auswahl.fehler && auswahl.treffer.length === 0 && (
                        <><dt>Treffer</dt><dd>Kein Eintrag an dieser Stelle. Eigene Parzellen sind eingefärbt
                          und lassen sich direkt anklicken.</dd></>
                      )}
                      {auswahl.treffer.map((t, i) => (
                        <div key={i} style={{ display: 'contents' }}>
                          <dt>{t.titel}</dt>
                          <dd>
                            {t.adresse && <Kopieren wert={t.adresse} />}
                            {t.info && <div className="hint">{t.info}</div>}
                            {t.egid && <div className="hint">EGID {t.egid}</div>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <div className="btnrow">
                    <a className="btn ghost" href={geoadminLink(auswahl.lat, auswahl.lon, 12)}
                       target="_blank" rel="noopener">Im Bundes-GIS öffnen</a>
                    <Kopieren wert={`${gr(lv.E)} / ${gr(lv.N)}`} text="Koordinaten kopieren" />
                  </div>
                </>
              );
            })()}
          </div>

          <div className="pa">
            <p className="eyebrow">Suchergebnisse</p>
            <div className="rows">
              {sucheStatus === 'laeuft' && <p className="hint">Suche läuft.</p>}
              {sucheStatus === 'fehler' && <p className="hint">Suchdienst nicht erreichbar.</p>}
              {sucheStatus === 'ruhe' && treffer === null && <p className="hint">Noch keine Suche.</p>}
              {sucheStatus === 'ruhe' && treffer?.length === 0 && <p className="hint">Kein Treffer.</p>}
              {sucheStatus === 'ruhe' && treffer?.map((t, i) => (
                <div key={i} className="row" onClick={() => karte.current?.setView([t.lat, t.lon], 19)}>
                  <b>{t.label}</b><div>{t.origin}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="pa">
            <p className="eyebrow">Bestand im Bild</p>
            <div className="rows">
              {!bestandAn && <p className="hint">Bestand ausgeblendet.</p>}
              {bestandAn && !genugNah && <p className="hint">Näher heranzoomen, dann erscheinen die eigenen Parzellen.</p>}
              {bestandAn && genugNah && bestand.length === 0 && (
                <p className="hint">Keine eigenen Parzellen mit Umriss in diesem Ausschnitt.</p>
              )}
              {bestand.map(f => {
                const e = f.properties as ParzelleEigenschaften;
                return (
                  <div key={String(f.id)} className="row" onClick={() => {
                    const [lat, lon] = mitteVon(f);
                    karte.current?.setView([lat, lon], 19);
                    eigeneZeigen(String(f.id), e, lat, lon);
                  }}>
                    <b>{e.parzelle ? `Parz. ${e.parzelle}` : 'Parzelle'} · {e.gemeinde ?? ''}</b>
                    <div>{e.adresse ?? ''}{e.flaeche ? ` · ${gr(e.flaeche)} m²` : ''}
                      {e.marge && Number(e.marge) > 0 ? ` · Marge ${gr(e.marge)} CHF` : ''}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pa">
            <p className="eyebrow">Datenquellen</p>
            <dl className="f">
              <dt>Kataster</dt><dd>ch.kantone.cadastralwebmap-farbe, Kantone und swisstopo</dd>
              <dt>Grenzen</dt><dd>ch.swisstopo-vd.amtliche-vermessung</dd>
              <dt>Luftbild</dt><dd>ch.swisstopo.swissimage</dd>
              <dt>Abfrage</dt><dd>api3.geo.admin.ch, Gebäude- und Wohnungsregister</dd>
              <dt>Bestand</dt><dd>Eigene Datenbank: Umrisse aus der Amtlichen Vermessung (geodienste.ch), Zone, Marge, Eigentümer</dd>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Die Gestaltung der Vorlage, auf diesen Bereich beschränkt. */
const STIL = `
.gisk{--paper:#FAFAF8;--surface:#FFFFFF;--surface-2:#F3F4F2;--ink:#14181A;--ink-2:#56605F;--line:#DCE1DF;
  --accent:#27605A;--accent-soft:#EBF2F0;--warn:#8A6512;--ok:#2C6640;--no:#8C3030;
  --display:"Schibsted Grotesk","Helvetica Neue",Arial,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
  display:grid;grid-template-rows:auto minmax(0,1fr);position:fixed;inset:0;z-index:50;height:100dvh;
  background:var(--paper);color:var(--ink);font:15px/1.55 var(--display);-webkit-font-smoothing:antialiased;
  border:1px solid var(--line);border-radius:6px;overflow:hidden}
.gisk *{box-sizing:border-box}
.gisk header{border-bottom:1px solid var(--line);background:var(--paper);display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between;padding:10px 16px}
.gisk .logo b{font-weight:700;letter-spacing:-0.035em;font-size:1.05rem}
.gisk .logo span{font-family:var(--mono);font-size:.64rem;letter-spacing:.11em;text-transform:uppercase;color:var(--ink-2);margin-left:8px}
.gisk .tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.gisk input,.gisk select,.gisk button{font:inherit}
.gisk input[type=search]{font-size:.88rem;padding:7px 9px;border:1px solid var(--line);border-radius:3px;background:var(--surface);color:var(--ink);min-width:230px}
.gisk select{font-size:.86rem;padding:7px 9px;border:1px solid var(--line);border-radius:3px;background:var(--surface);color:var(--ink)}
.gisk .btn{background:var(--accent);color:var(--paper);border:1px solid var(--accent);border-radius:3px;padding:7px 12px;font-size:.86rem;font-weight:500;cursor:pointer;text-decoration:none}
.gisk .btn.ghost{background:none;color:var(--ink);border-color:var(--line)}
.gisk .btn.ghost:hover{border-color:var(--accent);color:var(--accent)}
.gisk .wrap{display:grid;grid-template-columns:minmax(0,1fr) 352px;min-height:0}
@media (max-width:900px){.gisk{overflow:auto}.gisk .wrap{grid-template-columns:minmax(0,1fr);grid-template-rows:62vh auto}}
.gisk .alle{margin-top:14px}.gisk .alle summary{cursor:pointer;font:600 11px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.gisk .alle dd{word-break:break-word}
.gisk .map{height:100%;width:100%;background:var(--surface-2)}
.gisk aside{border-left:1px solid var(--line);background:var(--surface);overflow-y:auto;min-width:0}
@media (max-width:900px){.gisk aside{border-left:0;border-top:1px solid var(--line)}}
.gisk .pa{padding:14px 16px;border-bottom:1px solid var(--line)}
.gisk .pa h3{margin:0 0 8px;font-size:.95rem;font-weight:600}
.gisk .eyebrow{font-family:var(--mono);font-size:.63rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin:0 0 6px}
.gisk dl.f{margin:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px 12px;font-size:.9rem}
.gisk dl.f dt{font-family:var(--mono);font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2);padding-top:3px}
.gisk dl.f dd{margin:0;min-width:0;word-break:break-word}
.gisk .copy{font-family:var(--mono);font-size:.78rem;background:var(--surface-2);border:1px solid var(--line);border-radius:3px;padding:4px 8px;color:var(--ink);cursor:pointer;text-align:left}
.gisk .copy:hover{border-color:var(--accent);color:var(--accent)}
.gisk .copy.done{border-color:var(--ok);color:var(--ok)}
.gisk .chip{font-family:var(--mono);font-size:.62rem;letter-spacing:.09em;text-transform:uppercase;padding:3px 7px;border-radius:2px;border:1px solid currentColor;white-space:nowrap}
.gisk .chip.acc{color:var(--accent)}.gisk .chip.mut{color:var(--ink-2)}.gisk .chip.warn{color:var(--warn)}
.gisk .hint{font-family:var(--mono);font-size:.67rem;color:var(--ink-2);margin:0}
.gisk .rows{display:flex;flex-direction:column}
.gisk .row{padding:10px 16px;margin:0 -16px;border-bottom:1px solid var(--line);cursor:pointer}
.gisk .row:hover{background:var(--surface-2)}
.gisk .row b{font-weight:600;font-size:.92rem}
.gisk .row div{font-family:var(--mono);font-size:.67rem;color:var(--ink-2)}
.gisk .btnrow{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.gisk a{color:var(--accent)}
.gisk .readout{position:absolute;left:10px;bottom:10px;z-index:500;background:rgba(255,255,255,.92);border:1px solid var(--line);border-radius:3px;padding:5px 9px;font-family:var(--mono);font-size:.68rem;color:var(--ink-2);white-space:pre}
.gisk .leaflet-container{font:inherit}
.gisk .nachbarn{margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}

.gisk .legende{position:absolute;z-index:500;left:14px;bottom:56px;background:#fff;border-radius:10px;box-shadow:0 4px 14px rgba(15,23,42,.12);padding:8px 12px;font-size:12px;display:flex;flex-direction:column;gap:3px}
.gisk .legende i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:7px;vertical-align:-2px}
.gisk-tip{font:13px/1.4 Inter,Arial,sans-serif;border-radius:8px;border:0;box-shadow:0 4px 14px rgba(15,23,42,.18);padding:7px 10px}
/* Karte zuerst, wie bei Immobilienplattformen (popety.io u. a.): die
   Karte füllt alles, Suche und Angaben schweben als Karten darüber. */
.gisk{--paper:#F6F7F9;--surface:#FFFFFF;--surface-2:#F1F3F6;--ink:#0F172A;--ink-2:#64748B;--line:#E2E8F0;
  --accent:#1E3A8A;--accent-soft:#EEF2FF;--warn:#B45309;--ok:#15803D;--no:#B91C1C;
  --display:"Inter","Schibsted Grotesk","Helvetica Neue",Arial,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
  display:block;border:0;border-radius:0;font-size:14px}
.gisk .wrap{display:block;position:absolute;inset:0}
.gisk .wrap>div:first-child{position:absolute!important;inset:0}
.gisk header{position:absolute;z-index:600;top:14px;left:14px;right:404px;border:0;border-radius:14px;
  background:rgba(255,255,255,.96);box-shadow:0 8px 30px rgba(15,23,42,.14);padding:10px 14px}
.gisk aside{position:absolute;z-index:600;top:14px;right:14px;bottom:14px;width:376px;border:0;border-radius:14px;
  box-shadow:0 8px 30px rgba(15,23,42,.14)}
.gisk .pa{padding:16px 18px}
.gisk .pa h3{font-size:1.05rem;font-weight:650;letter-spacing:-.01em}
.gisk input[type=search],.gisk select{border-radius:10px;padding:9px 12px}
.gisk input[type=search]{min-width:280px;background:var(--surface-2);border-color:transparent}
.gisk .btn{border-radius:10px;padding:8px 14px}
.gisk .leaflet-top.leaflet-left{top:140px}.gisk .leaflet-bottom.leaflet-right{right:404px}
.gisk .readout{left:14px;bottom:14px;border-radius:10px;border:0;box-shadow:0 4px 14px rgba(15,23,42,.12)}
.gisk .chip{border-radius:999px}
@media (max-width:900px){.gisk header{right:14px}.gisk aside{top:auto;left:14px;width:auto;height:45vh}}
`;
