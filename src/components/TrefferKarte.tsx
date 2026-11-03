import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Maximize2, Minus, Plus } from 'lucide-react';
import { sicher } from '@/lib/html';
import { GRUNDKARTEN } from '@/lib/karte-ebenen';
import { HEIZ_GRUPPEN, heizGruppe } from '@/lib/karte3d';

/**
 * Die Treffer der Gebäudesuche bzw. einer Merkliste auf der Karte
 * (Julian, 3. November). Farbe = Heizung wie in der 3D-Karte; ein Tipp
 * auf einen Punkt markiert das Gebäude wie das Häkchen in der Liste,
 * markierte tragen einen blauen Ring.
 *
 * Aufgebaut wie die Karte der Fonds (Universum): gleiche Knöpfe rechts,
 * Legende links oben, Luftbild oder Landeskarte -- eine Fassung für
 * alle Karten statt jede ein wenig anders.
 */
export interface KartenTreffer {
  egid: number; adresse: string | null; lat?: number | null; lon?: number | null;
  baujahr: number | null; eigentuemer?: string | null; heizung: string | null; zusatz?: string | null;
}

const leise = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function TrefferKarte({ treffer, markiert, onMarkieren, hoehe = 'h-[420px] sm:h-[560px]' }: {
  treffer: KartenTreffer[]; markiert: Set<number>; onMarkieren: (egid: number) => void; hoehe?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const karte = useRef<L.Map | null>(null);
  const grund = useRef<L.TileLayer | null>(null);
  const schicht = useRef<L.LayerGroup | null>(null);
  const [luftbild, setLuftbild] = useState(true);
  const [bereit, setBereit] = useState(false);
  const markieren = useRef(onMarkieren);
  markieren.current = onMarkieren;

  const orte = useMemo(() => treffer.filter(t => t.lat != null && t.lon != null)
    .map(t => ({ t, ll: L.latLng(Number(t.lat), Number(t.lon)) })), [treffer]);
  const alles = useMemo(() => (orte.length ? L.latLngBounds(orte.map(o => o.ll)) : null), [orte]);
  const gruppen = useMemo(() => HEIZ_GRUPPEN.filter(g => treffer.some(t => heizGruppe(t.heizung)?.titel === g.titel)), [treffer]);

  useEffect(() => {
    if (!box.current || karte.current) return;
    const m = L.map(box.current, { zoomControl: false, attributionControl: true, minZoom: 8, maxZoom: 20, scrollWheelZoom: false });
    m.setView([47.38, 8.54], 11);
    m.attributionControl.setPrefix('');
    // Mausrad nur mit gedrückter Taste -- sonst fängt die Karte das
    // Scrollen der Seite ab.
    const rad = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      m.setZoom(m.getZoom() + (e.deltaY < 0 ? 1 : -1));
    };
    const el = box.current;
    el.addEventListener('wheel', rad, { passive: false });
    schicht.current = L.layerGroup().addTo(m);
    karte.current = m;
    setBereit(true);
    return () => { el.removeEventListener('wheel', rad); m.remove(); karte.current = null; schicht.current = null; };
  }, []);

  useEffect(() => {
    const m = karte.current;
    if (!m) return;
    const e = GRUNDKARTEN[luftbild ? 'luftbild' : 'karte'];
    grund.current?.remove();
    grund.current = L.tileLayer(`https://wmts.geo.admin.ch/1.0.0/${e.id}/default/current/3857/{z}/{x}/{y}.${e.ext}`, {
      maxZoom: 20, maxNativeZoom: e.maxNativeZoom, crossOrigin: true, attribution: '&copy; swisstopo',
    }).addTo(m);
    grund.current.bringToBack();
  }, [luftbild, bereit]);

  // Nur bei neuen Treffern in den Rahmen -- nicht bei jedem Häkchen,
  // sonst spränge die Karte nach jedem Tipp zurück.
  useEffect(() => {
    if (karte.current && alles) karte.current.fitBounds(alles, { padding: [40, 40], maxZoom: 17, animate: !leise() });
  }, [alles, bereit]);

  useEffect(() => {
    const g = schicht.current;
    if (!g) return;
    g.clearLayers();
    for (const { t, ll } of orte) {
      const an = markiert.has(t.egid);
      if (an) L.circleMarker(ll, { radius: 13, color: '#3D45F5', weight: 3, fill: false, interactive: false }).addTo(g);
      const punkt = L.circleMarker(ll, {
        radius: an ? 8 : 7, color: '#fff', weight: 2, fillColor: heizGruppe(t.heizung)?.farbe ?? '#B9B9B9', fillOpacity: 1,
      }).addTo(g);
      const zeile = [t.baujahr ? `Baujahr ${t.baujahr}` : null, heizGruppe(t.heizung)?.titel, t.zusatz].filter(Boolean).join(' · ');
      punkt.bindTooltip(`<b>${sicher(t.adresse ?? `EGID ${t.egid}`)}</b><br><span>${sicher(zeile)}</span>`
        + (t.eigentuemer ? `<br><span>${sicher(t.eigentuemer)}</span>` : ''), { direction: 'top', offset: [0, -8], className: 'treffer-tipp' });
      punkt.on('click', e => { L.DomEvent.stopPropagation(e); markieren.current(t.egid); });
    }
  }, [orte, markiert, bereit]);

  const knopf = 'grid h-11 w-11 place-items-center rounded-[3px] bg-white text-[#111] shadow-[0_2px_8px_rgba(0,0,0,0.18)] hover:bg-[#f2f2f2]';
  const ohneLage = treffer.length - orte.length;

  return (
    <div className={`relative isolate overflow-hidden rounded border bg-secondary ${hoehe}`}>
      <style>{`.treffer-tipp{border:0;border-radius:3px;padding:8px 10px;font:12px/1.35 inherit;color:#111;box-shadow:0 6px 18px rgba(0,0,0,.18)}
.treffer-tipp span{color:#555}`}</style>
      <div ref={box} className="absolute inset-0 [&_.leaflet-container]:font-[inherit]" aria-label="Karte der Treffer" />

      {gruppen.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-3 z-[500] max-w-[calc(100%-5rem)] rounded-[3px] bg-white/95 px-3 py-2 text-[12px] text-[#111] shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {gruppen.map(g => (
              <span key={g.titel} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: g.farbe }} />{g.titel}
              </span>
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[#555]">
            <span className="h-3 w-3 rounded-full border-[2.5px] border-[#3D45F5]" /> markiert · Punkt antippen zum Markieren
          </div>
        </div>
      )}

      <div className="absolute right-3 top-3 z-[500] flex flex-col gap-1.5">
        <button type="button" className={knopf} onClick={() => karte.current?.zoomIn()} aria-label="Näher" title="Näher"><Plus className="h-4 w-4" /></button>
        <button type="button" className={knopf} onClick={() => karte.current?.zoomOut()} aria-label="Weiter weg" title="Weiter weg"><Minus className="h-4 w-4" /></button>
        <button type="button" className={knopf} aria-label="Alle Treffer zeigen" title="Alle Treffer zeigen"
                onClick={() => { if (alles) karte.current?.fitBounds(alles, { padding: [40, 40], maxZoom: 17 }); }}><Maximize2 className="h-4 w-4" /></button>
        <button type="button" className={knopf} onClick={() => setLuftbild(v => !v)}
                aria-label={luftbild ? 'Landeskarte zeigen' : 'Luftbild zeigen'} title={luftbild ? 'Landeskarte' : 'Luftbild'}><Layers className="h-4 w-4" /></button>
      </div>

      {treffer.length > 0 && ohneLage > 0 && (
        <span className="absolute bottom-3 left-3 z-[500] rounded-[3px] bg-white/95 px-2.5 py-1 text-[11px] text-[#555]">
          {orte.length ? `${ohneLage} von ${treffer.length} ohne Lage im Bestand` : 'Die Lage kommt mit der nächsten Migration (merkliste_stand_karte).'}
        </span>
      )}
    </div>
  );
}
