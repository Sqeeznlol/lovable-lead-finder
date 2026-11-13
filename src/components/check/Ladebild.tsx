import { useEffect, useRef } from 'react';
import { fertigBei, SAETZE, weiter, Z, type Tor } from '@/lib/ladebild-zeit';
import type { Koerper } from '@/lib/check-modell';

/**
 * Das Ladebild der Check-Seiten (Julian, 13. November, nach dem Vorbild
 * von PORT, aber mit der echten Parzelle): Die Grenze wird gezogen, die
 * Ansicht kippt ins Modell, die Nachbarn wachsen auf ihre Höhe, die
 * Baulinie erscheint, zuletzt wächst das Haus Geschoss für Geschoss.
 * Immer hell, auch auf dunklen Seiten: im Dunkeln war das Haus zwischen
 * den Nachbarn nicht zu erkennen (Julian: "mega dunkel").
 */
export interface LadebildDaten {
  /** Parzelle in Metern relativ zum Punkt der Adresse; null solange unbekannt. */
  parzelle: number[][] | null;
  /** Gebäude; null solange unbekannt, 'fehlt' wenn der Dienst nicht antwortet. */
  eigene: Koerper[] | null | 'fehlt';
  nachbarn: Koerper[];
  geschosse: number;
  baulinien: number[][][] | null | 'fehlt';
  schilder: { parzelle: string | null; zone: string | null; zoneKurz: string | null; haus: string | null };
}

