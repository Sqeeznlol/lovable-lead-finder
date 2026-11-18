/**
 * Zählt, wie weit Besucher auf den Check-Seiten kommen (Tabelle
 * check_ereignis, Migration 20261108120000 im Repository der Webseite).
 * Ohne Personendaten: eine Zufallssitzung je Browser-Tab, Marke, Domain,
 * Schritt, Quelle der Werbung und ob Handy oder Computer.
 *
 * Fehler werden verschluckt: Fehlt die Tabelle oder ist das Netz weg,
 * darf die Seite nicht darunter leiden.
 */
import { datenbank } from './datenbank';
import { googleLead } from '@/lib/google-ads';
import { markeFuerHost } from '@/lib/check-marken';

export type Ereignis = 'aufruf' | 'suche' | 'ergebnis' | 'rechner' | 'kontakt' | 'lead' | 'ratgeber' | 'ratgeber_klick' | 'teilen' | 'bericht';

/** Woher der Besuch kommt: Werbung zuerst, sonst die verweisende Seite. */
export function quelleAus(suche: string, verweis: string, eigenerHost: string): { quelle: string | null; kampagne: string | null } {
  const u = new URLSearchParams(suche);
  const kampagne = u.get('utm_campaign')?.slice(0, 100) || null;
  const utm = u.get('utm_source')?.toLowerCase().slice(0, 60);
  if (utm) return { quelle: utm, kampagne };
  if (u.get('fbclid')) return { quelle: 'facebook', kampagne };
  if (u.get('gclid')) return { quelle: 'google', kampagne };
  try {
    const h = new URL(verweis).hostname.replace(/^www\./, '');
    if (h && h !== eigenerHost.replace(/^www\./, '')) return { quelle: h.slice(0, 60), kampagne };
  } catch { /* kein oder ungültiger Verweis */ }
  return { quelle: null, kampagne };
}

function sitzung(): string {
  try {
    let s = sessionStorage.getItem('pc-sitzung');
    if (!s) { s = (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 24); sessionStorage.setItem('pc-sitzung', s); }
    return s;
  } catch { return 'ohnespeicher0'; }
}

// Die Quelle des ersten Aufrufs gilt für die ganze Sitzung, auch wenn die
// Adresse ihre Parameter später verliert.
function sitzungsQuelle(): { quelle: string | null; kampagne: string | null } {
  try {
    const alt = sessionStorage.getItem('pc-quelle');
    if (alt) return JSON.parse(alt);
    const q = quelleAus(window.location.search, document.referrer, window.location.hostname);
    sessionStorage.setItem('pc-quelle', JSON.stringify(q));
    return q;
  } catch { return quelleAus(window.location.search, document.referrer, window.location.hostname); }
}

const gesendet = new Set<string>();

/**
 * Gezählt wird nur auf einer echten Marken-Domain. Bis zum 13. November
 * zählten auch die Vercel-Vorschau, localhost und unsere automatischen
 * Prüfungen als Besucher -- sie trugen die Hauptdomain der Marke ein, und
 * die Zahlen unter «Leads» waren deshalb falsch (Julian: "stimmen die
 * Anzahl Besucher?").
 */
export function zaehltHier(host: string): boolean {
  return markeFuerHost(host) !== null;
}

/**
 * Suchmaschinen, Vorschau-Dienste und Scanner, die JavaScript ausführen.
 * Am 15. November gemessen (Auswerten: besucher): 795 "Besucher" in drei
 * Tagen, gleichmässig auf alle 23 Domains, fast alle direkt und nur 8 mit
 * einer Suche -- ohne eine einzige Anzeige. Julian: "stimmen die analytics?"
 */
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|scan|python|curl|wget|httpclient|phantom|puppeteer|playwright/i;
export function istBot(ua: string, webdriver: boolean): boolean {
  return webdriver || BOT.test(ua);
}

// Ein Aufruf zählt erst, wenn ein Mensch etwas tut: tippen, klicken,
// scrollen oder eine Taste drücken. Wer die Seite nur lädt, ist kein Besucher.
const LEBENSZEICHEN = ['pointerdown', 'touchstart', 'keydown', 'scroll', 'wheel'] as const;
const NACH_BEWEGUNG: ReadonlySet<Ereignis> = new Set(['aufruf', 'ratgeber']);
let bewegt = false;
const warten: (() => void)[] = [];
function nachBewegung(f: () => void): void {
  if (bewegt) return f();
  if (!warten.length) {
    const los = () => {
      if (bewegt) return;
      bewegt = true;
      LEBENSZEICHEN.forEach(e => window.removeEventListener(e, los));
      warten.splice(0).forEach(g => g());
    };
    LEBENSZEICHEN.forEach(e => window.addEventListener(e, los, { passive: true }));
  }
  warten.push(f);
}

/** Jeden Schritt einmal je Sitzung und Marke. */
export function zaehlen(marke: string, domain: string, ereignis: Ereignis): void {
  if (typeof window === 'undefined' || !zaehltHier(window.location.hostname)) return;
  if (istBot(navigator.userAgent ?? '', navigator.webdriver === true)) return;
  if (NACH_BEWEGUNG.has(ereignis) && !bewegt) { nachBewegung(() => zaehlen(marke, domain, ereignis)); return; }
  const schluessel = `${marke}|${ereignis}`;
  if (gesendet.has(schluessel)) return;
  gesendet.add(schluessel);
  // Geworben wird nur bei Google (Julian, 18. November); gemeldet wird allein der Lead.
  if (ereignis === 'lead') googleLead();
  const { quelle, kampagne } = sitzungsQuelle();
  const geraet = window.matchMedia?.('(max-width: 999px)').matches ? 'handy' : 'computer';
   
  void datenbank().then(db => db.from('check_ereignis')
    .insert({ marke, domain: domain.slice(0, 100), ereignis, sitzung: sitzung(), quelle, kampagne, geraet }))
    .then(() => undefined, () => undefined);
}
