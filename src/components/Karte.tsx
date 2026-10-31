import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, Layers, Map as MapIcon } from 'lucide-react';
import { useParzellenImAusschnitt, type Ausschnitt } from '@/hooks/use-karte';
import { useCanton } from '@/hooks/use-canton';
import { Nachbarn } from '@/components/Nachbarn';
import { supabase } from '@/integrations/supabase/client';

/**
 * Die Karte.
 *
 * Grundlage sind die Kacheln von swisstopo: Bundesdaten, gratis, ohne
 * Schlüssel und ohne Kontingent -- im Gegensatz zu Google Maps, das je
 * Aufruf abgerechnet wird. `src/lib/swisstopo.ts` benutzt dieselbe
 * Quelle schon für die Luftbilder.
 *
 * Geladen wird nur, was im Bild ist. Alles andere wäre bei 137'214
 * Thurgauer Parzellen eine Datei von Dutzenden Megabyte je Bewegung.
 *
 * Unterhalb einer gewissen Zoomstufe werden gar keine Umrisse geholt:
 * auf Kantonsebene sind sie ein Pixel gross und sagen nichts, kosten
 * aber die ganze Übertragung.
 */
const AB_ZOOM = 15;

/** Die Mitte der beiden geladenen Kantone. */
const MITTEN: Record<string, [number, number]> = {
  TG: [47.57, 9.06],
  ZH: [47.40, 8.65],
  ZG: [47.17, 8.52],
  AG: [47.39, 8.05],
  LU: [47.07, 8.23],
};

interface Gewaehlt {
  id: string;
  adresse: string | null;
  parzelle: string | null;
  gemeinde: string | null;
  flaeche: number | null;
  zone: string | null;
  marge: number | null;
  eigentuemer?: string | null;
  eigentuemerGeholt: boolean;
}

function zahl(n: number | null | undefined, einheit = '') {
  if (n == null) return null;
  return `${Math.round(n).toLocaleString('de-CH')}${einheit}`;
}

