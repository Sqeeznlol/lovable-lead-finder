import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { lv95NachWgs84 } from '@/lib/koordinaten';
import { markeFuerHost, markeNachId, STANDARD_MARKE, type Marke } from '@/lib/check-marken';
import {
  ANTWORT_TEXT, befundAmOrt, GEBAEUDEART, HEIZUNG, herkunft, leadAngaben, prioritaet, STATUS, ueberbauung, vorschlaege,
  type Antwort, type Befund, type Ort,
} from '@/lib/check-daten';

/**
 * Die Check-Seiten für Eigentümer: ParzellenChecker, HausChecker, Was
 * darf ich bauen? ... -- eine Seite, viele Domains (src/lib/check-marken.ts).
 *
 * Vorbild ist der "ParzellenCheck Schweiz" (Julian, 6. November): Adresse
 * suchen, Karte mit Parzelle, Fläche, Zone, Gebäude. Dort fehlte der
 * Grund, Kontakt zu hinterlassen; hier ist es die ausführliche Analyse,
 * die Fachleute aus unserem Bestand machen. Eigentum, Absicht und
 * Zeitraum werden gefragt, weil erst sie aus einem Formular einen Lead
 * machen.
 *
 * Offen ohne Anmeldung, darf nur EINE Anfrage einfügen (anfrage, art
 * potenzial, angaben.quelle = check). Alles Gezeigte kommt vom Bund.
 */

// Wer die Seiten betreibt -- gehört ins Impressum und in die Einwilligung.
// Rechtlicher Name, Adresse und UID trägt Julian nach (docs/werbeplan-eigentuemer.md, Abschnitt 8).
const BETREIBER = 'Bauraum';