const FARBEN = { tafel: '#FFFFFF', nachbar: '#D3D0C9', wand: '#E3E0DA', baulinie: '#3D6FB6' };
const klemm = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const weich = (t: number) => 1 - Math.pow(1 - klemm(t), 3);
const sanft = (t: number) => { t = klemm(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const federnd = (t: number) => { t = klemm(t); const c = 1.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const phase = (z: number, a: number, b: number) => klemm((z - a) / (b - a));
const mischen = (hex: string, mit: string, a: number) => {
  const h = (s: string) => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const p = h(hex), q = h(mit); return `rgb(${p.map((v, i) => Math.round(v * (1 - a) + q[i] * a)).join(',')})`;
};
// Ringe geschlossen und gegen den Uhrzeigersinn, sonst zeigen die Wände nach innen.
const ordnen = (r: number[][]) => {
  const g = r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r : [...r, r[0]];
  const f = g.reduce((s, p, i) => i ? s + (g[i - 1][0] * p[1] - p[0] * g[i - 1][1]) : 0, 0);
  return f < 0 ? g.slice().reverse() : g;
};
/** Dunkle Marken haben eine helle Markenfarbe; auf dem weissen Modelltisch wäre sie zu blass. */
export function tischFarbe(farbe: string): string {
  const roh = /^#[0-9a-f]{6}$/i.test(farbe) ? farbe : '#1F6F5C';
  const k = [1, 3, 5].map(i => parseInt(roh.slice(i, i + 2), 16));
  const hell = k.reduce((s, v, i) => s + (v / 255) * [0.2126, 0.7152, 0.0722][i], 0);
  return hell > 0.45 ? '#' + k.map(v => Math.round(v * 0.6).toString(16).padStart(2, '0')).join('') : roh;
}
const mitte = (r: number[][]) => r.slice(0, -1).reduce((s, p, _, a) => [s[0] + p[0] / a.length, s[1] + p[1] / a.length], [0, 0]);

export function Ladebild({ daten, farbe, onFertig }: { daten: LadebildDaten; farbe: string; onFertig: () => void }) {
  const cvRef = useRef<HTMLCanvasElement>(null), satzRef = useRef<HTMLDivElement>(null), strichRef = useRef<HTMLDivElement>(null);
  const schildRef = { parzelle: useRef<HTMLDivElement>(null), zone: useRef<HTMLDivElement>(null), haus: useRef<HTMLDivElement>(null), baulinie: useRef<HTMLDivElement>(null) };
  const datenRef = useRef(daten); datenRef.current = daten;
  const fertigRef = useRef(onFertig); fertigRef.current = onFertig;

  useEffect(() => {
    const cv = cvRef.current!, cx = cv.getContext('2d')!;
    let B = 0, H = 0, M = 1, T = 0, S = 1, pm = [0, 0], ausdehnung = 20;
    const groesse = () => {
      const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
      B = r.width; H = r.height; cv.width = Math.round(B * d); cv.height = Math.round(H * d); cx.setTransform(d, 0, 0, d, 0, 0);
      M = Math.min(B * 0.42, H * 0.5) / ausdehnung / 1.02;
    };
    const proj = ([x, y]: number[], z: number): [number, number] => {
      const a = -0.62 * T, dx = x - pm[0], dy = y - pm[1], m = M * S;
      const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
      return [B / 2 + rx * m, H * (0.46 + 0.06 * T) - ry * m * (1 - 0.48 * T) - z * m * 0.85 * T];
    };
    const tiefe = (r: number[][]) => { const a = -0.62 * T; return r.reduce((s, p) => s + (p[0] - pm[0]) * Math.sin(a) + (p[1] - pm[1]) * Math.cos(a), 0) / r.length; };
    const weg = (ring: number[][], z: number) => { cx.beginPath(); ring.forEach((p, i) => { const [u, v] = proj(p, z); if (i) cx.lineTo(u, v); else cx.moveTo(u, v); }); cx.closePath(); };
    const koerper = (ring: number[][], z0: number, z1: number, deckel: string, wl: string, wr: string, linie: string) => {
      if (z1 - z0 < 0.05) return;
      const a = -0.62 * T, waende: { p: number[]; q: number[]; t: number; hell: boolean }[] = [];
      for (let i = 0; i < ring.length - 1; i++) {
        const p = ring[i], q = ring[i + 1], nx = q[1] - p[1], ny = -(q[0] - p[0]);
        if (nx * Math.sin(a) + ny * Math.cos(a) > 0) continue;
        waende.push({ p, q, t: ((p[0] + q[0]) / 2 - pm[0]) * Math.sin(a) + ((p[1] + q[1]) / 2 - pm[1]) * Math.cos(a), hell: nx * Math.cos(a) - ny * Math.sin(a) < 0 });
      }
      waende.sort((u, v) => v.t - u.t); cx.lineJoin = 'round';
      for (const w of waende) {
        cx.beginPath(); ([[w.p, z0], [w.q, z0], [w.q, z1], [w.p, z1]] as [number[], number][]).forEach(([pt, z], i) => { const [u, v] = proj(pt, z); if (i) cx.lineTo(u, v); else cx.moveTo(u, v); });
        cx.closePath(); cx.fillStyle = w.hell ? wl : wr; cx.fill(); cx.strokeStyle = linie; cx.lineWidth = 0.6; cx.stroke();
      }
      weg(ring, z1); cx.fillStyle = deckel; cx.fill(); cx.strokeStyle = linie; cx.lineWidth = 0.8; cx.stroke();
    };
    const schatten = (liste: { r: number[][]; h: number }[], staerke: number) => {
      if (staerke <= 0) return;
      cx.beginPath();
      for (const { r, h } of liste) for (let k = 0; k <= 6; k++) {
        const f = h * k / 6;
        r.forEach((p, i) => { const [u, v] = proj([p[0] + f * 0.55, p[1] + f * 0.32], 0); if (i) cx.lineTo(u, v); else cx.moveTo(u, v); }); cx.closePath();
      }
      cx.fillStyle = `rgba(40,30,20,${0.075 * staerke})`; cx.fill('nonzero');
    };
    const setze = (el: HTMLDivElement | null, [u, v]: [number, number], an: boolean, unten = false) => {
      if (!el) return;
      // Nach der echten Breite im Bild halten, sonst ragt ein langes Schild über den Rand.
      const halb = el.offsetWidth / 2 + 8;
      el.style.left = `${Math.min(B - halb, Math.max(halb, u))}px`; el.style.top = `${unten ? v : v - 4}px`; el.classList.toggle('da', an);
    };

    // Vorbereitete Formen, neu sobald Daten kommen
    let vorbereitet: LadebildDaten | null = null, parzelle: number[][] = [], eigene: Koerper[] = [], nachbarn: (Koerper & { dist: number })[] = [], stuecke: number[][][] = [];
    const vorbereiten = (d: LadebildDaten) => {
      if (vorbereitet === d) return; vorbereitet = d;
      if (d.parzelle && d.parzelle.length > 2) {
        parzelle = ordnen(d.parzelle); pm = mitte(parzelle);
        ausdehnung = Math.max(8, ...parzelle.map(p => Math.hypot(p[0] - pm[0], p[1] - pm[1]))); groesse();
      }
      eigene = Array.isArray(d.eigene) ? d.eigene.map(e => ({ ...e, r: ordnen(e.r) })) : [];
      nachbarn = d.nachbarn.map(n => { const r = ordnen(n.r), m = mitte(r); return { h: n.h, r, dist: Math.hypot(m[0] - pm[0], m[1] - pm[1]) }; });
      // Nur zusammenhängende Stücke nahe der Parzelle, sonst entstehen Abkürzungen quer durchs Bild.
      stuecke = (Array.isArray(d.baulinien) ? d.baulinien : []).flatMap(l => {
        const aus: number[][][] = [[]];
        for (const p of l) { if (Math.hypot(p[0] - pm[0], p[1] - pm[1]) < ausdehnung * 2.6) aus[aus.length - 1].push(p); else if (aus[aus.length - 1].length) aus.push([]); }
        return aus.filter(x => x.length > 1);
      });
    };

    const marke = tischFarbe(farbe);
    const deckel = mischen(marke, '#FFFFFF', 0.5), wl = mischen(marke, '#FFFFFF', 0.18), kante = mischen(marke, '#000000', 0.22), wr2 = mischen(FARBEN.wand, '#000000', 0.08);
    const striche = [...(strichRef.current?.querySelectorAll('b') ?? [])] as HTMLElement[];
    let letzterSatz = '';

    const bild = (ms: number, fertigUm: number) => {
      const d = datenRef.current; vorbereiten(d);
      cx.clearRect(0, 0, B, H);
      T = sanft(phase(ms, Z.kipp[0], Z.kipp[1])); S = 0.84 + 0.16 * T;
      const nH = (n: { h: number; dist: number }) => n.h * weich(phase(ms, Z.welle + n.dist * 13, Z.welle + n.dist * 13 + 750));
      const nA = (n: { dist: number }) => 0.5 * weich(phase(ms, n.dist * 7, n.dist * 7 + 450));
      for (const n of nachbarn) if (nH(n) < 0.3) { cx.globalAlpha = nA(n); weg(n.r, 0); cx.strokeStyle = FARBEN.nachbar; cx.lineWidth = 1; cx.stroke(); }
      cx.globalAlpha = 1;
      const geschossH = (eigene[0]?.h ?? 3 * d.geschosse) / d.geschosse;
      const hausH = (k: number) => geschossH * federnd(phase(ms, Z.haus + k * Z.geschoss, Z.haus + k * Z.geschoss + 480));
      const hausHoehe = Array.from({ length: d.geschosse }, (_, k) => Math.max(0, hausH(k))).reduce((s, v) => s + v, 0);
      if (parzelle.length) {
        weg(parzelle, 0); cx.fillStyle = marke; cx.globalAlpha = 0.11 * weich(phase(ms, Z.fuell[0], Z.fuell[1])); cx.fill(); cx.globalAlpha = 1;
      }
      schatten([...nachbarn.map(n => ({ r: n.r, h: nH(n) })), ...eigene.map(e => ({ r: e.r, h: hausHoehe }))], T);
      let spitze: [number, number] | null = null;
      if (parzelle.length) {
        const st = parzelle.slice(1).map((p, i) => Math.hypot(p[0] - parzelle[i][0], p[1] - parzelle[i][1])), laenge = st.reduce((s, v) => s + v, 0);
        const zug = sanft(phase(ms, Z.zug[0], Z.zug[1]));
        let rest = laenge * zug; spitze = proj(parzelle[0], 0);
        cx.beginPath(); cx.moveTo(...spitze);
        for (let i = 0; i < st.length && rest > 0; i++) {
          const f = Math.min(1, rest / st[i]);
          spitze = proj([parzelle[i][0] + (parzelle[i + 1][0] - parzelle[i][0]) * f, parzelle[i][1] + (parzelle[i + 1][1] - parzelle[i][1]) * f], 0);
          cx.lineTo(...spitze); rest -= st[i];
        }
        cx.strokeStyle = marke; cx.lineWidth = 2.4; cx.lineJoin = 'round'; cx.lineCap = 'round'; cx.stroke();
        if (zug > 0 && zug < 1) { cx.beginPath(); cx.arc(...spitze, 9, 0, 7); cx.fillStyle = marke; cx.globalAlpha = 0.18; cx.fill(); cx.globalAlpha = 1; cx.beginPath(); cx.arc(...spitze, 4, 0, 7); cx.fill(); }
      }
      const blZug = sanft(phase(ms, Z.baulinie[0], Z.baulinie[1]));
      let blPunkt: number[] | null = null;
      if (blZug > 0) for (const s of stuecke) {
        const n = Math.max(2, Math.round(s.length * blZug));
        cx.beginPath(); s.slice(0, n).forEach((p, i) => { const [u, v] = proj(p, 0); if (i) cx.lineTo(u, v); else cx.moveTo(u, v); });
        cx.setLineDash([7, 5]); cx.strokeStyle = FARBEN.baulinie; cx.lineWidth = 2; cx.stroke(); cx.setLineDash([]);
        // Schild weiter draussen auf der Linie, nicht mitten auf dem Haus.
        const ziel = ausdehnung * 1.7, abst = (p: number[]) => Math.abs(Math.hypot(p[0] - pm[0], p[1] - pm[1]) - ziel);
        for (const p of s.slice(0, n)) if (!blPunkt || abst(p) < abst(blPunkt)) blPunkt = p;
      }
      [
        ...nachbarn.filter(n => nH(n) >= 0.3).map(n => ({ t: tiefe(n.r), malen: () => { cx.globalAlpha = nA(n); koerper(n.r, 0, nH(n), FARBEN.tafel, FARBEN.wand, wr2, FARBEN.nachbar); cx.globalAlpha = 1; } })),
        ...eigene.map(e => ({ t: tiefe(e.r), malen: () => { let z = 0; for (let k = 0; k < d.geschosse; k++) { const h = hausH(k); if (h > 0) { koerper(e.r, z, z + h, deckel, wl, marke, kante); z += h; } } } })),
      ].sort((u, v) => v.t - u.t).forEach(x => x.malen());
      // Ränder weich ausblenden, damit die Nachbarschaft nicht abgeschnitten wirkt
      const v = cx.createRadialGradient(B / 2, H * 0.48, Math.min(B, H) * 0.3, B / 2, H * 0.48, Math.max(B, H) * 0.62);
      v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(1, FARBEN.tafel); cx.fillStyle = v; cx.fillRect(0, 0, B, H);
      if (parzelle.length) {
        const unten = parzelle.reduce((m, p) => (proj(p, 0)[1] > proj(m, 0)[1] ? p : m), parzelle[0]);
        setze(schildRef.parzelle.current, proj(unten, 0), ms > 1250 && !!d.schilder.parzelle, true);
        const links = parzelle.reduce((m, p) => (proj(p, 0)[0] < proj(m, 0)[0] ? p : m), parzelle[0]);
        setze(schildRef.zone.current, proj(links, 0), ms > 2050 && !!d.schilder.zone);
      }
      if (blPunkt) setze(schildRef.baulinie.current, proj(blPunkt, 0), blZug > 0.5); else schildRef.baulinie.current?.classList.remove('da');
      if (eigene.length) setze(schildRef.haus.current, proj(mitte(eigene[0].r), hausHoehe + 1.5), ms > Z.haus + d.geschosse * Z.geschoss && !!d.schilder.haus);
      const i = SAETZE.filter(x => ms >= x[0]).length - 1;
      const s = ms >= fertigUm - 600 ? 'Auswertung steht' : SAETZE[i][1];
      if (s !== letzterSatz && satzRef.current) {
        letzterSatz = s; const el = satzRef.current; el.classList.add('weg');
        window.setTimeout(() => { el.textContent = s; el.classList.remove('weg'); }, 200);
      }
      // Ein Strich je Schritt; der letzte füllt sich bis zum Schluss.
      const grenzen = [...SAETZE.map(x => x[0]), fertigUm - 600, fertigUm];
      striche.forEach((b, n) => { b.style.width = `${100 * klemm((ms - grenzen[n]) / Math.max(1, grenzen[n + 1] - grenzen[n]))}%`; });
    };

    const tore: Tor[] = [
      { bei: Z.zug[0], offen: () => !!datenRef.current.parzelle, hoechstens: 20000 },
      { bei: Z.kipp[0], offen: () => datenRef.current.eigene !== null, hoechstens: 5000 },
      { bei: Z.baulinie[0], offen: () => datenRef.current.baulinien !== null, hoechstens: 6000 },
    ];
    const gewartet = new Map<number, number>(), passiert = new Set<number>();
    let uhr = 0, zuletzt = performance.now(), lauf = 0, beendet = false;
    groesse();
    const ro = new ResizeObserver(() => { groesse(); });
    ro.observe(cv);
    const schritt = (jetzt: number) => {
      // Der erste Zeitstempel von requestAnimationFrame liegt oft vor performance.now(); nie rückwärts.
      const dt = Math.max(0, Math.min(64, jetzt - zuletzt)); zuletzt = Math.max(zuletzt, jetzt);
      const d = datenRef.current, eigeneDa = Array.isArray(d.eigene) && d.eigene.length > 0;
      const fertigUm = eigeneDa ? fertigBei(d.geschosse) : Z.baulinie[1] + 700;
      uhr = weiter(uhr, dt, tore, gewartet, passiert);
      bild(uhr, fertigUm);
      if (uhr >= fertigUm && !beendet) { beendet = true; window.setTimeout(() => fertigRef.current(), 500); }
      if (!beendet) lauf = requestAnimationFrame(schritt);
    };
    lauf = requestAnimationFrame(schritt);
    return () => { cancelAnimationFrame(lauf); ro.disconnect(); };
  // Einmal beim Einblenden; neue Daten liest die Schleife aus datenRef.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ladebild" aria-live="polite" style={{ ['--tisch' as string]: tischFarbe(farbe) }}>
      <div className="ladebild-flaeche">
        <canvas ref={cvRef} aria-label="Ihre Parzelle wird aus den amtlichen Daten gezeichnet" />
        <div ref={schildRef.parzelle} className="schild unter">{daten.schilder.parzelle}</div>
        <div ref={schildRef.zone} className="schild"><span className="lang">{daten.schilder.zone}</span><span className="kurz">{daten.schilder.zoneKurz ? `Zone ${daten.schilder.zoneKurz}` : daten.schilder.zone}</span></div>
        <div ref={schildRef.baulinie} className="schild">Baulinie</div>
        <div ref={schildRef.haus} className="schild">{daten.schilder.haus}</div>
      </div>
      <div className="ladebild-zustand">
        <div ref={satzRef} className="satz">Parzelle wird gesucht …</div>
        <div className="unter-satz">Amtliche Daten von Bund und Kanton</div>
        <div ref={strichRef} className="striche">{[0, 1, 2, 3, 4].map(i => <i key={i}><b /></i>)}</div>
      </div>
    </div>
  );
}
