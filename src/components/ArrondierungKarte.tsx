import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GRENZEN, GRUNDKARTEN } from '@/lib/karte-ebenen';
import { lv95NachWgs84 } from '@/lib/koordinaten';
import { sicher } from '@/lib/html';
import type { Parzelle, Ring } from '@/lib/arrondierung-zusammen';

/**
 * Echte Karte statt Zeichnung (Julian: "muss richtig aussehen wie auf der
 * Karte"): Luftbild von swisstopo, darüber die Grenzen der amtlichen
 * Vermessung mit Nummern, und die Umrisse der eigenen Parzelle und aller
 * Nachbarn. Ein Klick auf einen Nachbarn nimmt ihn dazu oder heraus.
 */
const ll = (r: Ring) => r.map(p => { const w = lv95NachWgs84(p[0], p[1]); return L.latLng(w.lat, w.lon); });

export function ArrondierungKarte({ haupt, nachbarn, gewaehlt, umschalten }: {
  haupt: Parzelle; nachbarn: Parzelle[]; gewaehlt: Set<string>; umschalten: (egrid: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const karte = useRef<L.Map | null>(null);
  const schicht = useRef<L.LayerGroup | null>(null);
  const klick = useRef(umschalten);
  const startWahl = useRef(gewaehlt);
  klick.current = umschalten;

  useEffect(() => {
    if (!box.current) return;
    const m = L.map(box.current, { zoomControl: true, attributionControl: true, maxZoom: 21, scrollWheelZoom: false });
    m.attributionControl.setPrefix('');
    const g = GRUNDKARTEN.luftbild;
    L.tileLayer(`https://wmts.geo.admin.ch/1.0.0/${g.id}/default/current/3857/{z}/{x}/{y}.${g.ext}`, {
      maxZoom: 21, maxNativeZoom: g.maxNativeZoom, crossOrigin: true, attribution: '&copy; swisstopo und Kantone',
    }).addTo(m);
    L.tileLayer.wms('https://wms.geo.admin.ch/', {
      layers: GRENZEN.id, format: 'image/png', transparent: true, opacity: GRENZEN.deckkraft ?? 0.55, maxZoom: 21, tileSize: 512,
    }).addTo(m);
    schicht.current = L.layerGroup().addTo(m);
    karte.current = m;
    // Eingepasst wird auf die eigene Parzelle und die gewählten Nachbarn, nicht
    // auf alle: Menziken Parzelle 50 ist ein 16'206 m² langer Strassenstreifen,
    // mit ihm zeigte die Karte die ganze Gegend statt der Grundstücke.
    const alle = [haupt, ...nachbarn.filter(p => startWahl.current.has(p.egrid))].flatMap(p => (p.umriss ?? []).flatMap(ll));
    // Erst einpassen, wenn die Karte ihre echte Grösse hat: beim Aufklappen
    // mass Leaflet noch 0 Pixel und zeigte die ganze Gegend statt der Parzellen.
    const einpassen = () => {
      m.invalidateSize();
      if (alle.length) m.fitBounds(L.latLngBounds(alle), { padding: [24, 24], maxZoom: 19, animate: false });
    };
    m.setView(alle[0] ?? L.latLng(46.8, 8.2), alle.length ? 17 : 8);
    const beobachter = new ResizeObserver(einpassen);
    beobachter.observe(box.current);
    requestAnimationFrame(einpassen);
    return () => { beobachter.disconnect(); m.remove(); karte.current = null; };
  }, [haupt, nachbarn]);

  useEffect(() => {
    const g = schicht.current;
    if (!g) return;
    g.clearLayers();
    for (const r of haupt.umriss ?? []) {
      L.polygon(ll(r), { color: '#fff', weight: 3, fillColor: '#111', fillOpacity: 0.35, interactive: false }).addTo(g);
    }
    for (const p of nachbarn) {
      const an = gewaehlt.has(p.egrid);
      for (const r of p.umriss ?? []) {
        const f = L.polygon(ll(r), {
          color: an ? '#3D45F5' : '#fff', weight: an ? 3 : 2, dashArray: an ? undefined : '6 5',
          fillColor: '#3D45F5', fillOpacity: an ? 0.45 : 0.08,
        }).addTo(g);
        f.bindTooltip(`Parzelle ${sicher(p.nummer ?? '?')} · ${(p.flaeche ?? 0).toLocaleString('de-CH')} m²<br>${an ? 'Klicken: herausnehmen' : 'Klicken: dazunehmen'}`,
          { sticky: true });
        f.on('click', () => klick.current(p.egrid));
      }
    }
  }, [haupt, nachbarn, gewaehlt]);

  return <div ref={box} className="h-72 w-full overflow-hidden rounded-[3px] border sm:h-96" role="application" aria-label="Luftbild mit Parzellen" />;
}
