import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Maximize2, Minus, Plus } from 'lucide-react';
import { fondsFarbe, type Fonds, type Kante, type Punkt } from '@/lib/fonds';
import { lv95NachWgs84 } from '@/lib/koordinaten';
import { sicher } from '@/lib/html';
import { GRUNDKARTEN } from '@/lib/karte-ebenen';

const leise = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const m2 = (x: number | null) => (x ? `${Math.round(x).toLocaleString('de-CH')} m²` : null);

/**
 * Das Portfolio auf der Karte (Julian, 1. November: "im Immobilien-
 * Style, was die sich darunter gut vorstellen können"). Ein Fondsmanager
 * denkt in Lagen und Luftbildern, nicht in Sternbildern: darum das
 * Luftbild des Bundes (SWISSIMAGE) als Grund, wie die Bühne jeder Seite,
 * und darauf jede Liegenschaft als Punkt in der Farbe ihres Fonds.
 *
 * Wo Liegenschaften verschiedener Fonds aneinandergrenzen, verbindet
 * sie eine orange Linie, und beide Punkte tragen einen Ring -- das, was
 * eine Fondsleitung mit zehn Fonds sonst nicht auf dem Schirm hat. Ein
 * Klick wählt die Liegenschaft; die gewählte holt die Karte nah heran.
 */
