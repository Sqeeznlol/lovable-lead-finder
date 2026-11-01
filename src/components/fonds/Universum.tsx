import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Maximize2 } from 'lucide-react';
import { fondsFarbe, type Fonds, type Kante, type Punkt } from '@/lib/fonds';

/**
 * Das Portfolio als Universum (Julian, 1. November): jede Liegenschaft
 * ein Stern an ihrem echten Ort, die Farbe sagt den Fonds. Wo
 * Liegenschaften verschiedener Fonds aneinandergrenzen, leuchtet eine
 * Linie -- genau das, was eine Fondsleitung mit zehn Fonds sonst nicht
 * auf dem Schirm hat.
 *
 * Eine Zeichenfläche statt einer Karte: ein ruhiger, dunkler Raum, in
 * dem die Fonds selbst das Bild machen. Lage bleibt Lage (LV95,
 * massstäblich), damit "nebeneinander" auch nebeneinander aussieht.
 * Ziehen verschiebt, Rad oder +/− zoomt. Ohne Bewegung, wenn das System
 * sie abbestellt hat.
 */
export function Universum({ punkte, kanten, fonds, gewaehlt, onWahl, hoehe = 'h-[420px] sm:h-[520px]' }: {
  punkte: Punkt[]; kanten: Kante[]; fonds: Fonds[]; gewaehlt: string | null; onWahl: (id: string | null) => void; hoehe?: string;
}) {
  const huelle = useRef<HTMLDivElement>(null);
  const flaeche = useRef<HTMLCanvasElement>(null);
  const [groesse, setGroesse] = useState({ w: 800, h: 500 });
  const [sicht, setSicht] = useState({ k: 1, x: 0, y: 0 });
  const [schwebe, setSchwebe] = useState<{ p: Punkt; x: number; y: number } | null>(null);
  const zug = useRef<{ x: number; y: number; sx: number; sy: number; bewegt: boolean } | null>(null);

  const nr = useMemo(() => new Map(fonds.map(f => [f.id, f.nr])), [fonds]);
  const verortet = useMemo(() => punkte.filter(p => p.e != null && p.n != null), [punkte]);
  const nachId = useMemo(() => new Map(verortet.map(p => [p.id, p])), [verortet]);
  // Liegenschaften, die an einen anderen Fonds grenzen: sie pulsieren.
  const anFremd = useMemo(() => new Set(kanten.filter(k => k.fremd).flatMap(k => [k.a, k.b])), [kanten]);

  // Massstab: alles passt mit Rand hinein; Nord nach oben.
  const basis = useMemo(() => {
    if (!verortet.length) return null;
    const es = verortet.map(p => p.e!), ns = verortet.map(p => p.n!);
    const minE = Math.min(...es), maxE = Math.max(...es), minN = Math.min(...ns), maxN = Math.max(...ns);
    const rand = 48;
    const s = Math.min((groesse.w - 2 * rand) / Math.max(maxE - minE, 200), (groesse.h - 2 * rand) / Math.max(maxN - minN, 200));
    const ox = (groesse.w - (maxE - minE) * s) / 2, oy = (groesse.h - (maxN - minN) * s) / 2;
    return { minE, maxN, s, ox, oy };
  }, [verortet, groesse]);

  // Gruppen benachbarter Liegenschaften (über die Kanten verbunden).
  const gruppen = useMemo(() => {
    const vater = new Map<string, string>();
    const wurzel = (x: string): string => { const v = vater.get(x) ?? x; if (v === x) return x; const w = wurzel(v); vater.set(x, w); return w; };
    for (const k of kanten) if (nachId.has(k.a) && nachId.has(k.b)) vater.set(wurzel(k.a), wurzel(k.b));
    const g = new Map<string, string[]>();
    for (const p of verortet) { const w = wurzel(p.id); g.set(w, [...(g.get(w) ?? []), p.id]); }
    return [...g.values()].filter(x => x.length > 1);
  }, [kanten, nachId, verortet]);

  // Bildschirmlage. Nachbarn liegen 20 bis 50 m auseinander -- aus der
  // Kantonsansicht genau übereinander, und die leuchtende Linie, um die
  // es geht, wäre unsichtbar. Darum: liegen die Glieder einer Gruppe
  // näher als 18 px beisammen, werden sie als Sternbild um ihren
  // gemeinsamen Ort aufgefächert. Beim Hineinzoomen stehen sie wieder
  // an ihrer genauen Lage.
  const lage = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    if (!basis) return m;
    for (const p of verortet) {
      const x = basis.ox + (p.e! - basis.minE) * basis.s, y = basis.oy + (basis.maxN - p.n!) * basis.s;
      m.set(p.id, { x: x * sicht.k + sicht.x, y: y * sicht.k + sicht.y });
    }
    for (const g of gruppen) {
      const pts = g.map(id => m.get(id)!);
      const cx = pts.reduce((a, q) => a + q.x, 0) / pts.length, cy = pts.reduce((a, q) => a + q.y, 0) / pts.length;
      const weit = Math.max(...pts.map(q => Math.hypot(q.x - cx, q.y - cy)));
      if (weit >= 18) continue;
      const r = 10 + 2.5 * g.length;
      g.forEach((id, i) => {
        const w = (2 * Math.PI * i) / g.length - Math.PI / 2;
        m.set(id, { x: cx + r * Math.cos(w), y: cy + r * Math.sin(w) });
      });
    }
    return m;
  }, [basis, sicht, verortet, gruppen]);
  const bild = (p: Punkt) => lage.get(p.id)!;

  useEffect(() => {
    const el = huelle.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setGroesse({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Hintergrundsterne, einmal und fest (sonst flimmert es beim Ziehen).
  const sterne = useMemo(() => {
    let s = 7;
    const zufall = () => (s = (s * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: 220 }, () => ({ x: zufall(), y: zufall(), r: zufall() * 1.1 + 0.2, a: zufall() * 0.5 + 0.15, t: zufall() * 6 }));
  }, []);

  useEffect(() => {
    const c = flaeche.current;
    if (!c || !basis) return;
    const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = window.devicePixelRatio || 1;
    c.width = groesse.w * dpr; c.height = groesse.h * dpr;
    const g = c.getContext('2d')!;
    let lauf = 0;
    const zeichne = (t: number) => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, groesse.w, groesse.h);
      // Raum: ein schwacher Schimmer in der Mitte, Sterne dahinter.
      const raum = g.createRadialGradient(groesse.w / 2, groesse.h / 2, 0, groesse.w / 2, groesse.h / 2, Math.max(groesse.w, groesse.h) * 0.7);
      raum.addColorStop(0, '#141833'); raum.addColorStop(1, '#05060B');
      g.fillStyle = raum; g.fillRect(0, 0, groesse.w, groesse.h);
      for (const s of sterne) {
        const a = ruhig ? s.a : s.a * (0.65 + 0.35 * Math.sin(t / 900 + s.t));
        g.fillStyle = `rgba(255,255,255,${a})`;
        g.beginPath(); g.arc(s.x * groesse.w, s.y * groesse.h, s.r, 0, Math.PI * 2); g.fill();
      }
      // Verbindungen: fremde Fonds leuchten, gleiche Fonds nur angedeutet.
      for (const k of kanten) {
        const a = nachId.get(k.a), b = nachId.get(k.b);
        if (!a || !b) continue;
        const pa = bild(a), pb = bild(b);
        if (k.fremd) {
          const v = g.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
          v.addColorStop(0, fondsFarbe(nr.get(a.fonds) ?? 1)); v.addColorStop(1, fondsFarbe(nr.get(b.fonds) ?? 1));
          g.strokeStyle = v; g.lineWidth = 2; g.shadowColor = '#ffffff'; g.shadowBlur = 10;
        } else {
          g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; g.shadowBlur = 0;
        }
        g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y); g.stroke();
      }
      g.shadowBlur = 0;
      // Liegenschaften: Grösse nach Fläche, Glanz in der Fondsfarbe.
      for (const p of verortet) {
        const { x, y } = bild(p);
        if (x < -20 || y < -20 || x > groesse.w + 20 || y > groesse.h + 20) continue;
        const farbe = fondsFarbe(nr.get(p.fonds) ?? 1);
        const r = Math.max(2.2, Math.min(7, Math.sqrt(p.flaeche ?? 400) / 9)) * Math.min(1.6, Math.sqrt(sicht.k));
        g.shadowColor = farbe; g.shadowBlur = 14;
        g.fillStyle = farbe;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0;
        if (anFremd.has(p.id)) {
          const puls = ruhig ? 0.5 : (Math.sin(t / 500) + 1) / 2;
          g.strokeStyle = `rgba(255,255,255,${0.25 + 0.45 * puls})`; g.lineWidth = 1;
          g.beginPath(); g.arc(x, y, r + 3 + 3 * puls, 0, Math.PI * 2); g.stroke();
        }
        if (p.id === gewaehlt) {
          g.strokeStyle = '#ffffff'; g.lineWidth = 2;
          g.beginPath(); g.arc(x, y, r + 7, 0, Math.PI * 2); g.stroke();
        }
      }
      if (!ruhig) lauf = requestAnimationFrame(zeichne);
    };
    lauf = requestAnimationFrame(zeichne);
    return () => cancelAnimationFrame(lauf);
    // bild hängt an sicht und basis
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basis, groesse, lage, verortet, kanten, nachId, nr, anFremd, gewaehlt, sterne]);

  const naechster = (mx: number, my: number) => {
    if (!basis) return null;
    let best: { p: Punkt; d: number; x: number; y: number } | null = null;
    for (const p of verortet) {
      const { x, y } = bild(p);
      const d = Math.hypot(x - mx, y - my);
      if (d < 14 && (!best || d < best.d)) best = { p, d, x, y };
    }
    return best;
  };

  const zoom = (f: number, cx = groesse.w / 2, cy = groesse.h / 2) =>
    setSicht(s => {
      const k = Math.max(0.6, Math.min(40, s.k * f));
      return { k, x: cx - (cx - s.x) * (k / s.k), y: cy - (cy - s.y) * (k / s.k) };
    });

  // Zoomen mit Ctrl/⌘ + Rad und mit der Zwei-Finger-Geste (der Browser
  // meldet sie als Ctrl) -- ein gewöhnliches Rad scrollt die Seite,
  // sonst bliebe man beim Scrollen am Universum hängen.
  useEffect(() => {
    const c = flaeche.current;
    if (!c) return;
    const rad = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = c.getBoundingClientRect();
      zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    };
    c.addEventListener('wheel', rad, { passive: false });
    return () => c.removeEventListener('wheel', rad);
  });

  return (
    <div ref={huelle} className={`relative w-full overflow-hidden rounded bg-[#05060B] ${hoehe}`}>
      <canvas ref={flaeche} className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
        style={{ width: groesse.w, height: groesse.h }}
        aria-label={`Universum: ${verortet.length} Liegenschaften in ${fonds.length} Fonds`} role="img"
        onPointerDown={e => { (e.target as HTMLElement).setPointerCapture(e.pointerId); zug.current = { x: e.clientX, y: e.clientY, sx: sicht.x, sy: sicht.y, bewegt: false }; }}
        onPointerMove={e => {
          const r = (e.target as HTMLElement).getBoundingClientRect();
          if (zug.current) {
            const dx = e.clientX - zug.current.x, dy = e.clientY - zug.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) zug.current.bewegt = true;
            setSicht(s => ({ ...s, x: zug.current!.sx + dx, y: zug.current!.sy + dy }));
            return;
          }
          const t = naechster(e.clientX - r.left, e.clientY - r.top);
          setSchwebe(t ? { p: t.p, x: t.x, y: t.y } : null);
        }}
        onPointerUp={e => {
          const r = (e.target as HTMLElement).getBoundingClientRect();
          if (zug.current && !zug.current.bewegt) {
            const t = naechster(e.clientX - r.left, e.clientY - r.top);
            onWahl(t ? t.p.id : null);
          }
          zug.current = null;
        }}
        onPointerLeave={() => setSchwebe(null)} />

      {schwebe && (
        <div className="pointer-events-none absolute z-10 max-w-[240px] -translate-x-1/2 -translate-y-full rounded-[3px] bg-white/95 px-3 py-2 text-xs text-[#111] shadow-lg"
             style={{ left: schwebe.x, top: schwebe.y - 14 }}>
          <span className="block font-semibold">{schwebe.p.adresse}</span>
          <span className="block text-[#555]">
            Fonds {nr.get(schwebe.p.fonds)}{schwebe.p.flaeche ? ` · ${Math.round(schwebe.p.flaeche).toLocaleString('de-CH')} m²` : ''}
            {schwebe.p.reserve && schwebe.p.reserve > 0 ? ` · Reserve ${Math.round(schwebe.p.reserve).toLocaleString('de-CH')} m²` : ''}
          </span>
        </div>
      )}

      {/* Legende: die Fonds in ihren Farben. */}
      <div className="pointer-events-none absolute left-3 top-3 flex max-w-[70%] flex-wrap gap-x-3 gap-y-1.5">
        {fonds.map(f => (
          <span key={f.id} className="inline-flex items-center gap-1.5 text-[11px] text-white/80">
            <span className="h-2 w-2 rounded-full" style={{ background: fondsFarbe(f.nr), boxShadow: `0 0 6px ${fondsFarbe(f.nr)}` }} />
            Fonds {f.nr}
          </span>
        ))}
      </div>

      <div className="absolute bottom-3 right-3 flex gap-1.5">
        {[{ t: 'Näher', i: Plus, f: () => zoom(1.5) }, { t: 'Weiter weg', i: Minus, f: () => zoom(1 / 1.5) },
          { t: 'Alles zeigen', i: Maximize2, f: () => setSicht({ k: 1, x: 0, y: 0 }) }].map(b => (
          <button key={b.t} type="button" onClick={b.f} aria-label={b.t} title={b.t}
                  className="grid h-11 w-11 place-items-center rounded-[3px] border border-white/15 bg-white/5 text-white/85 hover:bg-white/15">
            <b.i className="h-4 w-4" />
          </button>
        ))}
      </div>

      {verortet.length < punkte.length && (
        <span className="absolute bottom-4 left-3 text-[11px] text-white/60">
          {punkte.length - verortet.length} Liegenschaften werden beim Bund verortet …
        </span>
      )}
      {!punkte.length && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/70">Noch keine Liegenschaften eingespielt.</div>
      )}
    </div>
  );
}