const STIL = `
.pc{--seite:#F4F4F5;--tafel:#fff;--tinte:#111;--grau:#646B78;--linie:#E4E4E7;--r:3px;min-height:100vh;background:var(--seite);color:var(--tinte);font-family:'Urbanist',system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.45;-webkit-font-smoothing:antialiased}
.pc *{box-sizing:border-box}.pc button,.pc input{font:inherit;color:inherit}
.pc .huelle{max-width:1320px;margin:0 auto;padding:0 16px}@media(min-width:900px){.pc .huelle{padding:0 40px}}
.pc .kopf{background:var(--tafel);border-bottom:1px solid var(--linie)}.pc .kopf .huelle{display:flex;align-items:center;height:68px;gap:16px}
.pc .wortmarke{font-size:22px;letter-spacing:-.02em;font-weight:500;white-space:nowrap}.pc .wortmarke b{font-weight:700;color:var(--marke)}
.pc .kopf .rechts{margin-left:auto;display:flex;gap:8px;align-items:center}
.pc .knopf{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 18px;border-radius:var(--r);border:1px solid var(--linie);background:var(--tafel);cursor:pointer;font-weight:500;transition:transform .12s ease}
.pc .knopf:active{transform:scale(.97)}.pc .knopf.haupt{background:var(--tinte);border-color:var(--tinte);color:#fff}.pc .knopf.marke{background:var(--marke);border-color:var(--marke);color:#fff}
.pc .knopf[disabled]{opacity:.4;cursor:default}.pc :focus-visible{outline:2px solid var(--marke);outline-offset:2px}
.pc .nur-gross{display:none}@media(min-width:700px){.pc .nur-gross{display:inline-flex}}
.pc .buehne{padding:56px 0 40px}.pc .ueber{text-transform:uppercase;letter-spacing:.12em;font-size:12px;font-weight:600;color:var(--grau)}
.pc h1{font-size:clamp(34px,5.4vw,64px);line-height:1.02;letter-spacing:-.025em;font-weight:500;margin:12px 0 14px;max-width:14ch}
.pc .satz{font-size:18px;color:var(--grau);max-width:56ch;margin:0 0 28px}
.pc .suche{position:relative;max-width:760px}.pc .feldzeile{display:flex;gap:8px;background:var(--tafel);border:1px solid var(--linie);border-radius:var(--r);padding:6px;box-shadow:0 10px 30px rgba(17,17,17,.06)}
.pc .feldzeile input{flex:1;min-width:0;border:0;outline:0;padding:0 12px;font-size:17px;background:transparent;height:48px}.pc .feldzeile .knopf{height:48px;white-space:nowrap}
.pc .vorschlaege{position:absolute;z-index:1000;left:0;right:0;top:calc(100% + 6px);background:var(--tafel);border:1px solid var(--linie);border-radius:var(--r);list-style:none;margin:0;padding:4px 0;box-shadow:0 12px 30px rgba(17,17,17,.1)}
.pc .vorschlaege button{display:block;width:100%;text-align:left;border:0;background:none;padding:12px 16px;min-height:44px;cursor:pointer}.pc .vorschlaege button:hover,.pc .vorschlaege button[aria-selected=true]{background:var(--seite)}
.pc .hinweis{font-size:13px;color:var(--grau);margin-top:12px}
.pc .kennband{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:var(--linie);border:1px solid var(--linie);border-radius:var(--r);overflow:hidden;margin-top:36px;max-width:760px}
.pc .kennband div{background:var(--tafel);padding:16px 18px}.pc .kennband b{display:block;font-size:22px;font-weight:500}.pc .kennband span{font-size:13px;color:var(--grau)}
.pc .ergebnis{padding-bottom:64px}.pc .raster{display:grid;grid-template-columns:1fr;gap:16px}
@media(min-width:1000px){.pc .raster{grid-template-columns:minmax(0,1.45fr) minmax(380px,1fr);align-items:start}}
.pc .karte-tafel{position:relative;border:1px solid var(--linie);border-radius:var(--r);overflow:hidden;background:#e9eaec;height:360px}
@media(min-width:1000px){.pc .karte-tafel{height:calc(100vh - 140px);min-height:560px;position:sticky;top:16px}}
.pc .karte{position:absolute;inset:0}.pc .leaflet-container{font-family:inherit}
.pc .schalter{position:absolute;z-index:500;top:12px;left:12px;display:flex;background:var(--tafel);border-radius:var(--r);box-shadow:0 2px 8px rgba(0,0,0,.15);overflow:hidden}
.pc .schalter button{border:0;background:none;padding:0 14px;min-height:40px;cursor:pointer;font-weight:500}.pc .schalter button[aria-pressed=true]{background:var(--tinte);color:#fff}
.pc .band{position:absolute;z-index:500;left:12px;bottom:12px;display:flex;gap:1px;background:var(--linie);border-radius:var(--r);overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.15)}
.pc .band div{background:var(--tafel);padding:10px 14px;min-width:92px}.pc .band span{display:block;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--grau)}.pc .band b{font-size:18px;font-weight:500}
.pc .tafel{background:var(--tafel);border:1px solid var(--linie);border-radius:var(--r)}.pc .seitenteil>*+*{margin-top:16px}
.pc .kopfteil{padding:22px 22px 18px;border-bottom:1px solid var(--linie)}.pc .ort{font-size:13px;color:var(--grau);display:flex;gap:8px;align-items:center}
.pc .kanton{font-size:11px;font-weight:600;border:1px solid var(--linie);border-radius:var(--r);padding:2px 6px;color:var(--tinte)}
.pc .kopfteil h2{font-size:26px;line-height:1.15;letter-spacing:-.02em;font-weight:500;margin:8px 0 6px}
.pc .egrid{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--grau);letter-spacing:.04em}
.pc .stand{margin-top:10px;font-size:13px;color:#8A6512;display:flex;align-items:center;gap:6px}.pc .stand:before{content:"";width:7px;height:7px;border-radius:50%;background:#D6A21B}
.pc .zahlen{display:grid;grid-template-columns:1fr 1fr}.pc .zahlen>div{padding:18px 22px}.pc .zahlen>div+div{border-left:1px solid var(--linie)}
.pc .zahlen span{font-size:13px;color:var(--grau)}.pc .zahlen b{display:block;font-size:34px;font-weight:500;letter-spacing:-.02em;margin-top:4px;line-height:1.1;overflow-wrap:anywhere}
.pc .zahlen small{font-size:15px;color:var(--grau);font-weight:500}.pc .zahlen em{display:block;font-style:normal;font-size:12px;color:var(--grau);margin-top:4px}
.pc .abschnitt{padding:18px 22px;border-top:1px solid var(--linie)}.pc .abschnitt h3{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--grau);font-weight:600;margin:0 0 12px}
.pc .balken{height:8px;background:var(--seite);border-radius:4px;overflow:hidden;margin:10px 0 6px}.pc .balken i{display:block;height:100%;background:var(--marke);border-radius:4px;transition:width .8s cubic-bezier(.2,.8,.2,1)}
.pc .gross{font-size:30px;font-weight:500;letter-spacing:-.02em}.pc .klein{font-size:13px;color:var(--grau)}
.pc .haeuser{list-style:none;margin:0;padding:0}.pc .haeuser li{padding:12px 0;border-top:1px solid var(--linie)}.pc .haeuser li:first-child{border-top:0;padding-top:0}
.pc .haeuser .titel{font-weight:600;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pc .chip{font-size:11px;font-weight:600;border-radius:var(--r);padding:2px 7px;background:var(--seite);color:var(--grau)}.pc .chip.projekt{background:#FFF1E8;color:#B4501A}
.pc .haeuser dl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:8px 0 0}.pc .haeuser dt{font-size:11px;color:var(--grau)}.pc .haeuser dd{margin:0;font-weight:500}
@media(max-width:420px){.pc .haeuser dl{grid-template-columns:repeat(2,minmax(0,1fr))}}
.pc .analyse{padding:24px 22px;background:var(--tinte);color:#fff;border-color:var(--tinte)}.pc .analyse .ueber{color:rgba(255,255,255,.6)}
.pc .analyse h3{font-size:24px;font-weight:500;letter-spacing:-.02em;margin:8px 0 14px}.pc .analyse ul{list-style:none;padding:0;margin:0 0 20px}
.pc .analyse li{padding:9px 0 9px 26px;position:relative;border-top:1px solid rgba(255,255,255,.12)}
.pc .analyse li:before{content:"";position:absolute;left:2px;top:16px;width:12px;height:7px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg)}
.pc .analyse .knopf{width:100%;background:#fff;color:#111;border-color:#fff;font-weight:600}.pc .analyse .fein{font-size:12px;color:rgba(255,255,255,.6);margin-top:10px;text-align:center}
.pc .formular{padding:22px}.pc .schritt{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--grau);font-weight:600}
.pc .frage{font-size:18px;font-weight:600;margin:18px 0 10px;letter-spacing:-.01em}.pc .wahl{display:flex;flex-wrap:wrap;gap:8px}
.pc .wahl button{border:1px solid var(--linie);background:var(--tafel);border-radius:var(--r);padding:10px 14px;min-height:44px;cursor:pointer;text-align:left}
.pc .wahl button[aria-pressed=true]{border-color:var(--tinte);background:var(--tinte);color:#fff}
.pc .feld{display:block;margin-top:14px}.pc .feld span{display:block;font-size:13px;color:var(--grau);margin-bottom:6px}
.pc .feld input{width:100%;height:48px;border:1px solid var(--linie);border-radius:var(--r);padding:0 14px;background:var(--tafel);font-size:16px}
.pc .zwei{display:grid;grid-template-columns:1fr;gap:0 12px}@media(min-width:520px){.pc .zwei{grid-template-columns:1fr 1fr}}
.pc .zustimmung{display:flex;gap:12px;align-items:flex-start;margin:18px 0;font-size:13px;color:var(--grau)}.pc .zustimmung input{width:20px;height:20px;margin-top:1px;flex:none}
.pc .fehler{color:#C2311B;font-size:14px;margin:8px 0 0}.pc .falle{position:absolute;left:-10000px;width:1px;height:1px;opacity:0}
.pc .zeile{display:flex;gap:8px;margin-top:18px}.pc .zeile .knopf{flex:1}
.pc .danke{padding:26px 22px}.pc .danke h3{font-size:24px;letter-spacing:-.02em;font-weight:500;margin:0 0 8px}
.pc .laedt{color:var(--grau);font-size:14px;padding:22px}
.pc .meine{position:relative}.pc .meine-liste{position:absolute;right:0;top:calc(100% + 6px);z-index:1200;width:min(360px,calc(100vw - 32px));background:var(--tafel);border:1px solid var(--linie);border-radius:var(--r);box-shadow:0 12px 30px rgba(17,17,17,.12);padding:6px 0}
.pc .meine-liste button{display:block;width:100%;text-align:left;background:none;border:0;padding:10px 14px;min-height:44px;cursor:pointer}.pc .meine-liste button:hover{background:var(--seite)}.pc .meine-liste p{margin:0;padding:12px 14px;color:var(--grau);font-size:14px}
.pc footer{border-top:1px solid var(--linie);background:var(--tafel)}.pc footer .huelle{display:flex;flex-wrap:wrap;gap:8px 20px;padding-top:22px;padding-bottom:28px;font-size:13px;color:var(--grau)}
.pc footer .huelle span:first-child{margin-right:auto}.pc footer button{background:none;border:0;padding:0;cursor:pointer;color:inherit;text-decoration:underline}
.pc .rechtliches{max-width:720px;padding:40px 0 64px}.pc .rechtliches h2{font-size:28px;font-weight:500;letter-spacing:-.02em}.pc .rechtliches p{color:var(--grau)}
`;

