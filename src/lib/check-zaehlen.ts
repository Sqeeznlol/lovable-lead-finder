/**
 * Zählt, wie weit Besucher auf den Check-Seiten kommen (Tabelle
 * check_ereignis, Migration 20261108120000 im Repository der Webseite).
 * Ohne Personendaten: eine Zufallssitzung je Browser-Tab, Marke, Domain,
 * Schritt, Quelle der Werbung und ob Handy oder Computer.
 *
 * Fehler werden verschluckt: Fehlt die Tabelle oder ist das Netz weg,
 * darf die Seite nicht darunter leiden.
 */
import { supabase } from '@/integrations/supabase/client';
import { pixel, type PixelEreignis } from '@/lib/meta-pixel';
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

// Unsere Schritte als Standardereignisse von Meta. "Lead" ist das, worauf
// die Werbung optimiert; die Schritte davor zeigen Meta, wer nahe dran war.
export const PIXEL_FUER: Partial<Record<Ereignis, PixelEreignis>> = {
  aufruf: 'PageView', ratgeber: 'PageView', suche: 'Search', ergebnis: 'ViewContent', rechner: 'InitiateCheckout', lead: 'Lead',
};

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

/** Jeden Schritt einmal je Sitzung und Marke. */
export function zaehlen(marke: string, domain: string, ereignis: Ereignis): void {
  if (typeof window === 'undefined' || !zaehltHier(window.location.hostname)) return;
  const schluessel = `${marke}|${ereignis}`;
  if (gesendet.has(schluessel)) return;
  gesendet.add(schluessel);
  const p = PIXEL_FUER[ereignis];
  if (p) pixel(p, { content_name: domain, content_category: marke });
  const { quelle, kampagne } = sitzungsQuelle();
  const geraet = window.matchMedia?.('(max-width: 999px)').matches ? 'handy' : 'computer';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (supabase as any).from('check_ereignis')
    .insert({ marke, domain: domain.slice(0, 100), ereignis, sitzung: sitzung(), quelle, kampagne, geraet })
    .then(() => undefined, () => undefined);
}