export function Universum({ punkte, kanten, fonds, gewaehlt, onWahl, hoehe = 'h-[420px] sm:h-[540px]' }: {
  punkte: Punkt[]; kanten: Kante[]; fonds: Fonds[]; gewaehlt: string | null; onWahl: (id: string | null) => void; hoehe?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const karte = useRef<L.Map | null>(null);
  const grund = useRef<L.TileLayer | null>(null);
  const schicht = useRef<L.LayerGroup | null>(null);
  const [luftbild, setLuftbild] = useState(true);
  const [bereit, setBereit] = useState(false);
  const waehle = useRef(onWahl);
  waehle.current = onWahl;

  const nr = useMemo(() => new Map(fonds.map(f => [f.id, f.nr])), [fonds]);
  const orte = useMemo(() => new Map(punkte.filter(p => p.e != null && p.n != null).map(p => {
    const w = lv95NachWgs84(Number(p.e), Number(p.n));
    return [p.id, { p, ll: L.latLng(w.lat, w.lon) }] as const;
  })), [punkte]);
  const anFremd = useMemo(() => new Set(kanten.filter(k => k.fremd).flatMap(k => [k.a, k.b])), [kanten]);
  const alles = useMemo(() => (orte.size ? L.latLngBounds([...orte.values()].map(o => o.ll)) : null), [orte]);

  // Die Karte einmal anlegen.
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
    m.on('click', () => waehle.current(null));
    schicht.current = L.layerGroup().addTo(m);
    karte.current = m;
    setBereit(true);
    return () => { el.removeEventListener('wheel', rad); m.remove(); karte.current = null; schicht.current = null; };
  }, []);

  // Grundkarte: Luftbild oder Landeskarte.
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

  // Beim ersten Mal und bei neuen Daten alles in den Rahmen.
  useEffect(() => {
    if (karte.current && alles) karte.current.fitBounds(alles, { padding: [40, 40], maxZoom: 16, animate: false });
  }, [alles, bereit]);

  // Punkte und Linien zeichnen.
  useEffect(() => {
    const g = schicht.current;
    if (!g) return;
    g.clearLayers();
    for (const k of kanten) {
      const a = orte.get(k.a), b = orte.get(k.b);
      if (!a || !b) continue;
      // Ein heller Saum unter der Linie, damit sie auf jedem Luftbild steht.
      L.polyline([a.ll, b.ll], { color: '#fff', weight: k.fremd ? 7 : 4, opacity: 0.9, interactive: false }).addTo(g);
      L.polyline([a.ll, b.ll], { color: k.fremd ? '#F26B1D' : '#9aa3b2', weight: k.fremd ? 4 : 2, interactive: false }).addTo(g);
    }
    for (const { p, ll } of orte.values()) {
      const farbe = fondsFarbe(nr.get(p.fonds) ?? 1);
      const an = p.id === gewaehlt;
      if (anFremd.has(p.id)) {
        L.circleMarker(ll, { radius: an ? 15 : 12, color: '#F26B1D', weight: 2.5, fill: false, interactive: false }).addTo(g);
      }
      const punkt = L.circleMarker(ll, {
        radius: an ? 10 : 7, color: '#fff', weight: an ? 3 : 2, fillColor: farbe, fillOpacity: 1,
      }).addTo(g);
      const zeile = [`Fonds ${nr.get(p.fonds) ?? ''}`, m2(p.flaeche), p.reserve && p.reserve > 0 ? `Reserve ${m2(p.reserve)}` : null].filter(Boolean).join(' · ');
      punkt.bindTooltip(`<b>${sicher(p.adresse)}</b><br><span>${sicher(zeile)}</span>`, { direction: 'top', offset: [0, -8], className: 'fonds-tipp' });
      punkt.on('click', e => { L.DomEvent.stopPropagation(e); waehle.current(p.id); });
    }
  }, [orte, kanten, nr, anFremd, gewaehlt, bereit]);

  // Die gewählte Liegenschaft heranholen.
  useEffect(() => {
    const m = karte.current, o = gewaehlt ? orte.get(gewaehlt) : null;
    if (!m || !o) return;
    const z = Math.max(m.getZoom(), 18);
    if (leise()) m.setView(o.ll, z); else m.flyTo(o.ll, z, { duration: 0.9 });
  }, [gewaehlt, orte, bereit]);

  const knopf = 'grid h-11 w-11 place-items-center rounded-[3px] bg-white text-[#111] shadow-[0_2px_8px_rgba(0,0,0,0.18)] hover:bg-[#f2f2f2]';

  return (
    <div className={`relative isolate overflow-hidden rounded border bg-secondary ${hoehe}`}>
      <style>{`.fonds-tipp{border:0;border-radius:3px;padding:8px 10px;font:12px/1.35 inherit;color:#111;box-shadow:0 6px 18px rgba(0,0,0,.18)}
.fonds-tipp span{color:#555}`}</style>
      <div ref={box} className="absolute inset-0 [&_.leaflet-container]:font-[inherit]" aria-label="Karte der Liegenschaften" />

      {/* Legende: die Fonds in ihren Farben, darunter was die Linie heisst. */}
      <div className="pointer-events-none absolute left-3 top-3 z-[500] max-w-[calc(100%-5rem)] rounded-[3px] bg-white/95 px-3 py-2 text-[12px] text-[#111] shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {fonds.map(f => (
            <span key={f.id} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: fondsFarbe(f.nr) }} />Fonds {f.nr}
            </span>
          ))}
        </div>
        {kanten.some(k => k.fremd) && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[#555]">
            <span className="h-[3px] w-5 rounded bg-[#F26B1D]" /> grenzen an einen anderen Fonds
          </div>
        )}
      </div>

      <div className="absolute right-3 top-3 z-[500] flex flex-col gap-1.5">
        <button type="button" className={knopf} onClick={() => karte.current?.zoomIn()} aria-label="Näher" title="Näher"><Plus className="h-4 w-4" /></button>
        <button type="button" className={knopf} onClick={() => karte.current?.zoomOut()} aria-label="Weiter weg" title="Weiter weg"><Minus className="h-4 w-4" /></button>
        <button type="button" className={knopf} aria-label="Alle Liegenschaften zeigen" title="Alle Liegenschaften zeigen"
                onClick={() => { if (alles) karte.current?.fitBounds(alles, { padding: [40, 40], maxZoom: 16 }); onWahl(null); }}><Maximize2 className="h-4 w-4" /></button>
        <button type="button" className={knopf} onClick={() => setLuftbild(v => !v)}
                aria-label={luftbild ? 'Landeskarte zeigen' : 'Luftbild zeigen'} title={luftbild ? 'Landeskarte' : 'Luftbild'}><Layers className="h-4 w-4" /></button>
      </div>

      {orte.size < punkte.length && (
        <span className="absolute bottom-3 left-3 z-[500] rounded-[3px] bg-white/95 px-2.5 py-1 text-[11px] text-[#555]">
          {punkte.length - orte.size} Liegenschaften werden beim Bund verortet …
        </span>
      )}
      {!punkte.length && (
        <div className="absolute inset-0 z-[500] grid place-items-center text-sm text-muted-foreground">Noch keine Liegenschaften eingespielt.</div>
      )}
    </div>
  );
}
