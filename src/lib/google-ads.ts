import { darfWerben } from '@/lib/zustimmung';

/**
 * Messpunkt von Google Ads für die Check-Seiten, gebaut wie das Meta-Pixel
 * (meta-pixel.ts). Ohne ihn sieht Google nur Klicks; mit ihm stehen die
 * Kosten pro Lead im Konto, und «Conversions maximieren» hat eine
 * Grundlage (Werbeplan, November 2026: umstellen nach 30 Leads).
 *
 * Conversion-ID (AW-…) und Label kommen aus VITE_GOOGLE_ADS_ID und
 * VITE_GOOGLE_ADS_LABEL bei Vercel. Beide sind öffentlich: sie stehen in
 * jeder Seite, die den Messpunkt nutzt. Fehlt eines, lädt nichts.
 *
 * Nur nach «Einverstanden» im Cookie-Hinweis, wie das Pixel. Gemeldet wird
 * allein der Lead, ohne Namen, Adresse oder Nummer.
 */
const id = String(import.meta.env.VITE_GOOGLE_ADS_ID ?? '').trim();
const label = String(import.meta.env.VITE_GOOGLE_ADS_LABEL ?? '').trim();
// Ein Tippfehler bei Vercel soll keine fremde Adresse laden.
export const ADS_ID: string | undefined = /^AW-\d{6,14}$/.test(id) ? id : undefined;
export const ADS_LABEL: string | undefined = /^[A-Za-z0-9_-]{6,40}$/.test(label) ? label : undefined;

type Gtag = (...a: unknown[]) => void;
type Fenster = { dataLayer?: unknown[]; gtag?: Gtag };

let geladen = false;

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
  w.gtag('js', new Date());
  w.gtag('config', konto);
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(konto)}`;
  document.head.appendChild(s);
}

/** Meldet einen Lead an Google Ads; ohne Konto oder ohne Zustimmung tut es nichts. */
export function googleLead(): void {
  if (!ADS_ID || !ADS_LABEL || typeof window === 'undefined' || !darfWerben()) return;
  laden(ADS_ID);
  (window as unknown as Fenster).gtag!('event', 'conversion', { send_to: `${ADS_ID}/${ADS_LABEL}` });
}