const n = (x: number | null | undefined) => (x == null ? '–' : Math.round(x).toLocaleString('de-CH'));
const kurzZone = (z: string | null) => (!z ? '–' : z.replace(/zonen?$/i, '').trim().replace(/^Wohn$/, 'Wohnen') || z);
const SPEICHER = 'check-analysen';
const gemerkt = (): Ort[] => { try { return JSON.parse(localStorage.getItem(SPEICHER) || '[]'); } catch { return []; } };

export default function Check({ marke: vorgabe }: { marke?: Marke }) {
  const { marke: markeId } = useParams();
  // Auf einer Marken-Domain entscheidet der Hostname, sonst /check/:marke (Vorschau auf unserer Domain).
  const marke = useMemo(() => vorgabe ?? markeFuerHost(window.location.hostname) ?? markeNachId(markeId) ?? STANDARD_MARKE, [vorgabe, markeId]);
  const domain = useMemo(() => {
    const h = window.location.hostname.replace(/^www\./, '');
    return marke.domains.includes(h) ? h : marke.domains[0];
  }, [marke]);
  const [text, setText] = useState('');
  const [liste, setListe] = useState<Ort[]>([]);
  const [aktiv, setAktiv] = useState(-1);
  const [ort, setOrt] = useState<Ort | null>(null);
  const [befund, setBefund] = useState<Befund | null>(null);
  const [laden, setLaden] = useState<'' | 'laeuft' | 'fehler'>('');
  const [schritt, setSchritt] = useState<0 | 1 | 2 | 3>(0);
  const [antwort, setAntwort] = useState<Antwort>({ eigentuemer: null, absicht: null, zeitraum: null });
  const [kontakt, setKontakt] = useState({ name: '', email: '', telefon: '', website: '' });
  const [ja, setJa] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [luftbild, setLuftbild] = useState(false);
  const [meineAuf, setMeineAuf] = useState(false);
  const [recht, setRecht] = useState<'impressum' | 'datenschutz' | null>(null);
  const kartenBox = useRef<HTMLDivElement>(null);
  const karte = useRef<L.Map | null>(null);
  const grund = useRef<L.TileLayer | null>(null);
  const umriss = useRef<L.Polygon | null>(null);
  const ergebnisRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `${marke.name.join('')} · ${marke.titel}`;
    if (!document.getElementById('gisk-fonts')) {
      const l = document.createElement('link');
      l.id = 'gisk-fonts'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Urbanist:wght@300;400;500;600;700&display=swap';
      document.head.appendChild(l);
    }
  }, [marke]);

  // Vorschläge, kurz verzögert; ältere Antworten verwerfen.
  useEffect(() => {
    if (ort && text === ort.label) return;
    const ab = new AbortController();
    const t = setTimeout(() => { vorschlaege(text, ab.signal).then(l => { setListe(l); setAktiv(-1); }).catch(() => {}); }, 220);
    return () => { clearTimeout(t); ab.abort(); };
  }, [text, ort]);

  // Karte, sobald es ein Ergebnis gibt.
  useEffect(() => {
    if (!ort || !kartenBox.current || karte.current) return;
    const m = L.map(kartenBox.current, { zoomControl: false, maxZoom: 20 });
    L.control.zoom({ position: 'topright' }).addTo(m);
    m.attributionControl.setPrefix('');
    L.tileLayer.wms('https://wms.geo.admin.ch/', { layers: 'ch.kantone.cadastralwebmap-farbe', format: 'image/png', transparent: true,
      opacity: 0.55, minZoom: 16, maxZoom: 20, attribution: '© Amtliche Vermessung' }).addTo(m);
    karte.current = m;
    return () => { m.remove(); karte.current = null; grund.current = null; umriss.current = null; };
  }, [ort]);

  useEffect(() => {
    const m = karte.current;
    if (!m) return;
    const e = luftbild ? { id: 'ch.swisstopo.swissimage', max: 20 } : { id: 'ch.swisstopo.pixelkarte-grau', max: 19 };
    grund.current?.remove();
    grund.current = L.tileLayer(`https://wmts.geo.admin.ch/1.0.0/${e.id}/default/current/3857/{z}/{x}/{y}.jpeg`,
      { maxZoom: 20, maxNativeZoom: e.max, attribution: '© swisstopo' }).addTo(m);
    grund.current.bringToBack();
  }, [luftbild, ort]);

  useEffect(() => {
    const m = karte.current;
    if (!m || !ort) return;
    m.invalidateSize();
    const w = lv95NachWgs84(ort.e, ort.n);
    if (!befund) { m.setView([w.lat, w.lon], 18, { animate: false }); return; }
    umriss.current?.remove();
    if (befund.teile.length) {
      const ll = befund.teile.map(t => t.map(r => r.map(([e, nn]) => { const p = lv95NachWgs84(e, nn); return [p.lat, p.lon] as [number, number]; })));
      umriss.current = L.polygon(ll, { color: marke.farbe, weight: 3, fillColor: marke.farbe, fillOpacity: 0.12 }).addTo(m);
      m.fitBounds(umriss.current.getBounds(), { padding: [60, 60], maxZoom: 19, animate: false });
    }
  }, [befund, ort, marke]);

  const waehlen = async (v: Ort) => {
    setOrt(v); setText(v.label); setListe([]); setBefund(null); setLaden('laeuft'); setSchritt(0); setFehler(null);
    setTimeout(() => ergebnisRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 60);
    try {
      const b = await befundAmOrt(v);
      setBefund(b); setLaden('');
      try { localStorage.setItem(SPEICHER, JSON.stringify([v, ...gemerkt().filter(x => x.label !== v.label)].slice(0, 12))); } catch { /* privates Fenster */ }
    } catch { setLaden('fehler'); }
  };

  const oeffnen = () => {
    if (!befund) { document.getElementById('pc-eingabe')?.focus(); return; }
    setSchritt(1);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  const mailOk = !kontakt.email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(kontakt.email.trim());
  const bereit = kontakt.name.trim().length >= 2 && !!(kontakt.email.trim() || kontakt.telefon.trim()) && mailOk && ja;

  const senden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bereit || !befund || sendet) return;
    // Ein Feld, das Menschen nicht sehen: füllt es jemand, ist es ein Programm.
    if (kontakt.website) { setSchritt(3); return; }
    setSendet(true); setFehler(null);
    const angaben = leadAngaben({ marke: marke.id, domain, antwort, befund, herkunft: herkunft(window.location.search) });
    if (document.referrer) angaben.referrer = document.referrer.slice(0, 200);
    if (ort) angaben.lv95 = [Math.round(ort.e), Math.round(ort.n)];
    // Ohne Rückgabe der Zeile: der öffentliche Schlüssel darf einfügen, nicht lesen.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('anfrage').insert({
      art: 'potenzial', name: kontakt.name.trim().slice(0, 120), email: kontakt.email.trim() || null, telefon: kontakt.telefon.trim() || null,
      adresse: befund.adresse.slice(0, 200), egrid: befund.egrid, angaben, einwilligung: true,
    });
    setSendet(false);
    if (error) { setFehler('Das hat nicht geklappt. Bitte versuchen Sie es noch einmal.'); return; }
    setSchritt(3);
  };

  const wahl = <K extends keyof Antwort>(feld: K, werte: Record<string, string>) => (
    <div className="wahl">
      {Object.entries(werte).map(([w, t]) => (
        <button key={w} type="button" aria-pressed={antwort[feld] === w}
                onClick={() => setAntwort(a => ({ ...a, [feld]: w as Antwort[K] }))}>{t}</button>
      ))}
    </div>
  );

  const ub = befund ? ueberbauung(befund) : null;
  const bestehend = befund?.haeuser.filter(h => h.status === 1004 || h.status === 1003) ?? [];
  const projekt = befund?.haeuser.some(h => h.status === 1001 || h.status === 1002);

  return (
    <div className="pc" style={{ ['--marke' as string]: marke.farbe }}>
      <style>{STIL}</style>
      <header className="kopf">
        <div className="huelle">
          <span className="wortmarke">{marke.name[0]}<b>{marke.name[1]}</b></span>
          <div className="rechts">
            <div className="meine">
              <button type="button" className="knopf" aria-expanded={meineAuf} onClick={() => setMeineAuf(v => !v)}>Meine Analysen</button>
              {meineAuf && (
                <div className="meine-liste">
                  {gemerkt().length ? gemerkt().map(x => (
                    <button key={x.label} type="button" onClick={() => { setMeineAuf(false); void waehlen(x); }}>{x.label}</button>
                  )) : <p>Noch keine Analyse auf diesem Gerät.</p>}
                </div>
              )}
            </div>
            <button type="button" className="knopf haupt nur-gross" onClick={oeffnen}>Analyse anfordern</button>
          </div>
        </div>
      </header>

      {recht ? (
        <main className="huelle rechtliches">
          <h2>{recht === 'impressum' ? 'Impressum' : 'Datenschutz'}</h2>
          {recht === 'impressum'
            ? <p>{marke.name.join('')} ist ein Angebot von {BETREIBER}. Firmenname, Postadresse, E-Mail und UID werden hier ergänzt.</p>
            : <p>Wir speichern die Angaben, die Sie im Formular machen (Name, E-Mail, Telefon, Adresse der Liegenschaft und Ihre Antworten), um Ihnen die Analyse zu erstellen und Sie zu Ihrer Liegenschaft zu kontaktieren. Die angezeigten Grundstücksdaten stammen von geo.admin.ch. Die vollständige Datenschutzerklärung mit Verantwortlichem, Auftragsbearbeitern und Ländern wird mit den Angaben zum Betreiber ergänzt.</p>}
          <button type="button" className="knopf" onClick={() => setRecht(null)}>Zurück</button>
        </main>
      ) : (
      <main>
        <section className="buehne">
          <div className="huelle">
            <div className="ueber">{marke.ueber}</div>
            <h1>{marke.titel}</h1>
            <p className="satz">{marke.satz}</p>
            <form className="suche" role="search" autoComplete="off"
                  onSubmit={e => { e.preventDefault(); const v = liste[aktiv >= 0 ? aktiv : 0]; if (v) void waehlen(v); }}>
              <div className="feldzeile">
                <input id="pc-eingabe" value={text} placeholder="Strasse Nr., PLZ Ort" aria-label="Adresse des Grundstücks"
                       onChange={e => { setText(e.target.value); setOrt(null); }}
                       onKeyDown={e => {
                         if (!liste.length) return;
                         if (e.key === 'ArrowDown') { setAktiv(a => (a + 1) % liste.length); e.preventDefault(); }
                         if (e.key === 'ArrowUp') { setAktiv(a => (a - 1 + liste.length) % liste.length); e.preventDefault(); }
                         if (e.key === 'Escape') setListe([]);
                       }} />
                <button className="knopf marke" type="submit">Grundstück prüfen</button>
              </div>
              {liste.length > 0 && (
                <ul className="vorschlaege" role="listbox">
                  {liste.map((v, i) => (
                    <li key={`${v.label}-${i}`}><button type="button" role="option" aria-selected={i === aktiv} onClick={() => void waehlen(v)}>{v.label}</button></li>
                  ))}
                </ul>
              )}
            </form>
            <p className="hinweis">Kostenlos. Daten der amtlichen Vermessung, der Bauzonen Schweiz und des Gebäude- und Wohnungsregisters.</p>
            {!ort && (
              <div className="kennband">
                <div><b>Jede Parzelle</b><span>der Schweiz</span></div>
                <div><b>Amtlich</b><span>Bund und Kantone</span></div>
                <div><b>In Sekunden</b><span>ohne Anmeldung</span></div>
              </div>
            )}
          </div>
        </section>

        {ort && (
          <section className="ergebnis" ref={ergebnisRef} aria-live="polite">
            <div className="huelle">
              <div className="raster">
                <div className="karte-tafel">
                  <div className="karte" ref={kartenBox} aria-label="Karte mit der Parzelle" />
                  <div className="schalter" role="group" aria-label="Grundkarte">
                    <button type="button" aria-pressed={!luftbild} onClick={() => setLuftbild(false)}>Karte</button>
                    <button type="button" aria-pressed={luftbild} onClick={() => setLuftbild(true)}>Luftbild</button>
                  </div>
                  {befund && (
                    <div className="band">
                      <div><span>Grundstück</span><b>{n(befund.flaeche)} m²</b></div>
                      <div><span>Bauzone</span><b>{kurzZone(befund.zone)}</b></div>
                      <div><span>Parzelle</span><b>{befund.nummer ?? '–'}</b></div>
                    </div>
                  )}
                </div>

                <div className="seitenteil">
                  <div className="tafel">
                    {laden === 'laeuft' && <div className="laedt">Amtliche Daten werden abgefragt …</div>}
                    {laden === 'fehler' && <div className="laedt">Die amtlichen Dienste antworten gerade nicht. Bitte in einer Minute nochmals versuchen.</div>}
                    {befund && (
                      <>
                        <div className="kopfteil">
                          <div className="ort">{befund.kanton && <span className="kanton">{befund.kanton}</span>}<span>{befund.gemeinde}{befund.nummer ? ` · Parzelle ${befund.nummer}` : ''}</span></div>
                          <h2>{befund.adresse}</h2>
                          {befund.egrid && <div className="egrid">{befund.egrid}</div>}
                          <div className="stand">Vorprüfung · Abklärungen offen</div>
                        </div>
                        <div className="zahlen">
                          <div><span>Grundstücksfläche</span><b>{n(befund.flaeche)}<small> m²</small></b><em>Aus dem amtlichen Umriss</em></div>
                          <div><span>Bauzone</span><b>{kurzZone(befund.zone)}</b><em>{befund.zone ?? 'keine Bauzone erfasst'}</em></div>
                        </div>
                        {ub && (
                          <div className="abschnitt">
                            <h3>Erste Einordnung</h3>
                            <div className="gross">{ub.anteil} %</div>
                            <div className="balken"><i style={{ width: `${ub.anteil}%` }} /></div>
                            <div className="klein">der Grundstücksfläche sind heute überbaut ({n(ub.flaeche)} von {n(befund.flaeche)} m² Gebäudegrundfläche laut Register). Wie viel mehr erlaubt wäre, hängt von der Bau- und Zonenordnung der Gemeinde ab.</div>
                          </div>
                        )}
                        <div className="abschnitt">
                          <h3>Gebäude laut Register{bestehend.length ? ` · ${bestehend.length}` : ''}</h3>
                          {befund.haeuser.length ? (
                            <ul className="haeuser">
                              {befund.haeuser.slice(0, 6).map(h => (
                                <li key={h.egid}>
                                  <div className="titel">{h.adresse ?? 'Gebäude'} <span className={`chip ${h.status === 1001 || h.status === 1002 ? 'projekt' : ''}`}>{h.status ? STATUS[h.status] : ''}</span></div>
                                  <div className="klein">{h.klasse ? GEBAEUDEART[h.klasse] : ''}</div>
                                  <dl>
                                    <div><dt>Baujahr</dt><dd>{h.baujahr ?? '–'}</dd></div>
                                    <div><dt>Geschosse</dt><dd>{h.geschosse ?? '–'}</dd></div>
                                    <div><dt>Wohnungen</dt><dd>{h.wohnungen ?? '–'}</dd></div>
                                    <div><dt>Heizung</dt><dd>{h.energie ? HEIZUNG[h.energie] ?? '–' : '–'}</dd></div>
                                  </dl>
                                </li>
                              ))}
                            </ul>
                          ) : <div className="klein">Auf dieser Parzelle ist kein Gebäude im Register eingetragen.</div>}
                          {projekt && <p className="klein" style={{ margin: '12px 0 0' }}>Im Register ist ein Projekt eingetragen. Was das für Ihr Grundstück bedeutet, gehört in die ausführliche Analyse.</p>}
                        </div>
                        <div className="abschnitt klein">Quellen: Amtliche Vermessung (Bund und Kantone), Bauzonen Schweiz (ARE), Gebäude- und Wohnungsregister (BFS), abgefragt über geo.admin.ch am {new Date().toLocaleDateString('de-CH')}. Vorprüfung, keine Bewilligungszusage.</div>
                      </>
                    )}
                  </div>

                  {befund && schritt === 0 && (
                    <div className="tafel analyse">
                      <div className="ueber">Kostenlos und unverbindlich</div>
                      <h3>{marke.analyse}</h3>
                      <ul>{marke.vorteile.map(v => <li key={v}>{v}</li>)}</ul>
                      <button type="button" className="knopf" onClick={oeffnen}>Jetzt anfordern</button>
                      <div className="fein">Antwort innert zwei Arbeitstagen</div>
                    </div>
                  )}

                  {befund && (schritt === 1 || schritt === 2) && (
                    <div className="tafel formular" ref={formRef}>
                      <form onSubmit={senden} noValidate>
                        {schritt === 1 ? (
                          <>
                            <div className="schritt">Schritt 1 von 2</div>
                            <div className="frage">Sind Sie Eigentümer/in dieser Liegenschaft?</div>
                            {wahl('eigentuemer', ANTWORT_TEXT.eigentuemer)}
                            <div className="frage">Was beschäftigt Sie?</div>
                            {wahl('absicht', ANTWORT_TEXT.absicht)}
                            <div className="frage">Bis wann?</div>
                            {wahl('zeitraum', ANTWORT_TEXT.zeitraum)}
                            <div className="zeile">
                              <button type="button" className="knopf haupt" disabled={!(antwort.eigentuemer && antwort.absicht && antwort.zeitraum)}
                                      onClick={() => setSchritt(2)}>Weiter</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="schritt">Schritt 2 von 2</div>
                            <div className="frage">Wohin dürfen wir Ihre Analyse schicken?</div>
                            <label className="feld"><span>Vorname und Name</span>
                              <input autoComplete="name" value={kontakt.name} onChange={e => setKontakt(k => ({ ...k, name: e.target.value }))} autoFocus /></label>
                            <div className="zwei">
                              <label className="feld"><span>E-Mail</span>
                                <input type="email" autoComplete="email" value={kontakt.email} onChange={e => setKontakt(k => ({ ...k, email: e.target.value }))} /></label>
                              <label className="feld"><span>Telefon</span>
                                <input type="tel" autoComplete="tel" placeholder="079 123 45 67" value={kontakt.telefon} onChange={e => setKontakt(k => ({ ...k, telefon: e.target.value }))} /></label>
                            </div>
                            <input className="falle" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
                                   value={kontakt.website} onChange={e => setKontakt(k => ({ ...k, website: e.target.value }))} />
                            <label className="zustimmung">
                              <input type="checkbox" checked={ja} onChange={e => setJa(e.target.checked)} />
                              <span>Ich bin einverstanden, dass {BETREIBER} meine Angaben speichert und mich zu dieser Liegenschaft kontaktiert, auch zu einem möglichen Verkauf oder einer Entwicklung. Ich kann die Einwilligung jederzeit widerrufen.</span>
                            </label>
                            {!mailOk && <p className="fehler">Bitte die E-Mail-Adresse prüfen.</p>}
                            {fehler && <p className="fehler">{fehler}</p>}
                            <div className="zeile">
                              <button type="button" className="knopf" onClick={() => setSchritt(1)}>Zurück</button>
                              <button type="submit" className="knopf haupt" disabled={!bereit || sendet}>{sendet ? 'Wird gesendet …' : 'Analyse anfordern'}</button>
                            </div>
                          </>
                        )}
                      </form>
                    </div>
                  )}

                  {befund && schritt === 3 && (
                    <div className="tafel danke">
                      <h3>Danke, {kontakt.name.trim().split(' ')[0] || 'für Ihre Anfrage'}.</h3>
                      <p className="klein" style={{ fontSize: 15 }}>
                        Ihre Analyse zu <b style={{ color: '#111' }}>{befund.adresse}</b> ist in Arbeit. Wir melden uns innert zwei Arbeitstagen
                        {kontakt.telefon.trim() ? ' telefonisch' : ' per E-Mail'}.
                      </p>
                      {prioritaet(antwort) === 'heiss' && <p className="klein">Weil Sie bald handeln möchten, rufen wir Sie wenn möglich schon heute an.</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      )}

      <footer>
        <div className="huelle">
          <span>{marke.name.join('')} · ein Angebot von {BETREIBER}</span>
          <button type="button" onClick={() => { setRecht('impressum'); window.scrollTo({ top: 0 }); }}>Impressum</button>
          <button type="button" onClick={() => { setRecht('datenschutz'); window.scrollTo({ top: 0 }); }}>Datenschutz</button>
        </div>
      </footer>
    </div>
  );
}

