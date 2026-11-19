import { useEffect, useMemo, useRef, useState } from 'react';
import { CookieHinweis } from '@/components/CookieHinweis';
import { setzeZustimmung } from '@/lib/zustimmung';
import { sitzungsHerkunft } from '@/lib/werbe-herkunft';
import { DATENQUELLEN, FRAGEN, SCHRITTE } from '@/lib/check-inhalt';
import { preisZeilen, type Preise } from '@/lib/preise';
import { umkreisLaden, umkreisSatz, umkreisZeilen, type Umkreis } from '@/lib/umkreis';
import { useParams } from 'react-router-dom';
import type L from 'leaflet';
import './check.css';
import { datenbank } from '@/lib/datenbank';
import { lv95NachWgs84 } from '@/lib/koordinaten';
import { BETREIBER, BETREIBER_ADRESSE, BETREIBER_EMAIL, BETREIBER_UID, markeFuerHost, markeNachId, STANDARD_MARKE, type Marke } from '@/lib/check-marken';
import { KATASTER } from '@/lib/check-hintergrund';
import { useImBild } from '@/lib/im-bild';
import { zaehlen } from '@/lib/check-zaehlen';
import { buehnenBild, markenAttribute, markenStil, seiteEinrichten } from '@/lib/check-gestaltung';
import { ARTIKEL } from '@/lib/ratgeber';
import { kennzahlen as gemeindeKennzahlen, mitAdressen, QUELLE as GEMEINDE_QUELLE, satz as gemeindeSatz, titel as gemeindeTitel, type Gemeinde, type GemeindeZahlen, GEMEINDE_DOMAIN } from '@/lib/gemeinde-seiten';
import { ABSICHT_HEIZUNG, FOERDERUNG, HEIZUNG_TEXT, heizungZeilen } from '@/lib/heizung';
import { gebaeudeLaden, modellAus, parzelleRelativ, rechtLaden, rechtZeilen, umgebungZeilen, zifferLaden, type Ziffern, zonenKuerzel, type Koerper, type Recht } from '@/lib/check-modell';
import { Ladebild, type LadebildDaten } from '@/components/check/Ladebild';
import { FENSTER } from '@/lib/fenster';
import {
  aeltestes, ANTWORT_TEXT, stockText, type Einheit, linkFuer, ortAusLink, bauzeit, befundAmOrt, heizungText, GEBAEUDEART, leadAngaben, mailOk, nameOk, schweizerNummer, STATUS, vorschlaege,
  type Antwort, type Befund, type Ort, vorschlagTeile, wohnadresseOk, fragtKaufangebot } from '@/lib/check-daten';
import { BISHER_SATZ, bisherFuer, fundstelle, fundstelleZeilen, gesetzFuer, NUR_BISHER_SATZ, schnittDaten, type Begriff } from '@/lib/check-fundstelle';
import { ANGEBOT, BEISPIEL, BEISPIEL_HINWEIS, beispielBericht, beispielFundstelle, beispielSchnitt } from '@/lib/check-beispiel';
import { Schnitt } from '@/components/check/Schnitt';
import { FundstelleTafel, GesetzText } from '@/components/check/FundstelleTafel';
import { berichtSpeichern, luftbildMitUmriss, type BerichtAbschnitt } from '@/lib/check-bericht';
import { tippsFuer, TIPP_TITEL } from '@/lib/check-tipps';
import { fotoDatei, fotoNachId } from '@/lib/check-fotos';

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


type Feld = 'name' | 'adresse' | 'telefon' | 'email';

/**
 * Die Angaben einzeln, eine je Bild, und immer in dasselbe Feld: so bleibt
 * auf dem iPhone die Tastatur offen, und niemand muss suchen, wo es
 * weitergeht. Julian, 19. November: «Name und Adresse muss man eingeben
 * und die Nummer und vielleicht noch eine E-Mail-Adresse und erst dann am
 * Schluss bekommt man ein PDF.» Die E-Mail ist darum freiwillig; die
 * Datenbank verlangt E-Mail oder Telefon (anfrage, check), das Telefon
 * ist hier Pflicht.
 */
const KONTAKT: { k: Feld; frage: string; titel: string; typ: string; auto: string; modus?: 'email' | 'tel' | 'text'; platzhalter?: string; zusatz?: string }[] = [
  { k: 'name', frage: 'Wie heissen Sie?', titel: 'Vor- und Nachname', typ: 'text', auto: 'name', modus: 'text', platzhalter: 'Anna Muster' },
  { k: 'adresse', frage: 'Wo wohnen Sie?', titel: 'Strasse, Nummer, PLZ und Ort', typ: 'text', auto: 'street-address', modus: 'text', platzhalter: 'Seestrasse 12, 8810 Horgen' },
  { k: 'telefon', frage: 'Unter welcher Nummer erreichen wir Sie?', titel: 'Telefon', typ: 'tel', auto: 'tel', modus: 'tel', platzhalter: '079 412 58 36' },
  { k: 'email', frage: 'Ihre E-Mail-Adresse', titel: 'E-Mail (freiwillig)', typ: 'email', auto: 'email', modus: 'email', zusatz: 'Freiwillig. Damit können wir Ihnen die ausführliche Analyse auch schriftlich senden.' },
];