export function Karte() {
  const { current: kanton } = useCanton();
  const behaelter = useRef<HTMLDivElement | null>(null);
  const karte = useRef<L.Map | null>(null);
  const ebene = useRef<L.GeoJSON | null>(null);
  const [ausschnitt, setAusschnitt] = useState<Ausschnitt | null>(null);
  const [zoom, setZoom] = useState(0);
  const [gewaehlt, setGewaehlt] = useState<Gewaehlt | null>(null);
  const [luftbild, setLuftbild] = useState(false);

  const genugNah = zoom >= AB_ZOOM;
  const { data, isFetching } = useParzellenImAusschnitt(ausschnitt, genugNah);

  // ------------------------------------------------- Karte aufbauen
  useEffect(() => {
    if (!behaelter.current || karte.current) return;
    const m = L.map(behaelter.current, { zoomControl: true })
      .setView(MITTEN[kanton] ?? MITTEN.TG, 13);

    L.tileLayer(
      'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
      {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.swisstopo.admin.ch/">swisstopo</a>',
      },
    ).addTo(m);

    const merken = () => {
      const b = m.getBounds();
      setZoom(m.getZoom());
      setAusschnitt({
        west: b.getWest(), sued: b.getSouth(),
        ost: b.getEast(), nord: b.getNorth(),
      });
    };
    m.on('moveend', merken);
    merken();
    karte.current = m;

    return () => { m.remove(); karte.current = null; };
    // Nur einmal aufbauen; der Kantonswechsel verschiebt weiter unten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------- Luftbild umschalten
  useEffect(() => {
    const m = karte.current;
    if (!m) return;
    m.eachLayer(l => { if (l instanceof L.TileLayer) m.removeLayer(l); });
    const quelle = luftbild
      ? 'ch.swisstopo.swissimage'
      : 'ch.swisstopo.pixelkarte-farbe';
    L.tileLayer(
      `https://wmts.geo.admin.ch/1.0.0/${quelle}/default/current/3857/{z}/{x}/{y}.jpeg`,
      { maxZoom: 19, attribution: '&copy; swisstopo' },
    ).addTo(m);
    // Die Umrisse müssen über den Kacheln bleiben.
    ebene.current?.bringToFront();
  }, [luftbild]);

  // ------------------------------------------- Kantonswechsel folgen
  useEffect(() => {
    const m = karte.current;
    if (!m) return;
    m.setView(MITTEN[kanton] ?? MITTEN.TG, 13);
  }, [kanton]);

  // ------------------------------------------------ Umrisse zeichnen
  useEffect(() => {
    const m = karte.current;
    if (!m) return;
    ebene.current?.remove();
    if (!data || !genugNah) { ebene.current = null; return; }

    ebene.current = L.geoJSON(data, {
      style: f => {
        const e = f?.properties ?? {};
        // Was ausgeschlossen ist, soll man sehen, aber nicht zuerst.
        if (e.ausgeschlossen) {
          return { color: '#9ca3af', weight: 1, fillOpacity: 0.05 };
        }
        // Je grösser die Marge, desto kräftiger -- so sticht ins Auge,
        // wo sich das Hinsehen lohnt.
        const marge = Number(e.marge) || 0;
        const stark = marge > 500_000;
        return {
          color: stark ? '#059669' : '#2563eb',
          weight: stark ? 2 : 1,
          fillOpacity: stark ? 0.25 : 0.1,
        };
      },
      onEachFeature: (f, schicht) => {
        schicht.on('click', async () => {
          const e = f.properties ?? {};
          const id = String(f.id);
          setGewaehlt({
            id,
            adresse: e.adresse, parzelle: e.parzelle, gemeinde: e.gemeinde,
            flaeche: e.flaeche, zone: e.zone, marge: e.marge,
            eigentuemerGeholt: false,
          });
          // Der Eigentümer steht in `properties` und wird erst beim
          // Klick geholt -- die Karte selbst trägt keine Personendaten.
          const { data: p } = await supabase
            .from('properties')
            .select('owner_name')
            .eq('id', id)
            .maybeSingle();
          setGewaehlt(g => (g && g.id === id
            ? { ...g, eigentuemer: p?.owner_name ?? null, eigentuemerGeholt: true }
            : g));
        });
      },
    }).addTo(m);
  }, [data, genugNah]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <MapIcon className="h-8 w-8 text-primary" />
            Karte
          </h2>
          <p className="mt-1 text-muted-foreground">
            Parzellen auf der Landeskarte — anklicken für Angaben und Nachbarn
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLuftbild(v => !v)}
          className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted/50"
        >
          <Layers className="h-4 w-4" />
          {luftbild ? 'Landeskarte' : 'Luftbild'}
        </button>
      </div>

      <div className="relative overflow-hidden rounded-2xl border">
        <div ref={behaelter} className="h-[32rem] w-full" />

        {!genugNah && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-background/90 p-3 text-center text-sm">
            Näher heranzoomen, dann erscheinen die Parzellen. Auf
            Kantonsebene wären sie einen Pixel gross und die Übertragung
            dennoch vollständig.
          </div>
        )}
        {genugNah && isFetching && (
          <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-lg bg-background/90 px-3 py-1.5 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" /> Parzellen …
          </div>
        )}
        {genugNah && !isFetching && data && (
          <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-background/90 px-3 py-1.5 text-xs text-muted-foreground">
            {data.features.length} Parzellen im Bild
          </div>
        )}
      </div>

      {gewaehlt && (
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-serif text-lg">
                {gewaehlt.adresse || `Parzelle ${gewaehlt.parzelle ?? '?'}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {[gewaehlt.gemeinde,
                  gewaehlt.parzelle && `Parzelle ${gewaehlt.parzelle}`,
                  zahl(gewaehlt.flaeche, ' m²')].filter(Boolean).join(' · ')}
              </p>
              {gewaehlt.zone && (
                <p className="mt-1 text-sm text-muted-foreground">{gewaehlt.zone}</p>
              )}
              {gewaehlt.marge != null && gewaehlt.marge > 0 && (
                <p className="mt-2 text-sm">
                  Marge <span className="font-medium tabular-nums">
                    {zahl(gewaehlt.marge)} CHF
                  </span>
                </p>
              )}
              <p className="mt-2 text-sm">
                {gewaehlt.eigentuemerGeholt
                  ? (gewaehlt.eigentuemer || (
                      <span className="text-muted-foreground">
                        Eigentümer noch nicht abgefragt
                      </span>
                    ))
                  : <span className="text-muted-foreground">Eigentümer …</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGewaehlt(null)}
              className="shrink-0 text-xs text-muted-foreground underline underline-offset-2"
            >
              schliessen
            </button>
          </div>

          <Nachbarn parzelleId={gewaehlt.id} />
        </div>
      )}
    </div>
  );
}
