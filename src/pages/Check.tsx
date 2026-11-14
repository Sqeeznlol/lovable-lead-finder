import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './check.css';
import { supabase } from '@/integrations/supabase/client';
import { lv95NachWgs84 } from '@/lib/koordinaten';
import { BETREIBER, markeFuerHost, markeNachId, STANDARD_MARKE, type Marke } from '@/lib/check-marken';
import { KATASTER } from '@/lib/check-hintergrund';
import { useImBild } from '@/lib/im-bild';
import { zaehlen } from '@/lib/check-zaehlen';
import { buehnenBild, markenAttribute, markenStil, seiteEinrichten } from '@/lib/check-gestaltung';
import { gebaeudeLaden, modellAus, parzelleRelativ, rechtLaden, rechtZeilen, umgebungZeilen, zonenKuerzel, type Koerper, type Recht } from '@/lib/check-modell';
import { Ladebild, type LadebildDaten } from '@/components/check/Ladebild';
import { FENSTER } from '@/lib/fenster';
import {
  aeltestes, ANTWORT_TEXT, linkFuer, ortAusLink, bauzeit, befundAmOrt, heizungText, GEBAEUDEART, herkunft, leadAngaben, mailOk, nameOk, schweizerNummer, STATUS, vorschlaege,
  type Antwort, type Befund, type Ort, vorschlagTeile } from '@/lib/check-daten';

/**
 * Die Check-Seiten für Eigentümer: ParzellenChecker, HausChecker, Was
 * darf ich bauen? ... -- eine Seite, viele Domains (src/lib/check-marken.ts).
 *
 * Julian, 6. November: modern, Richtung Immobilien und Rechner, eine
 * Seite, der man vertraut; im Hintergrund Parzellenlinien wie im
 * Kataster. Frei sind Karte, Fläche, Zone und Gebäude. Den Rechner für
 * Ausnützung und Reserve gibt es gegen Vorname, Name, E-Mail und eine
 * echte Schweizer Nummer -- das ist der Lead.
 *
 * Offen ohne Anmeldung, darf nur EINE Anfrage einfügen (anfrage, art
 * potenzial, angaben.quelle = check). Alles Gezeigte kommt vom Bund.
 */


const n = (x: number | null | undefined) => (x == null ? '–' : Math.round(x).toLocaleString('de-CH'));
const kurzZone = (z: string | null) => (!z ? '–' : z.replace(/zonen?$/i, '').trim().replace(/^Wohn$/, 'Wohnen') || z);
const leise = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const ZAEHLER = 'check-anfragen';
const heuteSchon = (): number[] => {
  try { return (JSON.parse(localStorage.getItem(ZAEHLER) || '[]') as number[]).filter(t => Date.now() - t < 864e5); } catch { return []; }
};

const FRAGEN: [string, string][] = [
  ['Was kostet die Berechnung?', 'Nichts. Die Prüfung mit den amtlichen Daten, der Rechner und die ausführliche Analyse sind kostenlos und unverbindlich.'],
  ['Woher stammen die Daten?', 'Aus den amtlichen Registern: Parzellen aus der amtlichen Vermessung von Bund und Kantonen, Bauzonen aus den Bauzonen Schweiz des Bundesamts für Raumentwicklung, Gebäude aus dem Gebäude- und Wohnungsregister des Bundesamts für Statistik.'],
  ['Wie genau ist der Rechner?', 'Er rechnet mit der Ausnützung, die Sie einstellen, und mit Grundfläche und Geschossen der Gebäude laut Register. Das ergibt einen Richtwert. Welche Ausnützung in Ihrer Gemeinde gilt und was davon nutzbar ist, prüfen unsere Fachleute in der Analyse.'],
  ['Wer steckt dahinter?', `${BETREIBER}. Wir begleiten Eigentümer bei Verkauf und Entwicklung von Liegenschaften und kaufen auch selbst. Die vollständigen Angaben finden Sie im Impressum.`],
  ['Muss ich verkaufen?', 'Nein. Die Analyse verpflichtet Sie zu nichts. Viele Eigentümer möchten einfach wissen, was ihr Grundstück kann.'],
  ['Was passiert mit meinen Angaben?', 'Wir verwenden sie für Ihre Berechnung und Analyse und um Sie zu Ihrer Liegenschaft zu kontaktieren. An Dritte geben wir sie nicht weiter. Sie können Ihre Einwilligung jederzeit widerrufen.'],
];