export default function Check({ marke: vorgabe, modus }: { marke?: Marke; modus?: 'heizung' | 'gemeinde' | 'gemeinden' }) {
  const { marke: markeId, ort: ortSlug } = useParams();
  // Gemeinde-Seiten: die Zahlen schreibt der Ablauf "Gemeinden" nach /gemeinden.json (gemeinde-seiten.ts).
  const [gemeinden, setGemeinden] = useState<Gemeinde[] | null>(null);
  useEffect(() => {
    if (modus !== 'gemeinde' && modus !== 'gemeinden') return;
    fetch('/gemeinden.json').then(r => (r.ok ? r.json() : [])).then((d: GemeindeZahlen[]) => setGemeinden(mitAdressen(d))).catch(() => setGemeinden([]));
  }, [modus]);
  const gemeinde = modus === 'gemeinde' ? gemeinden?.find(g => g.slug === ortSlug) ?? null : null;
  // Preise je Gemeinde (ZH, BL), erst geladen, wenn eine Parzelle gefunden ist.
  const [preise, setPreise] = useState<Preise | null>(null);
  // Auf einer Marken-Domain entscheidet der Hostname, sonst /check/:marke (Vorschau auf unserer Domain).
  // Der Heizungs-Check (/heizung) trägt dieselbe Marke mit eigenen Texten.
  const marke = useMemo(() => {
    const m = vorgabe ?? markeFuerHost(window.location.hostname) ?? markeNachId(markeId) ?? STANDARD_MARKE;
    if (modus === 'heizung') return { ...m, ...HEIZUNG_TEXT };
    if (gemeinde) return { ...m, etikett: `${gemeinde.ort} · Kanton ${gemeinde.kanton}`, titel: gemeindeTitel(gemeinde), satz: gemeindeSatz(gemeinde) };
    if (modus === 'gemeinden') return { ...m, etikett: 'Gemeinden', titel: 'Bauen in Ihrer Gemeinde', satz: 'Baugesuche und Gebäude je Gemeinde, aus den amtlichen Daten. Wählen Sie Ihre Gemeinde oder prüfen Sie direkt Ihre Adresse.' };
    return m;
  }, [vorgabe, markeId, modus, gemeinde]);
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
  const [kontakt, setKontakt] = useState<Record<Feld | 'website', string>>({ name: '', adresse: '', email: '', telefon: '', website: '' });
  const [beruehrt, setBeruehrt] = useState<Set<Feld>>(new Set());
  // Fragen einzeln, eine nach der anderen: ein Tipp genügt (Julian: "kinderleicht").
  const [frage, setFrage] = useState(0);
  // Welche der vier Angaben gerade gefragt ist (KONTAKT).
  const [kschritt, setKschritt] = useState(0);
  const kontaktFeld = useRef<HTMLInputElement>(null);
  const [pdfLaeuft, setPdfLaeuft] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [luftbild, setLuftbild] = useState(true);
  const [az, setAz] = useState(0.6);
  // Der Ratgeber verlinkt mit #datenschutz und #impressum direkt auf den Text.
  const [recht, setRecht] = useState<'impressum' | 'datenschutz' | null>(() => window.location.hash === '#datenschutz' ? 'datenschutz' : window.location.hash === '#impressum' ? 'impressum' : null);
  // Ladebild: Gebäude rundum und Rechtslage (ÖREB) laufen neben dem Befund her.
  const [gebaeude, setGebaeude] = useState<Koerper[] | 'fehlt' | null>(null);
  const [rechtslage, setRechtslage] = useState<Recht | 'fehlt' | null>(null);
  const [bildFertig, setBildFertig] = useState(true);
  const abfrage = useRef(0);
  const geoeffnet = useRef(0);
  const kartenBox = useRef<HTMLDivElement>(null);
  // Die Karte (Leaflet, rund 40 KB) erst laden, wenn es ein Ergebnis gibt (Tempo, 15. November).
  const [Lm, setLm] = useState<typeof L | null>(null);
  useEffect(() => {
    if (!ort || Lm) return;
    void Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([m]) => setLm(() => m.default));
  }, [ort, Lm]);
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
    if (!Lm || !ort || !bildFertig || !kartenBox.current || karte.current) return;
    const m = Lm.map(kartenBox.current, { zoomControl: false, maxZoom: 20 });
    Lm.control.zoom({ position: 'topright' }).addTo(m);
    m.attributionControl.setPrefix('');
    Lm.tileLayer.wms('https://wms.geo.admin.ch/', { layers: 'ch.kantone.cadastralwebmap-farbe', format: 'image/png', transparent: true,
      opacity: 0.6, minZoom: 16, maxZoom: 20, attribution: '© Amtliche Vermessung' }).addTo(m);
    karte.current = m;
    return () => { m.remove(); karte.current = null; grund.current = null; umriss.current = null; };
  }, [Lm, ort, bildFertig]);

  useEffect(() => {
    const m = karte.current;
    if (!m || !Lm) return;
    const e = luftbild ? { id: 'ch.swisstopo.swissimage', max: 20 } : { id: 'ch.swisstopo.pixelkarte-grau', max: 19 };
    grund.current?.remove();
    grund.current = Lm.tileLayer(`https://wmts.geo.admin.ch/1.0.0/${e.id}/default/current/3857/{z}/{x}/{y}.jpeg`,
      { maxZoom: 20, maxNativeZoom: e.max, attribution: '© swisstopo' }).addTo(m);
    grund.current.bringToBack();
  }, [Lm, luftbild, ort, bildFertig]);

  useEffect(() => {
    const m = karte.current;
    if (!m || !ort || !Lm) return;
    m.invalidateSize();
    const w = lv95NachWgs84(ort.e, ort.n);
    if (!befund) { m.setView([w.lat, w.lon], 18, { animate: false }); return; }
    umriss.current?.remove();
    if (befund.teile.length) {
      const ll = befund.teile.map(t => t.map(r => r.map(([e, nn]) => { const p = lv95NachWgs84(e, nn); return [p.lat, p.lon] as [number, number]; })));
      umriss.current = Lm.polygon(ll, { color: marke.farbe, weight: 3, fillColor: marke.farbe, fillOpacity: 0.15 }).addTo(m);
      m.fitBounds(umriss.current.getBounds(), { padding: [70, 70], maxZoom: 19, animate: false });
    }
  }, [Lm, befund, ort, marke, bildFertig]);

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
  // Stockwerkeigentum: die eigene Wohnung aus dem Register wählen (Julian, 14. November: "Stockwerkeigentum-Check ist top").
  const [wohnung, setWohnung] = useState<(Einheit & { id: string; egid: number }) | null>(null);
  const [alleWohnungen, setAlleWohnungen] = useState<number | null>(null);
  useEffect(() => { setWohnung(null); setAlleWohnungen(null); }, [ort]);
  const teilen = async () => {
    if (!ort) return;
    const url = `${window.location.origin}${window.location.pathname}?${linkFuer(ort)}`;
    zaehlen(marke.id, domain, 'teilen');
    try {
      if (navigator.share) { await navigator.share({ title: `${marke.name.join('')}: ${ort.label}`, url }); return; }
      await navigator.clipboard.writeText(url); setGeteilt(true); window.setTimeout(() => setGeteilt(false), 2500);
    } catch { /* abgebrochen */ }
  };
  const oeffnen = () => {
    if (!befund) { zurSuche(); return; }
    if (schritt === 0) { setSchritt(1); setFrage(0); geoeffnet.current = Date.now(); zaehlen(marke.id, domain, 'rechner'); }
    setTimeout(() => rechnerRef.current?.scrollIntoView({ behavior: leise() ? 'auto' : 'smooth', block: 'start' }), 30);
  };

  const meldung: Record<Feld, string> = {
    name: nameOk(kontakt.name) ? '' : 'Bitte Vor- und Nachnamen angeben.',
    adresse: wohnadresseOk(kontakt.adresse) ? '' : 'Bitte Strasse, Hausnummer und Ort angeben.',
    telefon: schweizerNummer(kontakt.telefon) ? '' : 'Bitte eine Schweizer Nummer, z. B. 079 412 58 36.',
    email: !kontakt.email.trim() || mailOk(kontakt.email) ? '' : 'Diese E-Mail-Adresse stimmt nicht. Korrigieren Sie sie oder lassen Sie das Feld leer.',
  };
  const bereit = Object.values(meldung).every(t => !t);
  const angabe = KONTAKT[kschritt];

  // Weiter zur nächsten Angabe. Der Fokus bleibt im selben Feld, noch im
  // Tippen gesetzt: nur so lässt Safari auf dem iPhone die Tastatur offen.
  const weiter = () => {
    const k = angabe.k;
    setBeruehrt(b => new Set(b).add(k));
    // Die Nummer einheitlich schreiben: +41 79 412 58 36
    if (k === 'telefon') { const t = schweizerNummer(kontakt.telefon); if (t) setKontakt(x => ({ ...x, telefon: t })); }
    kontaktFeld.current?.focus({ preventScroll: true });
    if (meldung[k]) return;
    setKschritt(s => Math.min(KONTAKT.length - 1, s + 1));
  };
  const absenden = (e: React.FormEvent) => {
    e.preventDefault();
    if (kschritt < KONTAKT.length - 1) weiter(); else void senden();
  };

  const senden = async () => {
    setBeruehrt(new Set<Feld>(['name', 'adresse', 'telefon', 'email']));
    if (!bereit) { const erste = KONTAKT.findIndex(f => meldung[f.k]); if (erste >= 0) setKschritt(erste); return; }
    if (!befund || sendet) return;
    // Spamschutz: verstecktes Feld, nicht schneller als ein Mensch, höchstens drei Anfragen je Tag und Gerät.
    if (kontakt.website) return;
    // Zu schnell für einen Menschen: nicht still verwerfen, denn mit Autofill
    // trifft das selten auch echte Besucher; die senden dann einfach nochmals.
    if (Date.now() - geoeffnet.current < 4000) { setFehler('Bitte prüfen Sie Ihre Angaben kurz und senden Sie dann nochmals.'); return; }
    if (heuteSchon().length >= 3) { setFehler('Von diesem Gerät sind heute schon mehrere Anfragen eingegangen. Wir melden uns bei Ihnen.'); return; }
    setSendet(true); setFehler(null);
    const angaben = leadAngaben({ marke: marke.id, domain, antwort, befund, herkunft: sitzungsHerkunft(), landpreis: gemeindePreise?.land?.m ?? null });
    if (modus === 'heizung') angaben.thema = 'heizung';
    // Gewählte Wohnung (Stockwerkeigentum) mitgeben, knapp: die Spalte erlaubt weniger als 8 kB.
    if (wohnung) angaben.wohnung = { egid: wohnung.egid, stock: stockText(wohnung.stock), zimmer: wohnung.zimmer, flaeche: wohnung.flaeche, nr: wohnung.nr };
    if (document.referrer) angaben.referrer = document.referrer.slice(0, 200);
    if (ort) angaben.lv95 = [Math.round(ort.e), Math.round(ort.n)];
    // Wo die Person wohnt; die Spalte adresse bleibt die Liegenschaft.
    angaben.wohnadresse = kontakt.adresse.trim().replace(/\s+/g, ' ').slice(0, 200);
    // Ohne Rückgabe der Zeile: der öffentliche Schlüssel darf einfügen, nicht lesen.
    const { error } = await (await datenbank()).from('anfrage').insert({
      art: 'potenzial', name: kontakt.name.trim().replace(/\s+/g, ' ').slice(0, 120),
      email: kontakt.email.trim() || null, telefon: schweizerNummer(kontakt.telefon),
      adresse: befund.adresse.slice(0, 200), egrid: befund.egrid, angaben, einwilligung: true,
    });
    setSendet(false);
    if (error) { setFehler('Das hat nicht geklappt. Bitte versuchen Sie es noch einmal.'); return; }
    try { localStorage.setItem(ZAEHLER, JSON.stringify([...heuteSchon(), Date.now()])); } catch { /* privates Fenster */ }
    setSchritt(3);
    zaehlen(marke.id, domain, 'lead');
  };

  // Ein Tipp wählt und führt weiter; die kurze Pause zeigt, was gewählt ist.
  const wahl = <K extends keyof Antwort>(k: K, werte: Record<string, string>) => (
    <div className="wahl">
      {Object.entries(werte).map(([w, t]) => (
        <button key={w} type="button" aria-pressed={antwort[k] === w} onClick={() => {
          // Eine geänderte Absicht macht die Antwort zum Kaufangebot hinfällig.
          setAntwort(a => ({ ...a, [k]: w as Antwort[K], ...(k === 'absicht' ? { kaufangebot: null } : {}) }));
          setTimeout(() => {
            if (frage < fragen - 1) setFrage(frage + 1);
            else { setSchritt(2); setKschritt(0); zaehlen(marke.id, domain, 'kontakt'); }
          }, leise() ? 0 : 220);
        }}>{t}</button>
      ))}
    </div>
  );

  // Wer verkaufen oder den Wert kennen will, wird nach dem Kaufangebot gefragt (Julian, 19. November: «mit Angebot»).
  const fragen = modus !== 'heizung' && fragtKaufangebot(antwort) ? 4 : 3;
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
  const pdf = rechtslage && rechtslage !== 'fehlt' ? rechtslage.pdf : null;
  // Im Heizungs-Check stehen Fernwärme und Solardach schon unter "Ihre Heizung"; nichts doppelt.
  const lage = umgebungZeilen(rechtslage && rechtslage !== 'fehlt' ? rechtslage.umgebung : null)
    .filter(z => modus !== 'heizung' || (z.titel !== 'Fernwärme' && z.titel !== 'Solardach'));
  const heizung = modus === 'heizung' ? heizungZeilen(befund, rechtslage && rechtslage !== 'fehlt' ? rechtslage.umgebung : null) : [];
  const zoneAuszug = rechtslage && rechtslage !== 'fehlt' ? rechtslage.auszug?.zone?.text ?? null : null;
  const moeglich = (befund?.flaeche ?? 0) * az;
  // Was der Zonenplan des Kantons führt (heute Zürich): mit AZ startet der Rechner beim echten Wert,
  // mit nur Baumassenziffer rechnet er in Volumen -- heute aus Umriss mal Höhe von swisstopo.
  const [zifferKanton, setZifferKanton] = useState<Ziffern | null>(null);
  // Ausserhalb Zürichs aus der Tabelle zone_ziffer (geodienste.ch), sobald der Kanton bekannt ist.
  useEffect(() => {
    setZifferKanton(null);
    if (!ort || !befund || befund.kanton === 'ZH') return;
    let aktiv = true;
    zifferLaden(ort.e, ort.n).then(z => { if (aktiv) setZifferKanton(z); }).catch(() => {});
    return () => { aktiv = false; };
  }, [ort, befund]);
  // Baugesuche im Umkreis von 300 m (nur Zählungen, baugesuche_umkreis).
  const [umkreis, setUmkreis] = useState<Umkreis | null>(null);
  useEffect(() => {
    setUmkreis(null);
    if (!ort || !befund?.kanton) return;
    let aktiv = true;
    umkreisLaden(ort.e, ort.n, befund.kanton).then(u => { if (aktiv) setUmkreis(u); }).catch(() => {});
    return () => { aktiv = false; };
  }, [ort, befund]);
  const nachbarSatz = umkreisSatz(umkreis);
  const nachbar = umkreisZeilen(umkreis);
  const ziffern = (rechtslage && rechtslage !== 'fehlt' ? rechtslage.ziffern ?? null : null) ?? zifferKanton;
  // Ohne Auszug nennt die Nutzungsplanung des Kantons die Zone genauer als der Bund (Zug: "Kernzone C").
  const zoneText = zoneAuszug ?? (ziffern?.zone ? `${ziffern.zone}${ziffern.kuerzel ? ` [${ziffern.kuerzel}]` : ''}` : null);
  useEffect(() => {
    if (!befund?.bfs || preise) return;
    fetch('/preise.json').then(r => (r.ok ? r.json() : null)).then(setPreise).catch(() => setPreise(null));
  }, [befund?.bfs, preise]);
  const gemeindePreise = befund?.bfs ? preise?.gemeinden[String(befund.bfs)] ?? null : null;
  const preis = preisZeilen(gemeindePreise, befund?.flaeche ?? null);
  const zeilen = befund ? rechtZeilen(rechtslage && rechtslage !== 'fehlt' ? rechtslage : null, befund, ziffern) : [];
  const azAusPlan = ziffern?.az ?? null;
  const bmzAusPlan = azAusPlan == null ? ziffern?.bmz ?? null : null;
  // Heutiges Volumen nur aus dem Register (GVOL). Umriss mal Höhe von swisstopo war zu grob: die Höhe
  // ist die Firsthöhe, der Umriss schliesst den Dachvorsprung ein (Fällanden: 1'748 statt rund 1'200 m³).
  const volumenHeute = best.length && best.every(h => h.volumen) ? best.reduce((s2, h) => s2 + (h.volumen ?? 0), 0) : null;
  useEffect(() => { if (azAusPlan != null) setAz(Math.min(2, Math.max(0.2, azAusPlan))); }, [azAusPlan]);
  const volumenMoeglich = bmzAusPlan != null && befund?.flaeche ? Math.round(bmzAusPlan * befund.flaeche) : null;
  // Jede Zahl der Rechnung mit Fundstelle: Vorgabe, Gesetz mit Zitat, Rechnung (check-fundstelle.ts).
  const ordnung = rechtslage && rechtslage !== 'fehlt' ? rechtslage.auszug?.ordnung ?? null : null;
  const rechnungMitFundstelle = befund?.flaeche ? fundstelle({ kanton: befund.kanton, ziffern, flaeche: befund.flaeche, az, haeuser: best, volumenHeute, ordnung }) : null;
  const schnitt = schnittDaten(ziffern, best.length ? Math.max(...best.map(h => h.geschosse ?? 0)) : 0);
  const begriffZone: Begriff | null = ziffern ? (ziffern.az != null ? 'az' : ziffern.bmz != null ? 'bmz' : ziffern.uez != null ? 'uez' : ziffern.vollgeschosse != null ? 'vollgeschoss' : null) : null;
  const gesetzZone = begriffZone ? gesetzFuer(befund?.kanton, begriffZone) : null;
  const bisherZone = begriffZone ? bisherFuer(befund?.kanton, begriffZone) : null;
  // Tipps eines Kantons erst, wenn die Parzelle gefunden ist.
  const tipps = tippsFuer(marke.schwerpunkt, modus === 'heizung', befund?.kanton);
  const ratgeberPfad = (slug: string) => (markeFuerHost(window.location.hostname) ? `/ratgeber/${slug}` : `/check/${marke.id}/ratgeber/${slug}`);
  const quellenText = `Amtliche Vermessung, Bauzonen Schweiz (ARE), Gebäude- und Wohnungsregister (BFS), ÖREB-Kataster des Kantons, Kulturgüterinventar, Solarkataster und Wärmenetze (BFE), ÖV-Güteklassen (ARE), Radonkarte (BAG)${nachbarSatz ? ', Baugesuche aus den Amtsblättern und vom Kanton Zürich' : ''}${gemeindePreise ? `, Immobilienpreise: ${preise?.quellen[gemeindePreise.k] ?? ''}` : ''}`;

  // Der Wegweiser: jeder Tipp führt weiter, und die Seite rollt selbst zum
  // nächsten Schritt, sobald er nicht mehr oben im Bild steht (Julian,
  // 19. November: «dass man da nicht selber scrollen muss»).
  useEffect(() => {
    if (schritt === 0) return;
    const el = rechnerRef.current;
    if (!el) return;
    const t = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      if (r.top < 72 || r.top > window.innerHeight * 0.4) el.scrollIntoView({ behavior: leise() ? 'auto' : 'smooth', block: 'start' });
    }, 40);
    return () => window.clearTimeout(t);
  }, [schritt, frage, kschritt]);

  // Der Bericht enthält, was die Seite gezeigt hat, und die Rechnung nach dem Freischalten.
  const pdfLaden = async () => {
    if (!befund || pdfLaeuft) return;
    setPdfLaeuft(true);
    zaehlen(marke.id, domain, 'bericht');
    try {
      const bild = befund.teile.length ? await luftbildMitUmriss(befund.teile, marke.farbe).catch(() => null) : null;
      const plus = (a: number, b: number) => (a - b > 0 ? `+ ${n(a - b)}` : 'keine');
      const rechnung: BerichtAbschnitt = volumenMoeglich != null
        ? { titel: 'Bauvolumen laut Zonenplan', satz: `Ihre Zone (${ziffern?.kuerzel ?? ziffern?.zone ?? ''}) begrenzt das Volumen über dem Boden mit der Baumassenziffer ${bmzAusPlan!.toLocaleString('de-CH')}.`,
            zeilen: [{ titel: 'Möglich', wert: `${n(volumenMoeglich)} m³` }, { titel: 'Heute', wert: volumenHeute != null ? `${n(volumenHeute)} m³` : 'in Analyse' },
              { titel: 'Baureserve', wert: volumenHeute != null ? (plus(volumenMoeglich, volumenHeute) === 'keine' ? 'keine' : `${plus(volumenMoeglich, volumenHeute)} m³`) : 'in Analyse' }] }
        : { titel: 'Ausnützung durchgerechnet', satz: azAusPlan != null ? `Der Zonenplan des Kantons nennt für Ihre Zone die Ausnützungsziffer ${azAusPlan.toLocaleString('de-CH')}. Gerechnet mit ${az.toFixed(2)}.` : `Gerechnet mit der Ausnützungsziffer ${az.toFixed(2)}. Den gültigen Wert Ihrer Gemeinde prüfen wir in der Analyse.`,
            zeilen: [{ titel: 'Möglich', wert: `${n(moeglich)} m²` }, { titel: 'Heute ca.', wert: `${n(heuteFl)} m²` },
              { titel: 'Baureserve', wert: plus(moeglich, heuteFl) === 'keine' ? 'keine' : `${plus(moeglich, heuteFl)} m²` }] };
      const haeuser = befund.haeuser.slice(0, 8).map(h => ({ titel: h.adresse ?? 'Gebäude',
        wert: [h.status ? STATUS[h.status] : null, h.klasse ? GEBAEUDEART[h.klasse] : null, bauzeit(h) ? `${h.baujahr || !h.periode ? 'Baujahr' : 'Bauperiode'} ${bauzeit(h)}` : null,
          h.geschosse ? `${h.geschosse} Geschosse` : null, h.wohnungen ? `${h.wohnungen} Wohnungen` : null, heizungText(h) ? `Heizung ${heizungText(h)}` : null].filter(Boolean).join(' · ') }));
      await berichtSpeichern({
        marke: marke.name.join(''), farbe: marke.farbe, domain, datum: new Date(),
        adresse: befund.adresse, ort: [befund.gemeinde, befund.nummer ? `Parzelle ${befund.nummer}` : null, befund.kanton ? `Kanton ${befund.kanton}` : null].filter(Boolean).join(' · '),
        egrid: befund.egrid, bild,
        kennzahlen: [
          { titel: 'Grundstücksfläche', wert: `${n(befund.flaeche)} m²`, zusatz: 'amtliche Vermessung' },
          { titel: 'Bauzone', wert: zonenKuerzel(zoneText) ?? kurzZone(befund.zone), zusatz: zoneText ?? befund.zone ?? 'keine Bauzone erfasst' },
          { titel: 'Überbaut', wert: anteil != null ? `${anteil} %` : '–', zusatz: grundfl ? `${n(grundfl)} m² Grundfläche` : 'kein Gebäude erfasst' },
          { titel: 'Ältestes Gebäude', wert: aeltestesGebaeude ?? '–', zusatz: `${best.length} Gebäude laut Register` },
        ],
        rechnung: rechnungMitFundstelle ? { titel: rechnung.titel, satz: rechnung.satz, zeilen: fundstelleZeilen(rechnungMitFundstelle) } : rechnung,
        abschnitte: [
          { titel: 'Gebäude auf der Parzelle', zeilen: haeuser, satz: haeuser.length ? undefined : 'Auf dieser Parzelle ist kein Gebäude im Register eingetragen.' },
          { titel: 'Ihre Heizung', zeilen: heizung },
          { titel: 'Was für Ihre Parzelle gilt', zeilen },
          { titel: 'In Ihrer Nachbarschaft', satz: nachbarSatz ?? undefined, zeilen: nachbar },
          { titel: gemeindePreise ? `Preise in ${gemeindePreise.name}` : 'Preise', zeilen: preis },
          { titel: 'Energie und Lage', zeilen: lage },
        ],
        tipps: tipps.map(t => ({ titel: t.titel, text: t.text, quellen: [...t.quellen, ...(t.ratgeber ? [{ name: 'Ratgeber', url: `${window.location.origin}${ratgeberPfad(t.ratgeber)}` }] : [])] })),
        fuer: kontakt.name.trim().replace(/\s+/g, ' '),
        betreiber: BETREIBER, betreiberAdresse: BETREIBER_ADRESSE,
        quellen: `${quellenText}, abgefragt am ${new Date().toLocaleDateString('de-CH')}`,
      });
    } catch { setFehler('Der Bericht liess sich gerade nicht erstellen. Bitte tippen Sie nochmals.'); }
    finally { setPdfLaeuft(false); }
  };
  // Aufrufleiste auf dem Handy: nur, wenn gerade kein anderer Aufruf im Bild ist.
  const andererAufruf = useImBild('.pc .suche, .pc .aufruf, .pc .rechner, .pc .formular.offen, .pc .danke.sichtbar, .pc .schritte-aufruf', [befund, schritt, recht]);
  const leiste = recht || schritt !== 0 || andererAufruf ? null
    : befund ? { text: 'Baureserve kostenlos berechnen', tun: oeffnen }
    : { text: 'Grundstück kostenlos prüfen', tun: zurSuche };

  const eigenesFoto = fotoNachId(marke.design.foto);
  // Die Luftbild-Bühne ist ganz breit, die geteilte gut die Hälfte (check.css): danach wählt der Browser die Datei.
  const fotoBreite = marke.design.buehne === 'luftbild' ? '100vw' : '(max-width: 999px) 100vw, 46vw';
  const wortmarke = <><span className="zeichen" aria-hidden="true"><i /></span><span>{marke.name[0]}<b>{marke.name[1]}</b></span></>;

  return (
    <div className="pc" style={markenStil(marke)} {...markenAttribute(marke)}>
      <header className="kopf">
        <div className="huelle">
          <a className="wortmarke" href="#top" onClick={() => setRecht(null)}>{wortmarke}</a>
          <nav aria-label="Seite"><a href="#ablauf" onClick={() => setRecht(null)}>So funktioniert's</a><a href="#beispiel" onClick={() => setRecht(null)}>Beispiel</a><a href="#angebot" onClick={() => setRecht(null)}>Angebot</a>{tipps.length > 0 && <a href="#tipps" onClick={() => setRecht(null)}>Tipps</a>}<a href="#fragen" onClick={() => setRecht(null)}>Häufige Fragen</a></nav>
          <div className="rechts"><button type="button" className="knopf marke nur-gross" onClick={() => { setRecht(null); if (befund) oeffnen(); else zurSuche(); }}>Kostenlos prüfen</button></div>
        </div>
      </header>

      {recht ? (
        <main className="huelle rechtliches">
          <h2>{recht === 'impressum' ? 'Impressum' : 'Datenschutz'}</h2>
          {recht === 'impressum'
            ? <>
                <p>{marke.name.join('')} ist ein Angebot von {BETREIBER}.</p>
                <address>{BETREIBER}{BETREIBER_ADRESSE.map(z => <span key={z}>{z}</span>)}
                  {BETREIBER_EMAIL && <a href={`mailto:${BETREIBER_EMAIL}`}>{BETREIBER_EMAIL}</a>}
                  {BETREIBER_UID && <span>UID {BETREIBER_UID}</span>}</address>
              </>
            : <>
                <p>Verantwortlich für die Bearbeitung Ihrer Daten ist {BETREIBER}, {BETREIBER_ADRESSE.join(', ')}.</p>
                <p>Wir speichern die Angaben, die Sie im Formular machen (Vorname, Name, Ihre Adresse, Telefon, E-Mail, falls Sie sie angeben, Adresse der Liegenschaft und Ihre Antworten), um Ihnen die Berechnung, den Bericht und die Analyse zu erstellen und Sie zu Ihrer Liegenschaft zu kontaktieren. An Dritte geben wir sie nicht weiter. Den Bericht als PDF erstellt Ihr Browser selbst; er wird nicht bei uns gespeichert.</p>
                {/* Wer was sieht, ist gemessen, nicht angenommen (18. November): im Browser
                    aufgerufen werden nur diese Seite, geo.admin.ch, Google Fonts und die
                    Datenbank; die Datenbank steht bei Amazon in Frankfurt (eu-central-1);
                    Vercel Inc. und Google LLC sind im Swiss-U.S. Data Privacy Framework
                    aktiv eingetragen (dataprivacyframework.gov), Supabase überträgt mit
                    Standardvertragsklauseln (Supabase, Data Residency and Transfers FAQ). */}
                <h3>Wer Ihre Daten sonst sieht</h3>
                <ul>
                  <li>Vercel Inc. (USA) stellt diese Seite bereit und sieht dabei Ihre IP-Adresse und die aufgerufene Seite.</li>
                  <li>Ihre Angaben aus dem Formular liegen in einer Datenbank von Supabase in einem Rechenzentrum in Frankfurt (Deutschland). Vertragspartner ist Supabase Pte. Ltd. (Singapur); für Betrieb und Unterstützung kann Supabase Inc. (USA) darauf zugreifen.</li>
                  <li>Karten, Adressen und Grundstücksdaten kommen vom Bund (geo.admin.ch). Er sieht Ihre IP-Adresse und die Adresse, die Sie suchen.</li>
                  <li>Google LLC (USA) liefert die Schriften (Google Fonts) und sieht dabei Ihre IP-Adresse.</li>
                </ul>
                <h3>Daten im Ausland</h3>
                <p>Deutschland gewährleistet einen angemessenen Datenschutz. In den USA gilt das für Unternehmen, die im Datenschutzrahmen Schweiz–USA (Swiss-U.S. Data Privacy Framework) zertifiziert sind; der Bundesrat anerkennt ihn seit dem 15. September 2024. Vercel Inc. und Google LLC sind dort eingetragen. Supabase überträgt Daten nach Singapur und in die USA mit den Standardvertragsklauseln.</p>
                <h3>Besuche und Werbung</h3>
                <p>Besuche zählen wir anonym und ohne Cookie: mit einer zufälligen Nummer im Speicher dieses Browserfensters, die beim Schliessen verfällt. Den Messpunkt von Google Ads (Werbe-Cookies) laden wir nur, wenn Sie im Cookie-Hinweis zustimmen. Er meldet Google, dass nach dem Klick auf eine Anzeige eine Anfrage eingegangen ist, ohne Name, Adresse oder Nummer; für persönliche Werbung nutzen wir ihn nicht. Ihre Wahl ändern Sie jederzeit unten unter «Cookie-Einstellungen».</p>
                <h3>Ihre Rechte</h3>
                <p>Sie können verlangen, dass wir Ihnen sagen, welche Daten wir über Sie bearbeiten, und dass wir sie berichtigen oder löschen (Art. 25 und 32 des Datenschutzgesetzes). Schreiben Sie dafür an die Adresse oben{BETREIBER_EMAIL ? ` oder an ${BETREIBER_EMAIL}` : ''}.</p>
              </>}
          <button type="button" className="knopf" onClick={() => setRecht(null)}>Zurück</button>
        </main>
      ) : (
      <main id="top">
        <section className="buehne">
          {eigenesFoto ? (
            // Ein eigenes Foto steht als Bild mit Text auf der Seite, nicht als Hintergrund: so sehen es Google und Vorleseprogramme.
            <picture className="foto eigenes">
              <source type="image/avif" srcSet={`${fotoDatei(eigenesFoto, 800, 'avif')} 800w, ${fotoDatei(eigenesFoto, 1600, 'avif')} 1600w`} sizes={fotoBreite} />
              <img src={fotoDatei(eigenesFoto, 1600, 'webp')} srcSet={`${fotoDatei(eigenesFoto, 800, 'webp')} 800w, ${fotoDatei(eigenesFoto, 1600, 'webp')} 1600w`}
                   sizes={fotoBreite} alt={eigenesFoto.alt} title={eigenesFoto.titel} width={eigenesFoto.breite} height={eigenesFoto.hoehe}
                   fetchPriority="high" decoding="async" />
            </picture>
          ) : buehnenBild(marke) && <div className="foto" aria-hidden="true" />}
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
              <a className="ganzes-beispiel" href="#beispiel">Ganzes Beispiel mit Rechnung und Fundstelle</a>
            </aside>
          </div>
        </section>

        {gemeinde && (
          <section className="abschnitt-gross gemeinde-zahlen">
            <div className="huelle">
              <div className="ueber">{gemeinde.ort} in Zahlen</div>
              <dl className="zahlen">
                {gemeindeKennzahlen(gemeinde).map(k => <div key={k.titel}><dt>{k.titel}</dt><dd>{k.wert}</dd><small>{k.zusatz}</small></div>)}
              </dl>
              <p className="klein">{GEMEINDE_QUELLE}</p>
            </div>
          </section>
        )}
        {modus === 'gemeinden' && gemeinden && (
          <section className="abschnitt-gross gemeinde-liste">
            <div className="huelle">
              {[...new Set(gemeinden.map(g => g.kanton))].map(k => (
                <div key={k}><h3>Kanton {k}</h3>
                  <ul>{gemeinden.filter(g => g.kanton === k).map(g => <li key={g.slug}><a href={`/gemeinde/${g.slug}`}>{g.ort}</a></li>)}</ul>
                </div>
              ))}
            </div>
          </section>
        )}

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
                {/* Den Bericht als PDF gibt es erst nach den Angaben, am Ende des Wegweisers. */}
                {befund && bildFertig && (
                  <div className="ergebnis-aktionen">
                    <button type="button" className="knopf leise" onClick={() => void teilen()}>{geteilt ? 'Link kopiert' : 'Teilen'}</button>
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

                {/* Reihenfolge, wie ein Eigentümer liest (Julian, 19. November: «Call to Action
                    ist weit unten»): die vier Zahlen, gleich darunter der nächste Schritt, dann
                    alle Einzelheiten. Auf dem Handy steht die Karte zwischen Aufruf und
                    Einzelheiten (check.css, .seitenteil). */}
                <div className="seitenteil">
                  <div className="tafel kurz">
                    {laden === 'laeuft' && <div className="laedt">Amtliche Daten werden abgefragt …</div>}
                    {laden === 'fehler' && <div className="laedt">Die amtlichen Dienste antworten gerade nicht. Bitte in einer Minute nochmals versuchen.</div>}
                    {befund && (
                        <div className="kacheln">
                          <div><small>Grundstücksfläche</small><b>{n(befund.flaeche)} <span>m²</span></b><em>laut amtlicher Vermessung</em></div>
                          <div><small>Bauzone</small><b>{zonenKuerzel(zoneText) ?? kurzZone(befund.zone)}</b><em>{zoneText ?? befund.zone ?? 'keine Bauzone erfasst'}</em></div>
                          <div><small>Überbaut</small><b>{anteil != null ? <>{anteil} <span>%</span></> : '–'}</b><em>{grundfl ? `${n(grundfl)} m² Gebäudegrundfläche` : 'kein Gebäude erfasst'}</em></div>
                          <div><small>Ältestes Gebäude</small><b>{aeltestesGebaeude ?? '–'}</b><em>{best.length} Gebäude laut Register</em></div>
                        </div>
                    )}
                  </div>

                  {befund?.flaeche != null && (
                    <div ref={rechnerRef} className={`tafel wegweiser ${schritt === 1 || schritt === 2 ? 'formular offen' : schritt === 3 ? 'rechner' : 'rechner schloss'}`}>
                      {schritt === 0 && (
                        <>
                          <div className="schritt-zeile">Ihr nächster Schritt</div>
                          <div className="zeile-oben"><h3>Baureserve berechnen und Bericht erhalten</h3><span className="wert">kostenlos</span></div>
                          <div className="ergebnisse">
                            <div><small>Möglich</small><b>•••</b></div>
                            <div><small>Heute ca.</small><b>{n(heuteFl)} m²</b></div>
                            <div className="plus"><small>Baureserve</small><b>•••</b></div>
                          </div>
                          <ul>{marke.vorteile.slice(0, 3).map(v => <li key={v}>{v}</li>)}</ul>
                          <button type="button" className="knopf marke gross-knopf" onClick={oeffnen}>Jetzt berechnen</button>
                          <p className="wegweiser-satz">Kurze Fragen und Ihre Angaben, dann erhalten Sie den Bericht als PDF, jede Zahl mit Fundstelle. Die Seite führt Sie Schritt für Schritt.</p>
                        </>
                      )}

                      {(schritt === 1 || schritt === 2) && (
                        <form onSubmit={absenden} noValidate>
                          <div className="schritt-zeile">{schritt === 1 ? `Schritt 1 von 3 · ${fragen === 4 ? 'Vier' : 'Drei'} kurze Fragen` : 'Schritt 2 von 3 · Ihre Angaben'}</div>
                          <div className="fortschritt" aria-hidden="true">{Array.from({ length: fragen + KONTAKT.length }, (_, i) => <i key={i} className={(schritt === 2 ? fragen + kschritt : frage) >= i ? 'an' : ''} />)}</div>
                          {schritt === 1 ? (
                            <>
                              <div className="frage-nr">Frage {frage + 1} von {fragen}</div>
                              {frage === 0 && <><div className="frage">Sind Sie Eigentümer/in dieser Liegenschaft?</div>{wahl('eigentuemer', ANTWORT_TEXT.eigentuemer)}</>}
                              {frage === 1 && <><div className="frage">Was haben Sie vor?</div>{wahl('absicht', modus === 'heizung' ? ABSICHT_HEIZUNG : ANTWORT_TEXT.absicht as Record<string, string>)}</>}
                              {frage === 2 && <><div className="frage">Bis wann?</div>{wahl('zeitraum', ANTWORT_TEXT.zeitraum)}</>}
                              {frage === 3 && <><div className="frage">Möchten Sie ein unverbindliches Kaufangebot für Ihr Grundstück?</div>
                                <p className="klein frage-zusatz">Kostenlos, schriftlich, ohne Makler und ohne Verpflichtung.</p>{wahl('kaufangebot', ANTWORT_TEXT.kaufangebot)}</>}
                              <button type="button" className="zurueck" onClick={() => (frage > 0 ? setFrage(frage - 1) : setSchritt(0))}>Zurück</button>
                            </>
                          ) : (
                            <>
                              <div className="frage-nr">Angabe {kschritt + 1} von {KONTAKT.length}</div>
                              {/* Immer dasselbe Feld, nur Frage und Art wechseln: so bleibt der Fokus und auf dem iPhone die Tastatur. */}
                              <label className="feld feld-gross" htmlFor="pc-kontakt">
                                <span className="frage">{angabe.frage}</span>
                                {angabe.zusatz && <small className="feld-zusatz">{angabe.zusatz}</small>}
                                <input id="pc-kontakt" ref={kontaktFeld} name={angabe.k} type={angabe.typ} autoComplete={angabe.auto} inputMode={angabe.modus}
                                       placeholder={angabe.platzhalter} aria-label={angabe.titel} value={kontakt[angabe.k]}
                                       aria-invalid={!!(beruehrt.has(angabe.k) && meldung[angabe.k])}
                                       onChange={e => setKontakt(x => ({ ...x, [angabe.k]: e.target.value }))} />
                                <em className="hinweis-feld" role="alert">{beruehrt.has(angabe.k) ? meldung[angabe.k] : ''}</em>
                              </label>
                              {angabe.k === 'adresse' && befund && !kontakt.adresse.trim() && (
                                <button type="button" className="knopf leise hier-wohnen" onClick={() => { setKontakt(x => ({ ...x, adresse: befund.adresse })); kontaktFeld.current?.focus({ preventScroll: true }); }}>
                                  Ich wohne hier: {befund.adresse}
                                </button>
                              )}
                              <input className="falle" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
                                     value={kontakt.website} onChange={e => setKontakt(k => ({ ...k, website: e.target.value }))} />
                              {fehler && <p className="fehler">{fehler}</p>}
                              {kschritt < KONTAKT.length - 1
                                ? <button type="submit" className="knopf marke senden gross-knopf">Weiter</button>
                                : <>
                                    <button type="submit" className="knopf marke senden gross-knopf" disabled={sendet}>{sendet ? 'Wird gesendet …' : 'Bericht erstellen'}</button>
                                    <p className="einwilligung">Mit dem Absenden sind Sie einverstanden, dass {BETREIBER} Ihre Angaben speichert und Sie zu dieser Liegenschaft kontaktiert, auch zu einem möglichen Verkauf oder einer Entwicklung. Widerruf jederzeit möglich.</p>
                                  </>}
                              <button type="button" className="zurueck" onClick={() => { setFehler(null); if (kschritt > 0) setKschritt(kschritt - 1); else { setSchritt(1); setFrage(fragen - 1); } }}>Zurück</button>
                              <div className="sicher">Verschlüsselt übertragen · keine Weitergabe an Dritte</div>
                            </>
                          )}
                        </form>
                      )}

                      {schritt === 3 && (
                        <>
                          <div className="schritt-zeile">Schritt 3 von 3 · Ihr Bericht</div>
                          <div className="freigeschaltet"><span>Danke, {kontakt.name.trim().split(/\s+/)[0]}. Ihr Bericht ist bereit. Die ausführliche Analyse folgt innert zwei Arbeitstagen{antwort.kaufangebot === 'ja' ? ', und wir bereiten Ihr unverbindliches Kaufangebot vor' : ''}.</span></div>
                          <button type="button" className="knopf marke gross-knopf bericht-knopf" onClick={() => void pdfLaden()} disabled={pdfLaeuft}>
                            {pdfLaeuft ? 'Bericht wird erstellt …' : 'Bericht als PDF herunterladen'}
                          </button>
                          <p className="wegweiser-satz">Die Datei öffnet sich auf Ihrem Gerät. Sie können sie sichern, drucken oder weiterleiten.</p>
                          {fehler && <p className="fehler">{fehler}</p>}
                          {volumenMoeglich != null ? (
                            <>
                              <div className="zeile-oben"><h3>Bauvolumen laut Zonenplan</h3><span className="wert">BMZ {bmzAusPlan!.toLocaleString('de-CH')}</span></div>
                              <p className="klein" style={{ margin: '6px 0 0' }}>Ihre Zone ({ziffern?.kuerzel ?? ziffern?.zone}) begrenzt das Volumen über dem Boden mit der Baumassenziffer {bmzAusPlan!.toLocaleString('de-CH')}.</p>
                              <div className="ergebnisse">
                                <div><small>Möglich</small><b>{n(volumenMoeglich)} m³</b></div>
                                <div><small>Heute</small><b>{volumenHeute != null ? `${n(volumenHeute)} m³` : '–'}</b></div>
                                <div className="plus"><small>Baureserve</small><b>{volumenHeute != null ? (volumenMoeglich - volumenHeute > 0 ? `+ ${n(volumenMoeglich - volumenHeute)} m³` : 'keine') : 'in Analyse'}</b></div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="zeile-oben"><h3>Ausnützung durchrechnen</h3><span className="wert">AZ {az.toFixed(2)}{azAusPlan != null && az === Math.min(2, Math.max(0.2, azAusPlan)) ? ' laut Zonenplan' : ''}</span></div>
                              <p className="klein" style={{ margin: '6px 0 0' }}>{azAusPlan != null
                                ? `Der Zonenplan des Kantons nennt für Ihre Zone (${ziffern?.kuerzel ?? ziffern?.zone}) die Ausnützungsziffer ${azAusPlan.toLocaleString('de-CH')}. Verschieben Sie den Regler, um andere Werte durchzurechnen.`
                                : 'Stellen Sie die Ausnützungsziffer Ihrer Zone ein. Den gültigen Wert Ihrer Gemeinde prüfen wir in der Analyse.'}</p>
                              <input type="range" min={0.2} max={2} step={0.05} value={az} aria-label="Ausnützungsziffer" onChange={e => setAz(Number(e.target.value))} />
                              <div className="skala"><span>0.2</span><span>1.0</span><span>2.0</span></div>
                              <div className="ergebnisse">
                                <div><small>Möglich</small><b>{n(moeglich)} m²</b></div>
                                <div><small>Heute ca.</small><b>{n(heuteFl)} m²</b></div>
                                <div className="plus"><small>Baureserve</small><b>{moeglich - heuteFl > 0 ? `+ ${n(moeglich - heuteFl)} m²` : 'keine'}</b></div>
                              </div>
                            </>
                          )}
                          <div className="fein">{volumenMoeglich != null
                            ? `Volumen: Baumassenziffer mal Grundstücksfläche (Zonenplan Kanton Zürich).${volumenHeute != null ? ' Heute: Gebäudevolumen laut Register.' : ' Das heutige Volumen führt das Register für dieses Gebäude nicht; wir messen es in der Analyse.'} Richtwert, keine Bewilligungszusage.`
                            : 'Geschossfläche, vereinfacht: Ausnützung mal Grundstücksfläche; heute Grundfläche mal Geschosse laut Register. Richtwert, keine Bewilligungszusage.'}</div>
                          {rechnungMitFundstelle && <FundstelleTafel f={rechnungMitFundstelle} />}
                          {schnitt && <Schnitt d={schnitt} titel="Ihre Parzelle im Schnitt" />}
                        </>
                      )}
                    </div>
                  )}

                  {befund && (
                  <div className="tafel einzelheiten">
                    <div className="ueber">Alle Angaben zu Ihrer Parzelle</div>
                    <>
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
                                  {h.einheiten.length > 1 && (
                                    <div className="wohnungen">
                                      <div className="klein">Gehört Ihnen eine dieser Wohnungen? Tippen Sie sie an, dann gilt Ihre Analyse für diese Wohnung.</div>
                                      <ul>
                                        {(alleWohnungen === h.egid ? h.einheiten : h.einheiten.slice(0, 6)).map((w, i) => {
                                          const id = `${h.egid}-${w.nr ?? i}-${w.stock}-${w.flaeche}`;
                                          return (
                                            <li key={id}>
                                              <button type="button" aria-pressed={wohnung?.id === id} onClick={() => setWohnung(wohnung?.id === id ? null : { id, egid: h.egid, ...w })}>
                                                <span>{stockText(w.stock) ?? w.bezeichnung ?? 'Wohnung'}</span>
                                                <span>{w.zimmer ? `${String(w.zimmer).replace('.', ',')} Zi.` : ''}</span>
                                                <span>{w.flaeche ? `${n(w.flaeche)} m²` : ''}</span>
                                              </button>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                      {h.einheiten.length > 6 && alleWohnungen !== h.egid && (
                                        <button type="button" className="mehr" onClick={() => setAlleWohnungen(h.egid)}>Alle {h.einheiten.length} Wohnungen</button>
                                      )}
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : <div className="klein">Auf dieser Parzelle ist kein Gebäude im Register eingetragen.</div>}
                        </div>
                        {heizung.length > 0 && (
                          <div className="block">
                            <h3>Ihre Heizung</h3>
                            <dl className="recht">
                              {heizung.map(z => (
                                <div key={z.titel}>
                                  <dt>{z.titel}</dt>
                                  <dd>{z.art && <span className={`punkt ${z.art}`} aria-hidden="true" />}{z.link ? <a href={z.link} target={FENSTER.extern}>{z.wert}</a> : z.wert}{z.zusatz && <small>{z.zusatz}</small>}</dd>
                                </div>
                              ))}
                            </dl>
                            {FOERDERUNG.map(f => <a key={f.url} className="pdf" href={f.url} target={FENSTER.extern}>{f.text}</a>)}
                          </div>
                        )}
                        <div className="block">
                          <h3>Was für Ihre Parzelle gilt</h3>
                          {rechtslage === null && <div className="klein">Rechtslage wird beim Kanton abgefragt …</div>}
                          {zeilen.length > 0 && (
                            <dl className="recht">
                              {zeilen.map(z => (
                                <div key={z.titel}>
                                  <dt>{z.titel}</dt>
                                  <dd>{z.art && <span className={`punkt ${z.art}`} aria-hidden="true" />}{z.link ? <a href={z.link} target={FENSTER.extern}>{z.wert}</a> : z.wert}{z.zusatz && <small>{z.zusatz}</small>}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                          {gesetzZone && (
                            <details className="fundstelle kurz">
                              <summary>Wie die Ziffer gemessen wird<span>{gesetzZone.artikel} {gesetzZone.erlass.match(/\(([^)]+)\)/)?.[1] ?? ''}</span></summary>
                              <p><GesetzText g={gesetzZone} />{gesetzZone.fassung === 'bisher' && <small>{NUR_BISHER_SATZ}</small>}</p>
                              {bisherZone && <p className="f-bisher"><small>{BISHER_SATZ}</small><GesetzText g={bisherZone} /></p>}
                            </details>
                          )}
                          {pdf && <a className="pdf" href={pdf} target={FENSTER.extern}>Amtlicher ÖREB-Auszug (PDF)</a>}
                        </div>
                        {nachbarSatz && (
                          <div className="block">
                            <h3>In Ihrer Nachbarschaft</h3>
                            <p className="nachbar-satz">{nachbarSatz}</p>
                            {nachbar.length > 0 && (
                              <dl className="recht">
                                {nachbar.map(z => (
                                  <div key={z.titel}>
                                    <dt>{z.titel}</dt>
                                    <dd>{z.wert}</dd>
                                  </div>
                                ))}
                              </dl>
                            )}
                          </div>
                        )}
                        {preis.length > 0 && gemeindePreise && (
                          <div className="block">
                            <h3>Preise in {gemeindePreise.name}</h3>
                            <dl className="recht">
                              {preis.map(z => (
                                <div key={z.titel}>
                                  <dt>{z.titel}</dt>
                                  <dd>{z.wert}{z.zusatz && <small>{z.zusatz}</small>}</dd>
                                </div>
                              ))}
                            </dl>
                            <button type="button" className="knopf marke preis-knopf" onClick={oeffnen}>Genaue Einschätzung anfordern</button>
                          </div>
                        )}
                        {lage.length > 0 && (
                          <div className="block">
                            <h3>Energie und Lage</h3>
                            <dl className="recht">
                              {lage.map(z => (
                                <div key={z.titel}>
                                  <dt>{z.titel}</dt>
                                  <dd>{z.art && <span className={`punkt ${z.art}`} aria-hidden="true" />}{z.link ? <a href={z.link} target={FENSTER.extern}>{z.wert}</a> : z.wert}{z.zusatz && <small>{z.zusatz}</small>}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        )}
                        <div className="block klein">Quellen: {quellenText}, abgefragt am {new Date().toLocaleDateString('de-CH')}. Vorprüfung, keine Bewilligungszusage.</div>
                    </>
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
              {SCHRITTE.map(([t, p], i) => <div key={t} className="schritt-karte"><div className="nr" aria-hidden="true">{i + 1}</div><h3>{t}</h3><p>{p}</p></div>)}
            </div>
            <div className="schritte-aufruf">
              <button type="button" className="knopf marke" onClick={() => (befund ? oeffnen() : zurSuche())}>{befund ? 'Baureserve kostenlos berechnen' : 'Mit Schritt 1 beginnen'}</button>
              <span>Kostenlos, ohne Konto, in einer Minute.</span>
            </div>
          </div>
        </section>

        {/* Was man bekommt, bevor man etwas angibt (Julian, 19. November, nach dem Vergleich mit
            baugesuch.prüfer.ch): ein Bericht mit erfundenen Daten, die Rechnung mit Fundstelle und
            der Schnitt, so wie sie für das eigene Grundstück kommen. */}
        <section className="abschnitt-gross beispiel-bericht" id="beispiel">
          <div className="huelle">
            <div className="ueber">Beispiel</div>
            <h2 className="titel">So sieht Ihr Bericht aus</h2>
            <p className="lead-satz">Jede Zahl mit Fundstelle: woher der Wert kommt, welcher Artikel sagt, wie er gemessen wird, und die Rechnung Schritt für Schritt.</p>
            <div className="beispiel-tafel tafel">
              <div className="b-kopf"><span className="b-marke">Beispiel, erfundene Daten</span><b>{BEISPIEL.adresse}</b><small>{BEISPIEL.ort}</small></div>
              <div className="b-inhalt">
                <Schnitt d={beispielSchnitt()} titel="Beispiel im Schnitt" />
                <div>
                  <div className="b-zahlen">
                    <div><small>Möglich</small><b>{n(beispielFundstelle().moeglich)} m²</b></div>
                    <div><small>Heute</small><b>{n(beispielFundstelle().heute ?? 0)} m²</b></div>
                    <div className="plus"><small>Baureserve</small><b>+ {n(beispielFundstelle().reserve ?? 0)} m²</b></div>
                  </div>
                  <FundstelleTafel f={beispielFundstelle()} offen />
                </div>
              </div>
              <p className="klein b-hinweis">{BEISPIEL_HINWEIS}</p>
              <div className="b-knoepfe">
                <button type="button" className="knopf marke" onClick={() => (befund ? oeffnen() : zurSuche())}>{befund ? 'Meinen Bericht erstellen' : 'Eigenes Grundstück prüfen'}</button>
                <button type="button" className="knopf" disabled={pdfLaeuft} onClick={() => { setPdfLaeuft(true); void berichtSpeichern(beispielBericht({ name: marke.name.join(''), farbe: marke.farbe, domain, betreiber: BETREIBER, betreiberAdresse: BETREIBER_ADRESSE })).finally(() => setPdfLaeuft(false)); }}>Beispielbericht als PDF</button>
              </div>
            </div>
          </div>
        </section>

        <section className="abschnitt-gross angebot" id="angebot">
          <div className="huelle">
            <div className="ueber">Angebot</div>
            <h2 className="titel">Was Sie bekommen</h2>
            <p className="lead-satz">Alles kostenlos. Sie entscheiden bei jedem Schritt, ob Sie weitergehen.</p>
            <div className="angebot-tafel tafel">
              {ANGEBOT.map(a => (
                <div key={a.stufe} className="a-stufe">
                  <div className="a-oben"><span className="a-stufe-name">{a.stufe}</span><span className="a-preis">{a.preis}</span></div>
                  <h3>{a.titel}</h3>
                  <ul>{a.punkte.map(p => <li key={p}>{p}</li>)}</ul>
                </div>
              ))}
            </div>
            <div className="schritte-aufruf">
              <button type="button" className="knopf marke" onClick={() => (befund ? oeffnen() : zurSuche())}>{befund ? 'Baureserve kostenlos berechnen' : 'Grundstück kostenlos prüfen'}</button>
              <span>Das Kaufangebot gibt es auf Wunsch, nach Ihren Angaben.</span>
            </div>
          </div>
        </section>

        {tipps.length > 0 && (
          <section className="abschnitt-gross tipps" id="tipps">
            <div className="huelle">
              <div className="ueber">Tipps und Tricks</div>
              <h2 className="titel">{TIPP_TITEL}</h2>
              <div className="tipps-liste">
                {tipps.map(t => (
                  <details key={t.titel}>
                    <summary>{t.titel}</summary>
                    <p>{t.text}</p>
                    <ul className="tipp-quellen">
                      {t.quellen.map(q => <li key={q.url}><a className="tipp-quelle" href={q.url} target={FENSTER.extern}>Nachlesen: {q.name}</a></li>)}
                      {t.ratgeber && <li><a className="tipp-quelle" href={ratgeberPfad(t.ratgeber)}>Mehr dazu im Ratgeber</a></li>}
                    </ul>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

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
          {/* Weitere Einstiege; ohne Link fand sie weder ein Besucher noch Google (15. November). */}
          <div><h4>Mehr</h4><ul>
            {modus !== 'heizung' && <li><a href={markeFuerHost(window.location.hostname) ? '/heizung' : `/check/${marke.id}/heizung`}>Heizungs-Check</a></li>}
            {modus === 'heizung' && <li><a href={markeFuerHost(window.location.hostname) ? '/' : `/check/${marke.id}`}>Grundstück prüfen</a></li>}
            {markeFuerHost(window.location.hostname)?.domains.includes(GEMEINDE_DOMAIN) && <li><a href="/gemeinden">Bauen in Ihrer Gemeinde</a></li>}
            {ARTIKEL.map(a => <li key={a.slug}><a href={markeFuerHost(window.location.hostname) ? `/ratgeber/${a.slug}` : `/check/${marke.id}/ratgeber/${a.slug}`}>Ratgeber: {a.titel.split('.')[0]}</a></li>)}
          </ul></div>
          <div><h4>Rechtliches</h4><ul>
            <li><button type="button" onClick={() => { setRecht('impressum'); window.scrollTo({ top: 0 }); }}>Impressum</button></li>
            <li><button type="button" onClick={() => { setRecht('datenschutz'); window.scrollTo({ top: 0 }); }}>Datenschutz</button></li>
            <li><button type="button" onClick={() => setzeZustimmung(null)}>Cookie-Einstellungen</button></li>
          </ul></div>
                    {/* Die Quellen stehen klein hier und gesammelt unter dem Ergebnis, nicht je Zeile
              (Julian, 15. November): die Angabe bleibt, swisstopo und die Kantone verlangen sie. */}
                    <div className="unten">Vorprüfung auf Grundlage amtlicher Daten ({DATENQUELLEN.join(', ')}), keine Bewilligungszusage und keine Verkehrswertschätzung.</div>
        </div>
      </footer>

      <CookieHinweis datenschutz={() => { setRecht('datenschutz'); window.scrollTo({ top: 0 }); }} />
      {leiste && (
        <div className={`mobil-aufruf${bildFertig ? ' sichtbar' : ''}`}><button type="button" className="knopf marke" onClick={leiste.tun}>{leiste.text}</button></div>
      )}
    </div>
  );
}
