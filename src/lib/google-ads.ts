import { darfWerben, EREIGNIS } from '@/lib/zustimmung';
import { KLICK, sitzungsHerkunft } from '@/lib/werbe-herkunft';

/**
 * Messpunkt von Google Ads für die Check-Seiten. Ohne ihn sieht Google nur
 * Klicks; mit ihm stehen die Kosten pro Lead im Konto, und «Conversions
 * maximieren» hat eine Grundlage (Werbeplan: umstellen nach 30 Leads).
 *
 * Conversion-ID (AW-…) und Label stehen unten in KONTO oder kommen aus
 * VITE_GOOGLE_ADS_ID und VITE_GOOGLE_ADS_LABEL bei Vercel. Beide sind
 * öffentlich: sie stehen in jeder Seite, die den Messpunkt nutzt. Fehlt die
 * ID, lädt nichts.
 *
 * Geladen wird gleich nach «Einverstanden», nicht erst beim Lead: der Tag
 * muss den Klick der Anzeige (gclid) sehen, und die Check-Seite schreibt
 * ihren Link um, sobald eine Adresse gewählt ist. Fehlt die Kennung im
 * Link, reicht sie page_location aus dem Gemerkten nach (werbe-herkunft.ts).
 *
 * Gemeldet wird allein der Lead, ohne Namen, Adresse oder Nummer. Für
 * persönliche Werbung (Remarketing) gibt es keine Zustimmung.
 */
// Aus der Conversion «Lead» im Konto «Bauraum» (21. November, Ereignis-Snippet,
// send_to: 'AW-18588031014/Y3eECO-s4rwdEKawu59F'). Öffentlich wie in jeder Seite
// mit Messpunkt, darum direkt hier; Vercel kann sie überschreiben.
export const KONTO = { id: 'AW-18588031014', label: 'Y3eECO-s4rwdEKawu59F' };
const id = String(import.meta.env.VITE_GOOGLE_ADS_ID || KONTO.id).trim();
const label = String(import.meta.env.VITE_GOOGLE_ADS_LABEL || KONTO.label).trim();
// Ein Tippfehler bei Vercel soll keine fremde Adresse laden.
export const ADS_ID: string | undefined = /^AW-\d{6,14}$/.test(id) ? id : undefined;
export const ADS_LABEL: string | undefined = /^[A-Za-z0-9_-]{6,40}$/.test(label) ? label : undefined;

type Gtag = (...a: unknown[]) => void;
type Fenster = { dataLayer?: unknown[]; gtag?: Gtag };

let geladen = false;
const gtag = (...a: unknown[]) => (window as unknown as Fenster).gtag!(...a);

/** Der Link, den der Tag lesen soll: der jetzige, mit der Klick-Kennung aus der Sitzung, falls sie fehlt. */
export function seitenLink(jetzt: string, gemerkt: Record<string, string>): string | null {
  const u = new URL(jetzt);
  if (KLICK.some(k => u.searchParams.get(k))) return null;
  const fehlt = KLICK.filter(k => gemerkt[k]);
  if (!fehlt.length) return null;
  fehlt.forEach(k => u.searchParams.set(k, gemerkt[k]));
  return u.toString();
}

function laden(konto: string): void {
  if (geladen || typeof window === 'undefined') return;
  geladen = true;
  const w = window as unknown as Fenster;
  w.dataLayer = w.dataLayer ?? [];
  // Der offizielle Einbau von Google: gtag.js liest aus dataLayer nur
  // arguments-Objekte, keine Arrays. Darum hier bewusst `arguments`.
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  // Die Wahl im Cookie-Hinweis, ausdrücklich: Messung ja, persönliche Werbung nein.
  gtag('consent', 'default', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied', analytics_storage: 'denied' });
  gtag('js', new Date());
  const link = seitenLink(window.location.href, sitzungsHerkunft());
  gtag('config', konto, link ? { page_location: link } : {});
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(konto)}`;
  document.head.appendChild(s);
}

/** Lädt den Messpunkt, sobald zugestimmt ist; ohne Konto oder ohne Zustimmung tut es nichts. */
export function googleStart(): void {
  if (!ADS_ID || typeof window === 'undefined' || !darfWerben()) return;
  laden(ADS_ID);
}

/** Beim Start der Check-Seiten: jetzt laden, wenn schon zugestimmt ist, sonst nach der Wahl. */
export function googleBeobachten(): void {
  if (typeof window === 'undefined') return;
  googleStart();
  window.addEventListener(EREIGNIS, () => {
    if (darfWerben()) googleStart();
    // Wer später «Nur nötige» wählt, nimmt die Zustimmung zurück: der geladene Tag misst nicht mehr.
    else if (geladen) gtag('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied' });
  });
}

/** Meldet einen Lead an Google Ads; ohne Konto, Label oder Zustimmung tut es nichts. */
export function googleLead(): void {
  if (!ADS_ID || !ADS_LABEL || typeof window === 'undefined' || !darfWerben()) return;
  laden(ADS_ID);
  gtag('event', 'conversion', { send_to: `${ADS_ID}/${ADS_LABEL}` });
}