type Feld = 'name' | 'email' | 'telefon';

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
  // 0 gesperrt, 1 Fragen, 2 Kontakt, 3 freigeschaltet
  const [schritt, setSchritt] = useState<0 | 1 | 2 | 3>(0);
  const [antwort, setAntwort] = useState<Antwort>({ eigentuemer: null, absicht: null, zeitraum: null });
  const [kontakt, setKontakt] = useState<Record<Feld | 'website', string>>({ name: '', email: '', telefon: '', website: '' });
  const [beruehrt, setBeruehrt] = useState<Set<Feld>>(new Set());
  // Fragen einzeln, eine nach der anderen: ein Tipp genügt (Julian: "kinderleicht").
  const [frage, setFrage] = useState(0);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [luftbild, setLuftbild] = useState(true);
  const [az, setAz] = useState(0.6);
  const [recht, setRecht] = useState<'impressum' | 'datenschutz' | null>(null);
  // Ladebild: Gebäude rundum und Rechtslage (ÖREB) laufen neben dem Befund her.
  const [gebaeude, setGebaeude] = useState<Koerper[] | 'fehlt' | null>(null);
  const [rechtslage, setRechtslage] = useState<Recht | 'fehlt' | null>(null);
  const [bildFertig, setBildFertig] = useState(true);
  const abfrage = useRef(0);
  const geoeffnet = useRef(0);
  const kartenBox = useRef<HTMLDivElement>(null);
  const karte = useRef<L.Map | null>(null);
  const grund = useRef<L.TileLayer | null>(null);
  const umriss = useRef<L.Polygon | null>(null);
  const ergebnisRef = useRef<HTMLElement>(null);
  const rechnerRef = useRef<HTMLDivElement>(null);
  const eingabeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = `${marke.name.join('')} – ${marke.titel}`;
    // Jede Marke hat ihre Schrift (check-marken.ts, Gestaltung).
    zaehlen(marke.id, domain, 'aufruf');
    return seiteEinrichten(marke);
  }, [marke, domain]);

  // Vorschläge, kurz verzögert; ältere Antworten verwerfen.
  useEffect(() => {
    if (ort && text === ort.label) return;
    const ab = new AbortController();
    const t = setTimeout(() => { vorschlaege(text, ab.signal).then(l => { setListe(l); setAktiv(-1); }).catch(() => {}); }, 220);
    return () => { clearTimeout(t); ab.abort(); };
  }, [text, ort]);

  // Karte, sobald es ein Ergebnis gibt.
  useEffect(() => {
    if (!ort || !bildFertig || !kartenBox.current || karte.current) return;
    const m = L.map(kartenBox.current, { zoomControl: false, maxZoom: 20 });
    L.control.zoom({ position: 'topright' }).addTo(m);
    m.attributionControl.setPrefix('');
    L.tileLayer.wms('https://wms.geo.admin.ch/', { layers: 'ch.kantone.cadastralwebmap-farbe', format: 'image/png', transparent: true,
      opacity: 0.6, minZoom: 16, maxZoom: 20, attribution: '© Amtliche Vermessung' }).addTo(m);
    karte.current = m;
    return () => { m.remove(); karte.current = null; grund.current = null; umriss.current = null; };
  }, [ort, bildFertig]);

  useEffect(() => {
    const m = karte.current;
    if (!m) return;
    const e = luftbild ? { id: 'ch.swisstopo.swissimage', max: 20 } : { id: 'ch.swisstopo.pixelkarte-grau', max: 19 };
    grund.current?.remove();
    grund.current = L.tileLayer(`https://wmts.geo.admin.ch/1.0.0/${e.id}/default/current/3857/{z}/{x}/{y}.jpeg`,
      { maxZoom: 20, maxNativeZoom: e.max, attribution: '© swisstopo' }).addTo(m);
    grund.current.bringToBack();
  }, [luftbild, ort, bildFertig]);

  useEffect(() => {
    const m = karte.current;
    if (!m || !ort) return;
    m.invalidateSize();
    const w = lv95NachWgs84(ort.e, ort.n);
    if (!befund) { m.setView([w.lat, w.lon], 18, { animate: false }); return; }
    umriss.current?.remove();
    if (befund.teile.length) {
      const ll = befund.teile.map(t => t.map(r => r.map(([e, nn]) => { const p = lv95NachWgs84(e, nn); return [p.lat, p.lon] as [number, number]; })));
      umriss.current = L.polygon(ll, { color: marke.farbe, weight: 3, fillColor: marke.farbe, fillOpacity: 0.15 }).addTo(m);
      m.fitBounds(umriss.current.getBounds(), { padding: [70, 70], maxZoom: 19, animate: false });
    }
  }, [befund, ort, marke, bildFertig]);

  // Fokus noch im Tippen setzen: Nur dann öffnet Safari auf dem iPhone die
  // Tastatur. Danach weich nach oben; preventScroll verhindert den Sprung.
  const zurSuche = () => {
    eingabeRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: leise() ? 'auto' : 'smooth' });
  };

  const waehlen = async (v: Ort) => {
    setOrt(v); setText(v.label); setListe([]); setBefund(null); setLaden('laeuft'); setFehler(null);
    // Die Adresse kommt in den Link: Teilen und Neu laden zeigen dieselbe Parzelle (Julian, 14. November).
    try { window.history.replaceState(null, '', `${window.location.pathname}?${linkFuer(v)}${window.location.hash}`); } catch { /* ohne Verlauf geht es auch */ }
    // Wer "Bewegung reduzieren" eingestellt hat, sieht kein Ladebild, nur das Ergebnis.
    const nr = ++abfrage.current;
    setGebaeude(null); setRechtslage(null); setBildFertig(leise());
    gebaeudeLaden(v.e, v.n).then(g => nr === abfrage.current && setGebaeude(g)).catch(() => nr === abfrage.current && setGebaeude('fehlt'));
    rechtLaden(v.e, v.n).then(rl => nr === abfrage.current && setRechtslage(rl)).catch(() => nr === abfrage.current && setRechtslage('fehlt'));
    if (schritt !== 3) setSchritt(0);
    setTimeout(() => ergebnisRef.current?.scrollIntoView({ behavior: leise() ? 'auto' : 'smooth', block: 'start' }), 60);
    zaehlen(marke.id, domain, 'suche');
    try {
      const b = await befundAmOrt(v);
      if (nr !== abfrage.current) return;
      setBefund(b); setLaden(''); zaehlen(marke.id, domain, 'ergebnis');
      if (!b.teile.length) setBildFertig(true);
    } catch { if (nr === abfrage.current) { setLaden('fehler'); setBildFertig(true); } }
  };

  // Im Druck ist der Kartenkasten anders breit; Leaflet muss neu messen, sonst bleibt rechts ein grauer Streifen.
  useEffect(() => {
    const neu = () => { const m = karte.current; if (!m) return; m.invalidateSize(); if (umriss.current) m.fitBounds(umriss.current.getBounds(), { padding: [30, 30], maxZoom: 19, animate: false }); };
    window.addEventListener('beforeprint', neu); window.addEventListener('afterprint', neu);
    return () => { window.removeEventListener('beforeprint', neu); window.removeEventListener('afterprint', neu); };
  }, []);

  // Geöffnet über einen geteilten Link: gleich auswerten.
  useEffect(() => {
    const v = ortAusLink(window.location.search);
    if (v) void waehlen(v);
  // Nur beim ersten Laden.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [geteilt, setGeteilt] = useState(false);
  const teilen = async () => {
    if (!ort) return;
    const url = `${window.location.origin}${window.location.pathname}?${linkFuer(ort)}`;
    zaehlen(marke.id, domain, 'teilen');
    try {
      if (navigator.share) { await navigator.share({ title: `${marke.name.join('')}: ${ort.label}`, url }); return; }
      await navigator.clipboard.writeText(url); setGeteilt(true); window.setTimeout(() => setGeteilt(false), 2500);
    } catch { /* abgebrochen */ }
  };
  // Der Bericht ist die Seite selbst, für den Druck aufgeräumt (check.css, @media print).
  const bericht = () => { zaehlen(marke.id, domain, 'bericht'); window.print(); };

  const oeffnen = () => {
    if (!befund) { zurSuche(); return; }
    if (schritt === 0) { setSchritt(1); setFrage(0); geoeffnet.current = Date.now(); zaehlen(marke.id, domain, 'rechner'); }
    setTimeout(() => rechnerRef.current?.scrollIntoView({ behavior: leise() ? 'auto' : 'smooth', block: 'start' }), 30);
  };

  const meldung: Record<Feld, string> = {
    name: nameOk(kontakt.name) ? '' : 'Bitte Ihren Namen.',
    email: mailOk(kontakt.email) ? '' : 'Bitte eine gültige E-Mail-Adresse.',
    telefon: schweizerNummer(kontakt.telefon) ? '' : 'Bitte eine Schweizer Nummer, z. B. 079 412 58 36.',
  };
  const bereit = Object.values(meldung).every(t => !t);
  const feld = (k: Feld, titel: string, typ: string, auto: string, extra?: { inputMode?: 'email' | 'tel'; placeholder?: string }) => {
    const zeigen = beruehrt.has(k) ? meldung[k] : '';
    return (
      <label className="feld">
        <span>{titel}</span>
        <input type={typ} autoComplete={auto} value={kontakt[k]} aria-invalid={!!zeigen} {...extra}
               onChange={e => setKontakt(x => ({ ...x, [k]: e.target.value }))}
               onBlur={() => {
                 if (kontakt[k].trim()) setBeruehrt(b => new Set(b).add(k));
                 // Die Nummer beim Verlassen einheitlich schreiben: +41 79 412 58 36
                 if (k === 'telefon') { const t = schweizerNummer(kontakt.telefon); if (t) setKontakt(x => ({ ...x, telefon: t })); }
               }} />
        <em className="hinweis-feld">{zeigen}</em>
      </label>
    );
  };

  const senden = async (e: React.FormEvent) => {
    e.preventDefault();
    setBeruehrt(new Set<Feld>(['name', 'email', 'telefon']));
    if (!bereit || !befund || sendet) return;
    // Spamschutz: verstecktes Feld, nicht schneller als ein Mensch, höchstens drei Anfragen je Tag und Gerät.
    if (kontakt.website) return;
    // Zu schnell für einen Menschen: nicht still verwerfen, denn mit Autofill
    // trifft das selten auch echte Besucher; die senden dann einfach nochmals.
    if (Date.now() - geoeffnet.current < 4000) { setFehler('Bitte prüfen Sie Ihre Angaben kurz und senden Sie dann nochmals.'); return; }
    if (heuteSchon().length >= 3) { setFehler('Von diesem Gerät sind heute schon mehrere Anfragen eingegangen. Wir melden uns bei Ihnen.'); return; }
    setSendet(true); setFehler(null);
    const angaben = leadAngaben({ marke: marke.id, domain, antwort, befund, herkunft: window.location.search ? herkunft(window.location.search) : {} });
    if (document.referrer) angaben.referrer = document.referrer.slice(0, 200);
    if (ort) angaben.lv95 = [Math.round(ort.e), Math.round(ort.n)];
    // Ohne Rückgabe der Zeile: der öffentliche Schlüssel darf einfügen, nicht lesen.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('anfrage').insert({
      art: 'potenzial', name: kontakt.name.trim().replace(/\s+/g, ' ').slice(0, 120),
      email: kontakt.email.trim(), telefon: schweizerNummer(kontakt.telefon),
      adresse: befund.adresse.slice(0, 200), egrid: befund.egrid, angaben, einwilligung: true,
    });
    setSendet(false);
    if (error) { setFehler('Das hat nicht geklappt. Bitte versuchen Sie es noch einmal.'); return; }
    try { localStorage.setItem(ZAEHLER, JSON.stringify([...heuteSchon(), Date.now()])); } catch { /* privates Fenster */ }
    setSchritt(3);
    zaehlen(marke.id, domain, 'lead');
    setTimeout(() => rechnerRef.current?.scrollIntoView({ behavior: leise() ? 'auto' : 'smooth', block: 'start' }), 30);
  };

  // Ein Tipp wählt und führt weiter; die kurze Pause zeigt, was gewählt ist.
  const wahl = <K extends keyof Antwort>(k: K, werte: Record<string, string>) => (
    <div className="wahl">
      {Object.entries(werte).map(([w, t]) => (
        <button key={w} type="button" aria-pressed={antwort[k] === w} onClick={() => {
          setAntwort(a => ({ ...a, [k]: w as Antwort[K] }));
          setTimeout(() => {
            if (frage < 2) setFrage(frage + 1);
            else { setSchritt(2); zaehlen(marke.id, domain, 'kontakt'); }
          }, leise() ? 0 : 220);
        }}>{t}</button>
      ))}
    </div>
  );

  const best = befund?.haeuser.filter(h => h.status === 1004 || h.status === 1003) ?? [];
  const grundfl = best.reduce((s, h) => s + (h.grundflaeche ?? 0), 0);
  const anteil = befund?.flaeche && grundfl ? Math.min(100, Math.round((grundfl / befund.flaeche) * 100)) : null;
  const heuteFl = best.reduce((s, h) => s + (h.grundflaeche ?? 0) * (h.geschosse ?? 1), 0);
  const aeltestesGebaeude = aeltestes(best);
  const ladebild = useMemo<LadebildDaten | null>(() => {
    if (!ort) return null;
    const parzelle = befund?.teile.length ? parzelleRelativ(befund, ort.e, ort.n) : null;
    const m = befund && parzelle && Array.isArray(gebaeude) ? modellAus(gebaeude, parzelle, befund) : null;
    const auszug = rechtslage && rechtslage !== 'fehlt' ? rechtslage.auszug : null;
    const haus = befund?.haeuser.find(h => h.status === 1004);
    return {
      parzelle,
      eigene: gebaeude === 'fehlt' ? 'fehlt' : m ? m.eigene : null,
      nachbarn: m?.nachbarn ?? [],
      geschosse: m?.geschosse ?? 1,
      baulinien: rechtslage === 'fehlt' ? 'fehlt' : rechtslage ? (auszug?.baulinien?.linien ?? []).map(l => l.map(([x, y]) => [x - ort.e, y - ort.n])) : null,
      schilder: {
        parzelle: befund ? `Parzelle ${befund.nummer ?? ''} · ${n(befund.flaeche)} m²`.replace('Parzelle  ·', 'Grundstück ·') : null,
        zone: auszug?.zone?.text ?? befund?.zone ?? null,
        zoneKurz: zonenKuerzel(auszug?.zone?.text),
        haus: haus ? [haus.geschosse ? `${haus.geschosse} Geschoss${haus.geschosse > 1 ? 'e' : ''}` : null, bauzeit(haus) ? (haus.baujahr ? `Baujahr ${haus.baujahr}` : `Bauperiode ${bauzeit(haus)}`) : null].filter(Boolean).join(' · ') || null : null,
      },
    };
  }, [ort, befund, gebaeude, rechtslage]);
  const zeilen = befund ? rechtZeilen(rechtslage && rechtslage !== 'fehlt' ? rechtslage : null, befund) : [];
  const pdf = rechtslage && rechtslage !== 'fehlt' ? rechtslage.pdf : null;
  const lage = umgebungZeilen(rechtslage && rechtslage !== 'fehlt' ? rechtslage.umgebung : null);
  const zoneAuszug = rechtslage && rechtslage !== 'fehlt' ? rechtslage.auszug?.zone?.text ?? null : null;
  const moeglich = (befund?.flaeche ?? 0) * az;
  // Aufrufleiste auf dem Handy: nur, wenn gerade kein anderer Aufruf im Bild ist.
  const andererAufruf = useImBild('.pc .suche, .pc .aufruf, .pc .rechner, .pc .formular.offen, .pc .danke.sichtbar, .pc .schritte-aufruf', [befund, schritt, recht]);
  const leiste = recht || schritt !== 0 || andererAufruf ? null
    : befund ? { text: 'Reserve kostenlos berechnen', tun: oeffnen }
    : { text: 'Grundstück kostenlos prüfen', tun: zurSuche };

  const wortmarke = <><span className="zeichen" aria-hidden="true"><i /></span><span>{marke.name[0]}<b>{marke.name[1]}</b></span></>;

  return (
    <div className="pc" style={markenStil(marke)} {...markenAttribute(marke)}>
      <header className="kopf">
        <div className="huelle">
          <a className="wortmarke" href="#top" onClick={() => setRecht(null)}>{wortmarke}</a>
          <nav aria-label="Seite"><a href="#ablauf" onClick={() => setRecht(null)}>So funktioniert's</a><a href="#fragen" onClick={() => setRecht(null)}>Häufige Fragen</a></nav>
          <div className="rechts"><button type="button" className="knopf marke nur-gross" onClick={() => { setRecht(null); if (befund) oeffnen(); else zurSuche(); }}>Kostenlos prüfen</button></div>
        </div>
      </header>

      {recht ? (
        <main className="huelle rechtliches">
          <h2>{recht === 'impressum' ? 'Impressum' : 'Datenschutz'}</h2>
          {recht === 'impressum'
            ? <p>{marke.name.join('')} ist ein Angebot von {BETREIBER}. Firmenname, Postadresse, E-Mail und UID werden hier ergänzt.</p>
            : <p>Wir speichern die Angaben, die Sie im Formular machen (Vorname, Name, E-Mail, Telefon, Adresse der Liegenschaft und Ihre Antworten), um Ihnen die Berechnung und Analyse zu erstellen und Sie zu Ihrer Liegenschaft zu kontaktieren. An Dritte geben wir sie nicht weiter. Die angezeigten Grundstücksdaten stammen von geo.admin.ch. Für unsere Werbung auf Facebook und Instagram nutzen wir das Meta-Pixel von Meta Platforms Ireland: Es meldet Meta, dass jemand die Seite besucht, eine Adresse gesucht oder eine Anfrage gesendet hat, ohne Ihre Angaben aus dem Formular. Meta kann dies mit einem Konto bei Facebook oder Instagram verbinden. Die vollständige Datenschutzerklärung mit Verantwortlichem, Auftragsbearbeitern und Ländern wird mit den Angaben zum Betreiber ergänzt.</p>}
          <button type="button" className="knopf" onClick={() => setRecht(null)}>Zurück</button>
        </main>
      ) : (
      <main id="top">
        <section className="buehne">
          {buehnenBild(marke) && <div className="foto" aria-hidden="true" />}
          <svg className="kataster" viewBox={`0 0 ${KATASTER.breite} ${KATASTER.hoehe}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <path className="linien" d={KATASTER.linien} /><path className="hervor" d={KATASTER.hervor} />
          </svg>
          <div className="huelle">
            <div>
              <span className="etikett">{marke.etikett}</span>
              <h1>{marke.titel}</h1>
              <p className="satz">{marke.satz}</p>
              <form className="suche" role="search" autoComplete="off"
                    onSubmit={e => { e.preventDefault(); const v = liste[aktiv >= 0 ? aktiv : 0]; if (v) void waehlen(v); else eingabeRef.current?.focus(); }}>
                <div className="feldzeile">
                  <input ref={eingabeRef} id="pc-eingabe" value={text} placeholder="Strasse Nr., PLZ Ort" aria-label="Adresse Ihrer Liegenschaft"
                         onChange={e => { setText(e.target.value); setOrt(null); }}
                         onKeyDown={e => {
                           if (!liste.length) return;
                           if (e.key === 'ArrowDown') { setAktiv(a => (a + 1) % liste.length); e.preventDefault(); }
                           if (e.key === 'ArrowUp') { setAktiv(a => (a - 1 + liste.length) % liste.length); e.preventDefault(); }
                           if (e.key === 'Escape') setListe([]);
                         }} />
                  <button className="knopf marke" type="submit"><span className="lang">Jetzt prüfen</span><span className="kurz">Prüfen</span></button>
                </div>
                {liste.length > 0 && (
                  <ul className="vorschlaege" role="listbox">
                    {liste.map((v, i) => (
                      <li key={`${v.label}-${i}`}><button type="button" role="option" aria-selected={i === aktiv} onClick={() => void waehlen(v)}>
                        {(() => { const [haupt, ort] = vorschlagTeile(v.label); return <><b>{haupt}</b>{ort && <span>, {ort}</span>}</>; })()}
                      </button></li>
                    ))}
                  </ul>
                )}
                {/* Ohne Hausnummer findet sich keine Parzelle; statt einer leeren
                    Liste sagt die Seite, was fehlt. */}
                {!liste.length && !ort && text.trim().length >= 4 && !/\d/.test(text) && (
                  <p className="vorschlaege hinweis-nummer" role="status">Bitte mit Hausnummer, zum Beispiel «{text.trim().split(/\s+/)[0]} 12»</p>
                )}
              </form>
              <ul className="haken"><li>Kostenlos und unverbindlich</li><li>Amtliche Daten von Bund und Kantonen</li><li>Keine Weitergabe an Dritte</li></ul>
            </div>
            <aside className="beispiel" aria-label="Beispiel einer Auswertung">
              <div className="oben"><span>Beispiel einer Auswertung</span></div>
              <div className="gitter">
                <div><small>Grundstück</small><b>1'240 m²</b></div>
                <div><small>Bauzone</small><b>Wohnen</b></div>
                <div><small>Gebäude</small><b>1 · 1968</b></div>
                <div><small>Überbaut</small><b>16 %</b></div>
              </div>
              <div className="reserve">
                <small>Rechnerische Reserve bei Ausnützung 0.6</small>
                <b>+ 410 m²</b>
                <div className="zweibalken"><div><i style={{ width: '45%' }} /></div><div><i style={{ width: '100%' }} /></div>
                  <p>Heute rund 334 m² Geschossfläche, möglich 744 m²</p></div>
              </div>
            </aside>
          </div>
        </section>

        <div className="quellenband"><div className="huelle"><b>Daten aus:</b><span>Amtliche Vermessung</span><span>Bauzonen Schweiz (ARE)</span><span>Gebäude- und Wohnungsregister (BFS)</span><span>Luftbilder swisstopo</span></div></div>

        {ort && (
          <section className="ergebnis sichtbar" ref={ergebnisRef} aria-live="polite">
            <div className="huelle">
              <div className="ergebnis-kopf">
                <div>
                  {befund
                    ? <div className="ort">{befund.kanton && <span className="kanton">{befund.kanton}</span>}<span>{befund.gemeinde}{befund.nummer ? ` · Parzelle ${befund.nummer}` : ''}</span>{befund.egrid && <span className="egrid">{befund.egrid}</span>}</div>
                    : <div className="ueber">Ihre Parzelle</div>}
                  <h2>{befund?.adresse ?? ort.label}</h2>
                </div>
                {befund && bildFertig && (
                  <div className="ergebnis-aktionen">
                    <button type="button" className="knopf leise" onClick={() => void teilen()}>{geteilt ? 'Link kopiert' : 'Teilen'}</button>
                    <button type="button" className="knopf leise" onClick={bericht}>Bericht als PDF</button>
                  </div>
                )}
              </div>
              <div className="druck-kopf" aria-hidden="true">{marke.name.join('')} · Bericht vom {new Date().toLocaleDateString('de-CH')} · {domain}</div>
              {!bildFertig && ladebild && laden !== 'fehler' ? (
                <Ladebild key={`${ort.e}-${ort.n}`} daten={ladebild} farbe={marke.farbe} onFertig={() => setBildFertig(true)} />
              ) : (
              <div className="raster">
                <div className="karte-tafel">
                  <div id="karte" ref={kartenBox} aria-label="Karte mit der Parzelle" />
                  <div className="karte-schalter" role="group" aria-label="Grundkarte">
                    <button type="button" aria-pressed={luftbild} onClick={() => setLuftbild(true)}>Luftbild</button>
                    <button type="button" aria-pressed={!luftbild} onClick={() => setLuftbild(false)}>Plan</button>
                  </div>
                </div>

                <div className="seitenteil">
                  <div className="tafel">
                    {laden === 'laeuft' && <div className="laedt">Amtliche Daten werden abgefragt …</div>}
                    {laden === 'fehler' && <div className="laedt">Die amtlichen Dienste antworten gerade nicht. Bitte in einer Minute nochmals versuchen.</div>}
                    {befund && (
                      <>
                        <div className="kacheln">
                          <div><small>Grundstücksfläche</small><b>{n(befund.flaeche)} <span>m²</span></b><em>amtlicher Umriss</em></div>
                          <div><small>Bauzone</small><b>{zonenKuerzel(zoneAuszug) ?? kurzZone(befund.zone)}</b><em>{zoneAuszug ?? befund.zone ?? 'keine Bauzone erfasst'}</em></div>
                          <div><small>Überbaut</small><b>{anteil != null ? <>{anteil} <span>%</span></> : '–'}</b><em>{grundfl ? `${n(grundfl)} m² Gebäudegrundfläche` : 'kein Gebäude erfasst'}</em></div>
                          <div><small>Ältestes Gebäude</small><b>{aeltestesGebaeude ?? '–'}</b><em>{best.length} Gebäude laut Register</em></div>
                        </div>
                        <div className="block">
                          <h3>Gebäude auf der Parzelle</h3>
                          {befund.haeuser.length ? (
                            <ul className="haeuser">
                              {befund.haeuser.slice(0, 6).map(h => (
                                <li key={h.egid}>
                                  <div className="titel">{h.adresse ?? 'Gebäude'} <span className={`chip${h.status === 1001 || h.status === 1002 ? ' projekt' : ''}`}>{h.status ? STATUS[h.status] : ''}</span></div>
                                  <div className="klein">{h.klasse ? GEBAEUDEART[h.klasse] : ''}</div>
                                  <dl>
                                    <div><dt>{h.baujahr || !h.periode ? 'Baujahr' : 'Bauperiode'}</dt><dd>{bauzeit(h) ?? '–'}</dd></div>
                                    <div><dt>Geschosse</dt><dd>{h.geschosse ?? '–'}</dd></div>
                                    <div><dt>Wohnungen</dt><dd>{h.wohnungen ?? '–'}</dd></div>
                                    <div><dt>Heizung</dt><dd>{heizungText(h) ?? '–'}</dd></div>
                                  </dl>
                                </li>
                              ))}
                            </ul>
                          ) : <div className="klein">Auf dieser Parzelle ist kein Gebäude im Register eingetragen.</div>}
                        </div>
                        <div className="block">
                          <h3>Was auf der Parzelle gilt</h3>
                          {rechtslage === null && <div className="klein">Rechtslage wird beim Kanton abgefragt …</div>}
                          {zeilen.length > 0 && (
                            <dl className="recht">
                              {zeilen.map(z => (
                                <div key={z.titel}>
                                  <dt>{z.titel}</dt>
                                  <dd>{z.art && <span className={`punkt ${z.art}`} aria-hidden="true" />}{z.link ? <a href={z.link} target={FENSTER.extern}>{z.wert}</a> : z.wert}{z.zusatz && <small>{z.zusatz}</small>}</dd>
                                  <span className="q">{z.quelle}</span>
                                </div>
                              ))}
                            </dl>
                          )}
                          {pdf && <a className="pdf" href={pdf} target={FENSTER.extern}>Amtlicher ÖREB-Auszug (PDF)</a>}
                        </div>
                        {lage.length > 0 && (
                          <div className="block">
                            <h3>Energie und Lage</h3>
                            <dl className="recht">
                              {lage.map(z => (
                                <div key={z.titel}>
                                  <dt>{z.titel}</dt>
                                  <dd>{z.art && <span className={`punkt ${z.art}`} aria-hidden="true" />}{z.link ? <a href={z.link} target={FENSTER.extern}>{z.wert}</a> : z.wert}{z.zusatz && <small>{z.zusatz}</small>}</dd>
                                  <span className="q">{z.quelle}</span>
                                </div>
                              ))}
                            </dl>
                          </div>
                        )}
                        <div className="block klein">Quellen: Amtliche Vermessung, Bauzonen Schweiz (ARE), Gebäude- und Wohnungsregister (BFS), ÖREB-Kataster des Kantons, Kulturgüterinventar, Solarkataster und Wärmenetze (BFE), ÖV-Güteklassen (ARE), Radonkarte (BAG), abgefragt am {new Date().toLocaleDateString('de-CH')}. Vorprüfung, keine Bewilligungszusage.</div>
                      </>
                    )}
                  </div>

                  {befund?.flaeche != null && (
                    <div ref={rechnerRef} className={`tafel ${schritt === 1 || schritt === 2 ? 'formular offen' : schritt === 3 ? 'rechner' : 'rechner schloss'}`}>
                      {schritt === 0 && (
                        <>
                          <div className="zeile-oben"><h3>Ausnützung &amp; Reserve berechnen</h3><span className="wert">kostenlos</span></div>
                          <div className="ergebnisse">
                            <div><small>Möglich</small><b>•••</b></div>
                            <div><small>Heute ca.</small><b>{n(heuteFl)} m²</b></div>
                            <div className="plus"><small>Reserve</small><b>•••</b></div>
                          </div>
                          <ul>{marke.vorteile.slice(0, 3).map(v => <li key={v}>{v}</li>)}</ul>
                          <button type="button" className="knopf marke" onClick={oeffnen}>Berechnung freischalten</button>
                        </>
                      )}

                      {(schritt === 1 || schritt === 2) && (
                        <form onSubmit={senden} noValidate>
                          <div className="fortschritt" aria-hidden="true">{[0, 1, 2, 3].map(i => <i key={i} className={(schritt === 2 ? 3 : frage) >= i ? 'an' : ''} />)}</div>
                          {schritt === 1 ? (
                            <>
                              <div className="frage-nr">Frage {frage + 1} von 3</div>
                              {frage === 0 && <><div className="frage">Sind Sie Eigentümer/in dieser Liegenschaft?</div>{wahl('eigentuemer', ANTWORT_TEXT.eigentuemer)}</>}
                              {frage === 1 && <><div className="frage">Was beschäftigt Sie?</div>{wahl('absicht', ANTWORT_TEXT.absicht)}</>}
                              {frage === 2 && <><div className="frage">Bis wann?</div>{wahl('zeitraum', ANTWORT_TEXT.zeitraum)}</>}
                              <button type="button" className="zurueck" onClick={() => (frage > 0 ? setFrage(frage - 1) : setSchritt(0))}>Zurück</button>
                            </>
                          ) : (
                            <>
                              <div className="frage">Fast geschafft: Wohin dürfen wir die Berechnung schicken?</div>
                              <p className="klein" style={{ margin: 0 }}>Die Berechnung erscheint sofort hier. Die ausführliche Analyse senden wir Ihnen persönlich.</p>
                              {feld('name', 'Vor- und Nachname', 'text', 'name')}
                              {feld('telefon', 'Telefon', 'tel', 'tel', { inputMode: 'tel', placeholder: '079 412 58 36' })}
                              {feld('email', 'E-Mail', 'email', 'email', { inputMode: 'email' })}
                              <input className="falle" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
                                     value={kontakt.website} onChange={e => setKontakt(k => ({ ...k, website: e.target.value }))} />
                              {fehler && <p className="fehler">{fehler}</p>}
                              <button type="submit" className="knopf marke senden" disabled={sendet}>{sendet ? 'Wird gesendet …' : 'Berechnung jetzt anzeigen'}</button>
                              <p className="einwilligung">Mit dem Absenden sind Sie einverstanden, dass {BETREIBER} Ihre Angaben speichert und Sie zu dieser Liegenschaft kontaktiert, auch zu einem möglichen Verkauf oder einer Entwicklung. Widerruf jederzeit möglich.</p>
                              <button type="button" className="zurueck" onClick={() => { setSchritt(1); setFrage(2); }}>Zurück</button>
                              <div className="sicher">Verschlüsselt übertragen · keine Weitergabe an Dritte</div>
                            </>
                          )}
                        </form>
                      )}

                      {schritt === 3 && (
                        <>
                          <div className="freigeschaltet"><span>Freigeschaltet. Danke, {kontakt.name.trim().split(/\s+/)[0]}: Ihre ausführliche Analyse folgt innert zwei Arbeitstagen.</span></div>
                          <div className="zeile-oben"><h3>Ausnützung durchrechnen</h3><span className="wert">AZ {az.toFixed(2)}</span></div>
                          <p className="klein" style={{ margin: '6px 0 0' }}>Stellen Sie die Ausnützungsziffer Ihrer Zone ein. Den gültigen Wert Ihrer Gemeinde prüfen wir in der Analyse.</p>
                          <input type="range" min={0.2} max={2} step={0.05} value={az} aria-label="Ausnützungsziffer" onChange={e => setAz(Number(e.target.value))} />
                          <div className="skala"><span>0.2</span><span>1.0</span><span>2.0</span></div>
                          <div className="ergebnisse">
                            <div><small>Möglich</small><b>{n(moeglich)} m²</b></div>
                            <div><small>Heute ca.</small><b>{n(heuteFl)} m²</b></div>
                            <div className="plus"><small>Reserve</small><b>{moeglich - heuteFl > 0 ? `+ ${n(moeglich - heuteFl)} m²` : 'keine'}</b></div>
                          </div>
                          <div className="fein">Geschossfläche, vereinfacht: Ausnützung mal Grundstücksfläche; heute Grundfläche mal Geschosse laut Register. Richtwert, keine Bewilligungszusage.</div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              )}

            </div>
          </section>
        )}

        <section className="abschnitt-gross" id="ablauf">
          <div className="huelle">
            <div className="ueber">So funktioniert's</div>
            <h2 className="titel">In drei Schritten zu Ihrer Analyse</h2>
            <p className="lead-satz">Kein Konto, kein Abo, keine Verpflichtung. Sie sehen zuerst, was die amtlichen Daten sagen, und entscheiden dann, ob Sie mehr wissen möchten.</p>
            <div className="schritte">
              <div className="schritt-karte"><div className="nr" aria-hidden="true">1</div><h3>Adresse eingeben</h3><p>Wir finden Ihre Parzelle in der amtlichen Vermessung, schweizweit.</p></div>
              <div className="schritt-karte"><div className="nr" aria-hidden="true">2</div><h3>Daten sehen und rechnen</h3><p>Fläche, Bauzone, Gebäude und Baujahr, dazu ein Rechner für die Ausnützung.</p></div>
              <div className="schritt-karte"><div className="nr" aria-hidden="true">3</div><h3>Analyse erhalten</h3><p>Fachleute prüfen die Bau- und Zonenordnung Ihrer Gemeinde und melden sich innert zwei Arbeitstagen.</p></div>
            </div>
            <div className="schritte-aufruf">
              <button type="button" className="knopf marke" onClick={() => (befund ? oeffnen() : zurSuche())}>{befund ? 'Reserve kostenlos berechnen' : 'Mit Schritt 1 beginnen'}</button>
              <span>Kostenlos, ohne Konto, in einer Minute.</span>
            </div>
          </div>
        </section>

        <section className="abschnitt-gross fragen" id="fragen">
          <div className="huelle">
            <div className="ueber">Häufige Fragen</div>
            <h2 className="titel">Was Eigentümer uns fragen</h2>
            <div className="fragen-liste">
              {FRAGEN.map(([f, a]) => <details key={f}><summary>{f}</summary><p>{a}</p></details>)}
            </div>
          </div>
        </section>

        <section className="aufruf"><div className="huelle"><h2>{marke.aufruf}</h2>
          <button type="button" className="knopf" onClick={() => (befund ? oeffnen() : zurSuche())}>Jetzt kostenlos prüfen</button></div></section>
      </main>
      )}

      <footer>
        <div className="huelle">
          <div><span className="wortmarke">{wortmarke}</span><p>{marke.name.join('')} ist ein Angebot von {BETREIBER}. Amtliche Daten, persönlich geprüft.</p></div>
          <div><h4>Rechtliches</h4><ul>
            <li><button type="button" onClick={() => { setRecht('impressum'); window.scrollTo({ top: 0 }); }}>Impressum</button></li>
            <li><button type="button" onClick={() => { setRecht('datenschutz'); window.scrollTo({ top: 0 }); }}>Datenschutz</button></li>
          </ul></div>
                    <div className="unten">Vorprüfung auf Grundlage amtlicher Daten, keine Bewilligungszusage und keine Verkehrswertschätzung.</div>
        </div>
      </footer>

      {leiste && (
        <div className={`mobil-aufruf${bildFertig ? ' sichtbar' : ''}`}><button type="button" className="knopf marke" onClick={leiste.tun}>{leiste.text}</button></div>
      )}
    </div>
  );
}
